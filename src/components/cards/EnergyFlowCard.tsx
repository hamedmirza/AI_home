import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Zap, Home, Battery, Grid3x3 } from 'lucide-react';
import type { EnergyFlowCard as EnergyFlowCardType } from '../../types/cards';
import { dbService } from '../../services/database';

export function EnergyFlowCard({ cfg }: { cfg: EnergyFlowCardType }) {
  const [data, setData] = useState<any>(null);

  async function fetchData() {
    try {
      const entities = await dbService.getEntities();

      const pvEntity = entities.find(e => e.entity_id === cfg.entities.pv);
      const gridEntity = entities.find(e => e.entity_id === cfg.entities.grid);
      const batteryEntity = cfg.entities.battery ? entities.find(e => e.entity_id === cfg.entities.battery) : null;
      const houseEntity = entities.find(e => e.entity_id === cfg.entities.house);

      const pv_w = pvEntity ? parseFloat(pvEntity.state) || 0 : 0;
      const grid_w = gridEntity ? parseFloat(gridEntity.state) || 0 : 0;
      const battery_w = batteryEntity ? parseFloat(batteryEntity.state) || 0 : 0;
      const house_w = houseEntity ? parseFloat(houseEntity.state) || 0 : 0;

      const note = grid_w >= 0 ? 'Importing from grid' : 'Exporting to grid';

      setData({ pv_w, grid_w, battery_w, house_w, note });
    } catch (error) {
      console.error('Failed to fetch energy flow:', error);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, (cfg.refreshSeconds || 15) * 1000);
    return () => clearInterval(interval);
  }, [cfg]);

  if (!data) {
    return (
      <Card className="h-full p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </Card>
    );
  }

  return (
    <Card className="h-full p-4">
      <h3 className="font-semibold text-gray-900 mb-4">{cfg.title || 'Energy Flow'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <FlowCell icon={<Zap className="w-5 h-5 text-yellow-600" />} label="Solar" value={`${data.pv_w.toFixed(0)} W`} />
        <FlowCell icon={<Home className="w-5 h-5 text-blue-600" />} label="House" value={`${data.house_w.toFixed(0)} W`} />
        {cfg.entities.battery && (
          <FlowCell icon={<Battery className="w-5 h-5 text-green-600" />} label="Battery" value={`${data.battery_w.toFixed(0)} W`} />
        )}
        <FlowCell
          icon={<Grid3x3 className="w-5 h-5 text-gray-600" />}
          label="Grid"
          value={`${Math.abs(data.grid_w).toFixed(0)} W`}
          badge={data.grid_w >= 0 ? 'Import' : 'Export'}
          badgeColor={data.grid_w >= 0 ? 'red' : 'green'}
        />
      </div>
      <p className="mt-4 text-xs text-gray-600">{data.note}</p>
    </Card>
  );
}

function FlowCell({ icon, label, value, badge, badgeColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: 'red' | 'green';
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-400 transition-colors">
      <div className="flex items-center space-x-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {badge && (
        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
          badgeColor === 'red' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {badge}
        </span>
      )}
    </div>
  );
}
