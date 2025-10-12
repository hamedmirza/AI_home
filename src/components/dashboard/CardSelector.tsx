import React, { useState } from 'react';
import {
  Plus,
  ToggleLeft,
  List,
  Gauge,
  TrendingUp,
  Activity,
  Thermometer,
  Cloud,
  Lightbulb,
  Play,
  Zap,
  FileText,
  Square,
  Image,
  Grid
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CardType } from '../../services/dashboardService';

interface CardSelectorProps {
  onSelectCard: (cardType: CardType) => void;
  onClose: () => void;
}

export function CardSelector({ onSelectCard, onClose }: CardSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const cardTypes: Array<{ type: CardType; icon: React.ReactNode; name: string; description: string; category: string }> = [
    { type: 'entity', icon: <ToggleLeft className="w-6 h-6" />, name: 'Entity', description: 'Single entity control', category: 'Basic' },
    { type: 'entities', icon: <List className="w-6 h-6" />, name: 'Entities', description: 'Multiple entities list', category: 'Basic' },
    { type: 'light', icon: <Lightbulb className="w-6 h-6" />, name: 'Light', description: 'Light with brightness control', category: 'Controls' },
    { type: 'thermostat', icon: <Thermometer className="w-6 h-6" />, name: 'Thermostat', description: 'Climate control card', category: 'Controls' },
    { type: 'media-control', icon: <Play className="w-6 h-6" />, name: 'Media Player', description: 'Media playback control', category: 'Controls' },
    { type: 'gauge', icon: <Gauge className="w-6 h-6" />, name: 'Gauge', description: 'Visual gauge for sensors', category: 'Visualization' },
    { type: 'history-graph', icon: <TrendingUp className="w-6 h-6" />, name: 'History Graph', description: 'Entity history chart', category: 'Visualization' },
    { type: 'sensor', icon: <Activity className="w-6 h-6" />, name: 'Sensor', description: 'Sensor value display', category: 'Monitoring' },
    { type: 'weather', icon: <Cloud className="w-6 h-6" />, name: 'Weather', description: 'Weather forecast card', category: 'Monitoring' },
    { type: 'energy', icon: <Zap className="w-6 h-6" />, name: 'Energy', description: 'Energy monitoring', category: 'Monitoring' },
    { type: 'button', icon: <Square className="w-6 h-6" />, name: 'Button', description: 'Action button', category: 'Interactive' },
    { type: 'markdown', icon: <FileText className="w-6 h-6" />, name: 'Markdown', description: 'Custom text content', category: 'Other' },
    { type: 'picture', icon: <Image className="w-6 h-6" />, name: 'Picture', description: 'Image display', category: 'Other' },
    { type: 'grid', icon: <Grid className="w-6 h-6" />, name: 'Grid', description: 'Entity grid layout', category: 'Layout' }
  ];

  const filtered = cardTypes.filter(
    card =>
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(filtered.map(c => c.category)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Add Card</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search card types..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {categories.map(category => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered
                  .filter(card => card.category === category)
                  .map(card => (
                    <button
                      key={card.type}
                      onClick={() => {
                        onSelectCard(card.type);
                        onClose();
                      }}
                      className="group p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 text-left"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="text-gray-600 group-hover:text-blue-600 transition-colors">
                          {card.icon}
                        </div>
                        <span className="font-semibold text-gray-900">{card.name}</span>
                      </div>
                      <p className="text-sm text-gray-600">{card.description}</p>
                    </button>
                  ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No card types match your search</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
