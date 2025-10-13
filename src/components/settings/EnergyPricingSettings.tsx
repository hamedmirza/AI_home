import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { energyPricingService } from '../../services/energyPricingService';
import { dbService } from '../../services/database';
import { DollarSign, Zap, RefreshCw } from 'lucide-react';

export function EnergyPricingSettings() {
  const [preferences, setPreferences] = useState({
    generalPrice: 0.30,
    feedInTariff: 0.08,
    currency: 'USD',
    pricingMode: 'static',
    updateIntervalMinutes: 5
  });

  const [lastPriceUpdate, setLastPriceUpdate] = useState<string>('');

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const pricing = await energyPricingService.getPricing();
      setPreferences(prev => ({
        ...prev,
        generalPrice: pricing.general_price,
        feedInTariff: pricing.feed_in_tariff,
        currency: pricing.currency,
        pricingMode: pricing.pricing_mode || 'static',
        updateIntervalMinutes: pricing.update_interval_minutes || 5
      }));

      if (pricing.last_updated) {
        setLastPriceUpdate(new Date(pricing.last_updated).toLocaleString());
      }

      if (pricing.pricing_mode === 'dynamic') {
        energyPricingService.startDynamicPricing(pricing.update_interval_minutes || 5);
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
    }
  };

  const handleSave = async () => {
    try {
      localStorage.setItem('appPreferences', JSON.stringify(preferences));

      await energyPricingService.savePricing({
        general_price: preferences.generalPrice,
        feed_in_tariff: preferences.feedInTariff,
        currency: preferences.currency,
        pricing_mode: preferences.pricingMode,
        update_interval_minutes: preferences.updateIntervalMinutes
      });

      if (preferences.pricingMode === 'dynamic') {
        energyPricingService.startDynamicPricing(preferences.updateIntervalMinutes);
      } else {
        energyPricingService.stopDynamicPricing();
      }

      alert('Energy pricing settings saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>Energy Pricing & Cost Calculation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <Zap className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Real-Time Cost Tracking</h4>
                <p className="text-sm text-green-800 mt-1">
                  Configure your electricity rates to see real-time costs, savings from solar, and export earnings.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Pricing Mode</h4>
                <p className="text-sm text-gray-600">Choose between static or dynamic pricing</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${preferences.pricingMode === 'static' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Static
                </span>
                <Switch
                  checked={preferences.pricingMode === 'dynamic'}
                  onChange={(checked) => setPreferences(prev => ({ ...prev, pricingMode: checked ? 'dynamic' : 'static' }))}
                />
                <span className={`text-sm font-medium ${preferences.pricingMode === 'dynamic' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Dynamic
                </span>
              </div>
            </div>

            {preferences.pricingMode === 'dynamic' && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-start space-x-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-900 font-medium">Dynamic Pricing Enabled</p>
                    <p className="text-xs text-blue-800 mt-1">
                      Prices will automatically update from entities named "general_price" or "feed_in_tariff".
                    </p>
                    {lastPriceUpdate && (
                      <p className="text-xs text-blue-700 mt-2">
                        <strong>Last Updated:</strong> {lastPriceUpdate}
                      </p>
                    )}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Update Interval (minutes)
                      </label>
                      <select
                        value={preferences.updateIntervalMinutes}
                        onChange={(e) => setPreferences(prev => ({ ...prev, updateIntervalMinutes: parseInt(e.target.value) }))}
                        className="px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1">1 minute</option>
                        <option value="5">5 minutes</option>
                        <option value="10">10 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                General Price (per kWh)
                {preferences.pricingMode === 'dynamic' && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(Auto-updating)</span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={preferences.generalPrice}
                onChange={(e) => setPreferences(prev => ({ ...prev, generalPrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.30"
                disabled={preferences.pricingMode === 'dynamic'}
                className={preferences.pricingMode === 'dynamic' ? 'bg-gray-100' : ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feed-In Tariff (per kWh)
                {preferences.pricingMode === 'dynamic' && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(Auto-updating)</span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={preferences.feedInTariff}
                onChange={(e) => setPreferences(prev => ({ ...prev, feedInTariff: parseFloat(e.target.value) || 0 }))}
                placeholder="0.08"
                disabled={preferences.pricingMode === 'dynamic'}
                className={preferences.pricingMode === 'dynamic' ? 'bg-gray-100' : ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-blue-900 mb-2">How It Works</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Grid Cost:</strong> Grid import × General price = Cost from grid</li>
              <li><strong>Solar Savings:</strong> Solar used directly × General price = Money saved</li>
              <li><strong>Export Earnings:</strong> Grid export × Feed-in tariff = Income from solar</li>
              <li><strong>Net Cost:</strong> Grid cost - Export earnings = Your actual energy cost</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} className="px-8">
          Save Energy Pricing
        </Button>
      </div>
    </div>
  );
}
