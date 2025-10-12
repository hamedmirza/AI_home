import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { DashboardRenderer } from './DashboardRenderer';
import { CardSelector } from './dashboard/CardSelector';
import { dashboardService } from '../services/dashboardService';
import { defaultDashboard } from '../config/defaultDashboard';
import type { DashboardConfig } from '../types/cards';
import type { CardType } from '../services/dashboardService';

export function SmartDashboard() {
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<DashboardConfig>(defaultDashboard);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboards();
  }, []);

  async function loadDashboards() {
    try {
      const dbs = await dashboardService.listDashboards();
      setDashboards(dbs);

      if (dbs.length > 0) {
        const cards = await dashboardService.getDashboardCards(dbs[0].id);
        setActiveDashboard({
          title: dbs[0].name,
          cards: cards.map(card => ({
            id: card.id,
            type: card.card_type as any,
            title: card.title,
            cols: card.position.w,
            rows: card.position.h,
            ...card.config
          }))
        });
      }
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createDashboard() {
    try {
      const dashboard = await dashboardService.createDashboard({
        name: 'New Dashboard',
        description: 'Custom dashboard',
        icon: 'layout-dashboard',
        layout: []
      });

      await loadDashboards();
      alert('Dashboard created successfully!');
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      alert('Failed to create dashboard');
    }
  }

  function handleAddCard(cardType: CardType) {
    console.log('Adding card:', cardType);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading dashboards...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <LayoutDashboard className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Smart Dashboards</h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowCardSelector(true)}
              variant="secondary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>

            <Button onClick={createDashboard}>
              <Plus className="w-4 h-4 mr-2" />
              New Dashboard
            </Button>
          </div>
        </div>

        {dashboards.length > 0 && (
          <div className="flex space-x-2 mt-4 overflow-x-auto">
            {dashboards.map(db => (
              <button
                key={db.id}
                onClick={() => {
                  setActiveDashboard({
                    title: db.name,
                    cards: []
                  });
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeDashboard.title === db.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {db.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <DashboardRenderer config={activeDashboard} />
      </div>

      {showCardSelector && (
        <CardSelector
          onSelectCard={handleAddCard}
          onClose={() => setShowCardSelector(false)}
        />
      )}
    </div>
  );
}
