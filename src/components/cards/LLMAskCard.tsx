import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Send, Sparkles } from 'lucide-react';
import type { LLMAskCard as LLMAskCardType } from '../../types/cards';
import { homeAssistantService } from '../../services/homeAssistant';

export function LLMAskCard({ cfg }: { cfg: LLMAskCardType }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;

    setLoading(true);
    try {
      const response = await homeAssistantService.chat(question);
      setAnswer(response);
    } catch (error) {
      setAnswer('Failed to get response. Please try again.');
      console.error('LLM ask error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full p-4 flex flex-col">
      <div className="flex items-center space-x-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">{cfg.title || 'Ask Energy AI'}</h3>
      </div>

      <textarea
        className="flex-1 border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g., When should I run the dishwasher to minimize cost?"
        disabled={loading}
      />

      <Button
        onClick={ask}
        disabled={loading || !question.trim()}
        className="w-full mb-3"
      >
        <Send className="w-4 h-4 mr-2" />
        {loading ? 'Thinking...' : 'Ask'}
      </Button>

      {answer && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm whitespace-pre-wrap overflow-auto">
          {answer}
        </div>
      )}
    </Card>
  );
}
