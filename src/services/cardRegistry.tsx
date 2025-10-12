import React from 'react';
import type { AnyCard } from '../types/cards';
import { EnergyFlowCard } from '../components/cards/EnergyFlowCard';
import { TimeseriesCard } from '../components/cards/TimeseriesCard';
import { LLMAskCard } from '../components/cards/LLMAskCard';
import { EntityTableCard } from '../components/cards/EntityTableCard';
import { DashboardCard } from '../components/dashboard/DashboardCard';

export function renderCard(card: AnyCard): React.ReactNode {
  switch (card.type) {
    case 'energy-flow':
      return <EnergyFlowCard key={card.id} cfg={card} />;

    case 'timeseries':
      return <TimeseriesCard key={card.id} cfg={card} />;

    case 'llm-ask':
      return <LLMAskCard key={card.id} cfg={card} />;

    case 'entity-table':
      return <EntityTableCard key={card.id} cfg={card} />;

    case 'entity':
    case 'light':
    case 'gauge':
    case 'sensor':
    case 'thermostat':
    case 'button':
    case 'grid':
      const entities: any[] = [];
      return (
        <DashboardCard
          key={card.id}
          card={{
            id: card.id,
            dashboard_id: '',
            card_type: card.type,
            title: card.title,
            entity_ids: [],
            config: {},
            position: { x: 0, y: 0, w: card.cols || 2, h: card.rows || 1 },
            created_at: '',
            updated_at: ''
          }}
          entities={entities}
        />
      );

    default:
      return (
        <div key={card.id} className="h-full w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-600">Card type: {card.type}</p>
            <p className="text-xs text-gray-500 mt-1">Under development</p>
          </div>
        </div>
      );
  }
}
