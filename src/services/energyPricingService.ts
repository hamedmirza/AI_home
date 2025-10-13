import { dbService } from './database';

export interface EnergyPricing {
  general_price: number;
  feed_in_tariff: number;
  currency: string;
  pricing_mode?: 'static' | 'dynamic';
  update_interval_minutes?: number;
  last_updated?: string;
}

interface CostCalculation {
  gridCost: number;
  solarSavings: number;
  exportEarnings: number;
  netCost: number;
  currency: string;
}

interface PriceHistory {
  id: string;
  general_price: number;
  feed_in_tariff: number;
  pricing_mode: string;
  source: string;
  recorded_at: string;
}

class EnergyPricingService {
  private defaultPricing: EnergyPricing = {
    general_price: 0.30,
    feed_in_tariff: 0.08,
    currency: 'USD',
    pricing_mode: 'static',
    update_interval_minutes: 5
  };

  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(pricing: EnergyPricing) => void> = [];
  private isUpdating: boolean = false;

  async getPricing(): Promise<EnergyPricing> {
    try {
      const supabase = dbService.getClient();
      const { data } = await supabase
        .from('energy_pricing')
        .select('*')
        .maybeSingle();

      if (data) {
        const pricing = {
          general_price: Number(data.general_price),
          feed_in_tariff: Number(data.feed_in_tariff),
          currency: data.currency || 'USD',
          pricing_mode: data.pricing_mode || 'static',
          update_interval_minutes: data.update_interval_minutes || 5,
          last_updated: data.last_updated
        };

        // Auto-update if dynamic mode and data is stale
        if (pricing.pricing_mode === 'dynamic' && pricing.last_updated && !this.isUpdating) {
          const lastUpdate = new Date(pricing.last_updated).getTime();
          const now = Date.now();
          const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

          if (minutesSinceUpdate >= pricing.update_interval_minutes) {
            console.log(`[ENERGY PRICING] Data is stale (${minutesSinceUpdate.toFixed(1)} min old), triggering update...`);
            this.isUpdating = true;
            this.updateDynamicPrices()
              .catch(err => console.error('[ENERGY PRICING] Background update failed:', err))
              .finally(() => { this.isUpdating = false; });
          }
        }

        return pricing;
      }

      return this.defaultPricing;
    } catch (error) {
      console.error('Failed to get pricing:', error);
      return this.defaultPricing;
    }
  }

  async savePricing(pricing: EnergyPricing): Promise<void> {
    try {
      const supabase = dbService.getClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: existing } = await supabase
        .from('energy_pricing')
        .select('id, general_price, feed_in_tariff')
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        await supabase
          .from('energy_pricing')
          .update({
            general_price: pricing.general_price,
            feed_in_tariff: pricing.feed_in_tariff,
            currency: pricing.currency,
            pricing_mode: pricing.pricing_mode || 'static',
            update_interval_minutes: pricing.update_interval_minutes || 5,
            last_updated: now,
            updated_at: now
          })
          .eq('id', existing.id);

        if (existing.general_price !== pricing.general_price ||
            existing.feed_in_tariff !== pricing.feed_in_tariff) {
          await this.recordPriceHistory(
            user?.id || null,
            pricing.general_price,
            pricing.feed_in_tariff,
            pricing.pricing_mode || 'static',
            'manual'
          );
        }
      } else {
        await supabase
          .from('energy_pricing')
          .insert({
            user_id: user?.id || null,
            general_price: pricing.general_price,
            feed_in_tariff: pricing.feed_in_tariff,
            currency: pricing.currency,
            pricing_mode: pricing.pricing_mode || 'static',
            update_interval_minutes: pricing.update_interval_minutes || 5,
            last_updated: now
          });

        await this.recordPriceHistory(
          user?.id || null,
          pricing.general_price,
          pricing.feed_in_tariff,
          pricing.pricing_mode || 'static',
          'initial'
        );
      }

      if (pricing.pricing_mode === 'dynamic') {
        this.startDynamicPricing(pricing.update_interval_minutes || 5);
      } else {
        this.stopDynamicPricing();
      }

      this.notifyListeners(pricing);
    } catch (error) {
      console.error('Failed to save pricing:', error);
      throw error;
    }
  }

  calculateRealTimeCost(
    gridImportWatts: number,
    solarProductionWatts: number,
    gridExportWatts: number,
    generalPrice: number,
    feedInTariff: number,
    timeframeHours: number = 1
  ): CostCalculation {
    const gridImportKWh = (gridImportWatts / 1000) * timeframeHours;
    const solarProductionKWh = (solarProductionWatts / 1000) * timeframeHours;
    const gridExportKWh = (gridExportWatts / 1000) * timeframeHours;

    const gridCost = gridImportKWh * generalPrice;

    const solarUsedDirectly = Math.max(0, solarProductionKWh - gridExportKWh);
    const solarSavings = solarUsedDirectly * generalPrice;

    const exportEarnings = gridExportKWh * feedInTariff;

    const netCost = gridCost - exportEarnings;

    return {
      gridCost: Math.max(0, gridCost),
      solarSavings: Math.max(0, solarSavings),
      exportEarnings: Math.max(0, exportEarnings),
      netCost: Math.max(0, netCost),
      currency: 'USD'
    };
  }

  async calculateDailyCost(): Promise<CostCalculation & { date: string }> {
    try {
      const pricing = await this.getPricing();
      const entities = await dbService.getEntities();

      const gridImportEntity = entities.find(e =>
        e.entity_id.includes('grid_import') || e.entity_id.includes('grid_power')
      );
      const solarEntity = entities.find(e =>
        e.entity_id.includes('solar') || e.entity_id.includes('pv_power')
      );
      const gridExportEntity = entities.find(e =>
        e.entity_id.includes('grid_export') || e.entity_id.includes('feed_in')
      );

      const gridImport = gridImportEntity ? parseFloat(gridImportEntity.state) || 0 : 0;
      const solarProduction = solarEntity ? parseFloat(solarEntity.state) || 0 : 0;
      const gridExport = gridExportEntity ? parseFloat(gridExportEntity.state) || 0 : 0;

      const calculation = this.calculateRealTimeCost(
        gridImport,
        solarProduction,
        gridExport,
        pricing.general_price,
        pricing.feed_in_tariff,
        24
      );

      return {
        ...calculation,
        currency: pricing.currency,
        date: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Failed to calculate daily cost:', error);
      return {
        gridCost: 0,
        solarSavings: 0,
        exportEarnings: 0,
        netCost: 0,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0]
      };
    }
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private async recordPriceHistory(
    userId: string | null,
    generalPrice: number,
    feedInTariff: number,
    pricingMode: string,
    source: string
  ): Promise<void> {
    try {
      const supabase = dbService.getClient();
      await supabase
        .from('price_history')
        .insert({
          user_id: userId,
          general_price: generalPrice,
          feed_in_tariff: feedInTariff,
          pricing_mode: pricingMode,
          source: source
        });
    } catch (error) {
      console.error('Failed to record price history:', error);
    }
  }

  async getPriceHistory(limit: number = 100): Promise<PriceHistory[]> {
    try {
      const supabase = dbService.getClient();
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get price history:', error);
      return [];
    }
  }

  startDynamicPricing(intervalMinutes: number = 5): void {
    this.stopDynamicPricing();

    console.log(`[ENERGY PRICING] Starting dynamic pricing updates every ${intervalMinutes} minutes`);
    console.log(`[ENERGY PRICING] Next update in ${intervalMinutes} minutes`);

    this.updateInterval = setInterval(async () => {
      try {
        console.log('[ENERGY PRICING] Running scheduled price update...');
        await this.updateDynamicPrices();
      } catch (error) {
        console.error('[ENERGY PRICING] Dynamic price update failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log('[ENERGY PRICING] Running initial price update...');
    this.updateDynamicPrices();
  }

  stopDynamicPricing(): void {
    if (this.updateInterval) {
      console.log('Stopping dynamic pricing updates');
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async updateDynamicPrices(): Promise<void> {
    try {
      console.log('[ENERGY PRICING] Checking for price updates...');
      const currentPricing = await this.getPricing();

      if (currentPricing.pricing_mode !== 'dynamic') {
        console.log('[ENERGY PRICING] Mode is not dynamic, stopping...');
        this.stopDynamicPricing();
        return;
      }

      const entities = await dbService.getEntities();
      console.log(`[ENERGY PRICING] Found ${entities.length} entities to search`);

      const generalPriceEntity = entities.find(e =>
        e.entity_id.includes('general_price') ||
        e.entity_id.includes('electricity_price') ||
        e.entity_id.includes('grid_price')
      );
      const feedInEntity = entities.find(e =>
        e.entity_id.includes('feed_in') ||
        e.entity_id.includes('export_price') ||
        e.entity_id.includes('feedin_tariff')
      );

      console.log('[ENERGY PRICING] Found price entities:', {
        generalPriceEntity: generalPriceEntity?.entity_id || 'none',
        feedInEntity: feedInEntity?.entity_id || 'none'
      });

      let newGeneralPrice = currentPricing.general_price;
      let newFeedInTariff = currentPricing.feed_in_tariff;
      let updated = false;

      if (generalPriceEntity && generalPriceEntity.state) {
        const price = parseFloat(generalPriceEntity.state);
        if (!isNaN(price) && price > 0 && price !== newGeneralPrice) {
          newGeneralPrice = price;
          updated = true;
        }
      }

      if (feedInEntity && feedInEntity.state) {
        const tariff = parseFloat(feedInEntity.state);
        if (!isNaN(tariff) && tariff >= 0 && tariff !== newFeedInTariff) {
          newFeedInTariff = tariff;
          updated = true;
        }
      }

      if (updated) {
        console.log('[ENERGY PRICING] ✅ Price change detected! Updating:', {
          newGeneralPrice,
          newFeedInTariff,
          oldGeneralPrice: currentPricing.general_price,
          oldFeedInTariff: currentPricing.feed_in_tariff
        });

        const supabase = dbService.getClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { data: existing } = await supabase
          .from('energy_pricing')
          .select('id')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('energy_pricing')
            .update({
              general_price: newGeneralPrice,
              feed_in_tariff: newFeedInTariff,
              last_updated: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          await this.recordPriceHistory(
            user?.id || null,
            newGeneralPrice,
            newFeedInTariff,
            'dynamic',
            'auto_update'
          );

          this.notifyListeners({
            general_price: newGeneralPrice,
            feed_in_tariff: newFeedInTariff,
            currency: currentPricing.currency,
            pricing_mode: 'dynamic',
            update_interval_minutes: currentPricing.update_interval_minutes,
            last_updated: new Date().toISOString()
          });
        }
      } else {
        console.log('[ENERGY PRICING] No price changes detected');
      }
    } catch (error) {
      console.error('[ENERGY PRICING] ❌ Failed to update dynamic prices:', error);
    }
  }

  onPriceUpdate(callback: (pricing: EnergyPricing) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(pricing: EnergyPricing): void {
    this.listeners.forEach(listener => {
      try {
        listener(pricing);
      } catch (error) {
        console.error('Error in pricing listener:', error);
      }
    });
  }

  async initializeDynamicPricing(): Promise<void> {
    try {
      const pricing = await this.getPricing();
      if (pricing.pricing_mode === 'dynamic') {
        this.startDynamicPricing(pricing.update_interval_minutes || 5);
      }
    } catch (error) {
      console.error('Failed to initialize dynamic pricing:', error);
    }
  }
}

export const energyPricingService = new EnergyPricingService();
