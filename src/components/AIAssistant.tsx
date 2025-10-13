import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Lightbulb, Zap, Home, Settings as SettingsIcon, Activity, ThumbsUp, ThumbsDown, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { homeAssistantService } from '../services/homeAssistant';
import { dbService } from '../services/database';
import { syncService } from '../services/syncService';

interface AIAssistantProps {
  isConnected: boolean;
  onEntityUpdate?: () => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  feedback?: 'up' | 'down' | null;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  provider?: string;
}

const SESSION_ID = 'main-session';

export function AIAssistant({ isConnected, onEntityUpdate }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        console.log('[AIAssistant] Loading chat history...');

        const history = await dbService.getChatHistory(SESSION_ID, 100);
        console.log('[AIAssistant] Loaded', history.length, 'messages');

        const loadedMessages = history.map(msg => ({
          id: msg.id,
          text: msg.content,
          isUser: msg.role === 'user',
          timestamp: new Date(msg.created_at),
          feedback: msg.metadata?.feedback || null,
          tokenUsage: msg.metadata?.tokenUsage || undefined,
          provider: msg.metadata?.provider || undefined,
        }));

        setMessages(loadedMessages);
      } catch (error) {
        console.error('[AIAssistant] Error loading chat history:', error);
        setMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    const initializeSyncs = async () => {
      try {
        await syncService.startEntitySync(5);
        await syncService.startHistoryTracking(1);
      } catch (error) {
        console.error('Error starting sync services:', error);
      }
    };

    if (isConnected) {
      loadChatHistory();
      initializeSyncs();
    } else {
      setMessages([]);
      setIsLoadingHistory(false);
    }

    return () => {
      syncService.stopEntitySync();
      syncService.stopHistoryTracking();
    };
  }, [isConnected]);

  // Real-time sync with FloatingChat using Supabase subscriptions
  useEffect(() => {
    if (!isConnected) return;

    const supabase = dbService.getClient();

    // Subscribe to new messages and updates
    const channel = supabase
      .channel('main-session-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${SESSION_ID}`
        },
        (payload) => {
          console.log('[AIAssistant] New message received:', payload.new);

          const newMessage: Message = {
            id: payload.new.id,
            text: payload.new.content,
            isUser: payload.new.role === 'user',
            timestamp: new Date(payload.new.created_at),
            feedback: payload.new.metadata?.feedback || null,
            tokenUsage: payload.new.metadata?.tokenUsage || undefined,
            provider: payload.new.metadata?.provider || undefined,
          };

          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) {
              console.log('[AIAssistant] Message already exists, skipping');
              return prev;
            }
            console.log('[AIAssistant] Adding new message to state');
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${SESSION_ID}`
        },
        (payload) => {
          console.log('[AIAssistant] Message updated (feedback):', payload.new);

          setMessages(prev => prev.map(msg =>
            msg.id === payload.new.id
              ? { ...msg, feedback: payload.new.metadata?.feedback || null }
              : msg
          ));
        }
      )
      .subscribe((status) => {
        console.log('[AIAssistant] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !isConnected || isLoading) return;

    const userMessageContent = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      await dbService.addChatMessage(SESSION_ID, 'user', userMessageContent);

      let entities = [];
      try {
        const cachedEntities = await syncService.getEntityFromCache('');
        if (cachedEntities) {
          entities = await dbService.getEntities();
        } else {
          entities = await homeAssistantService.getEntities();
        }
      } catch (error) {
        console.warn('Could not fetch entities for AI context:', error);
        entities = await homeAssistantService.getEntities();
      }

      const aiResponse = await homeAssistantService.processAICommand(userMessageContent, entities);

      console.log('[AIAssistant] Token usage:', aiResponse.tokenUsage);

      await dbService.addChatMessage(SESSION_ID, 'assistant', aiResponse.text, {
        tokenUsage: aiResponse.tokenUsage,
        provider: aiResponse.provider
      });

      if (onEntityUpdate && (userMessageContent.toLowerCase().includes('turn on') ||
          userMessageContent.toLowerCase().includes('turn off') ||
          userMessageContent.toLowerCase().includes('set') ||
          userMessageContent.toLowerCase().includes('toggle'))) {
        setTimeout(() => onEntityUpdate(), 1500);
      }
    } catch (error) {
      const errorMessage = "I'm your AI assistant, ready to help with your smart home! I can control devices, create dashboards, analyze energy usage, and provide technical guidance. What would you like to do?";
      await dbService.addChatMessage(SESSION_ID, 'assistant', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'up' | 'down') => {
    // Update UI immediately
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ));

    try {
      const supabase = dbService.getClient();

      // Get current message to merge metadata
      const { data: currentMsg } = await supabase
        .from('chat_messages')
        .select('metadata')
        .eq('id', messageId)
        .single();

      const currentMetadata = currentMsg?.metadata || {};

      // Update with merged metadata
      await supabase
        .from('chat_messages')
        .update({
          metadata: {
            ...currentMetadata,
            feedback,
            feedback_timestamp: new Date().toISOString()
          }
        })
        .eq('id', messageId);

      console.log('[AIAssistant] Feedback saved:', { messageId, feedback });
    } catch (error) {
      console.error('[AIAssistant] Failed to save feedback:', error);
    }
  };

  const quickActions = [
    { icon: Lightbulb, text: "Turn on living room lights", action: "Turn on the living room lights" },
    { icon: Zap, text: "Show energy usage", action: "Show me today's energy consumption" },
    { icon: Activity, text: "Create dashboard", action: "Help me create a new dashboard for my bedroom" },
    { icon: SettingsIcon, text: "System status", action: "What's the current status of my smart home system?" }
  ];

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center max-w-md">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">AI Assistant Unavailable</h3>
          <p className="text-gray-600">
            Please connect to Home Assistant first to use the AI assistant.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Assistant</h2>
              <p className="text-sm text-gray-600">Powered by Grok AI - Always Connected</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
                  return;
                }
                try {
                  await dbService.clearChatHistory(SESSION_ID);
                  setMessages([]);
                  console.log('[AIAssistant] Chat history cleared');
                } catch (error) {
                  console.error('Error clearing chat history:', error);
                  alert('Failed to clear chat history. Please try again.');
                }
              }}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={async () => {
                setIsLoadingHistory(true);
                try {
                  const history = await dbService.getChatHistory(SESSION_ID, 100);
                  const loadedMessages = history.map(msg => ({
                    id: msg.id,
                    text: msg.content,
                    isUser: msg.role === 'user',
                    timestamp: new Date(msg.created_at),
                    feedback: msg.metadata?.feedback || null,
                    tokenUsage: msg.metadata?.tokenUsage || undefined,
                    provider: msg.metadata?.provider || undefined,
                  }));
                  setMessages(loadedMessages);
                } catch (error) {
                  console.error('Error refreshing chat history:', error);
                } finally {
                  setIsLoadingHistory(false);
                }
              }}
              disabled={isLoadingHistory}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh chat history"
            >
              <RefreshCw className={`w-5 h-5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="p-4 bg-white border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => setInputText(action.action)}
                className="flex items-center space-x-2 p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <action.icon className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{action.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading chat history...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-sm">Start a conversation with your AI assistant!</p>
            </div>
          </div>
        ) : null}

        {!isLoadingHistory && messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-[80%] ${message.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.isUser 
                  ? 'bg-blue-600' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                {message.isUser ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="flex flex-col">
                <div className={`rounded-lg p-3 ${
                  message.isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.isUser ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {!message.isUser && message.tokenUsage && (
                    <div className="flex items-center gap-2 text-xs mt-1.5 text-gray-500 border-t border-gray-100 pt-1.5">
                      <span className="font-medium">Tokens:</span>
                      <span className="text-blue-600">{message.tokenUsage.inputTokens} in</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-purple-600">{message.tokenUsage.outputTokens} out</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-700 font-medium">{message.tokenUsage.totalTokens} total</span>
                      {message.provider && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          {message.provider}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!message.isUser && (
                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      onClick={() => handleFeedback(message.id, 'up')}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        message.feedback === 'up' ? 'text-green-600' : 'text-gray-400'
                      }`}
                      title="Good response"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'down')}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        message.feedback === 'down' ? 'text-red-600' : 'text-gray-400'
                      }`}
                      title="Bad response"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-2 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your smart home..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className="px-4"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}