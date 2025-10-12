import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import type { EntityTableCard as EntityTableCardType } from '../../types/cards';
import { dbService } from '../../services/database';

export function EntityTableCard({ cfg }: { cfg: EntityTableCardType }) {
  const [entities, setEntities] = useState<any[]>([]);

  async function fetchData() {
    try {
      const allEntities = await dbService.getEntities();
      const filtered = allEntities.filter(e => cfg.entities.includes(e.entity_id));
      setEntities(filtered);
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, (cfg.refreshSeconds || 30) * 1000);
    return () => clearInterval(interval);
  }, [cfg]);

  return (
    <Card className="h-full p-4 overflow-auto">
      <h3 className="font-semibold text-gray-900 mb-3">{cfg.title || 'Entities'}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 text-gray-600 font-medium">Entity</th>
            <th className="text-right py-2 text-gray-600 font-medium">State</th>
            <th className="text-right py-2 text-gray-600 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr key={entity.entity_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 text-gray-900">{entity.friendly_name || entity.entity_id}</td>
              <td className="py-2 text-right font-medium text-gray-900">
                {entity.state} {entity.unit_of_measurement || ''}
              </td>
              <td className="py-2 text-right text-gray-500 text-xs">
                {new Date(entity.last_changed || Date.now()).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entities.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-8">No entities configured</p>
      )}
    </Card>
  );
}
