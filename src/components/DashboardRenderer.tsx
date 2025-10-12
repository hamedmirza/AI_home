import React from 'react';
import type { DashboardConfig } from '../types/cards';
import { renderCard } from '../services/cardRegistry';

interface DashboardRendererProps {
  config: DashboardConfig;
}

export function DashboardRenderer({ config }: DashboardRendererProps) {
  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="text-2xl font-bold text-gray-900 mb-6">{config.title}</div>

      <div
        className="grid gap-4 auto-rows-[150px]"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'
        }}
      >
        {config.cards.map((card) => (
          <div
            key={card.id}
            style={{
              gridColumn: `span ${card.cols || 2}`,
              gridRow: `span ${card.rows || 1}`
            }}
            className="min-h-0"
          >
            {renderCard(card)}
          </div>
        ))}
      </div>

      {config.cards.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg mb-2">No cards on this dashboard</p>
            <p className="text-gray-400 text-sm">Add cards to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
