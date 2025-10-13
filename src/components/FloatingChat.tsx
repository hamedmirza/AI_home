import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageCircle, X, Minimize2, Maximize2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { homeAssistantService } from '../services/homeAssistant';
import { dbService } from '../services/database';
import { syncService } from '../services/syncService';

interface FloatingChatProps {
  isConnected: boolean;
  onEntityUpdate?: () => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  feedback?: 'up' | 'down' | null;
  responseTime?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  provider?: string;
}

const SESSION_ID = 'main-session';

export function FloatingChat({ isConnected, onEntityUpdate }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (force: boolean = false) => {
    setTimeout(() => {
      if (force) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 150);
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom(true);
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isConnected) {
      setMessages([]);
      return;
    }

    const loadChatHistory = async () => {
      try {
        console.log('[FloatingChat] Loading chat history...');

        const history = await dbService.getChatHistory(SESSION_ID, 100);
        console.log('[FloatingChat] Loaded', history.length, 'messages');

        const loadedMessages = history.map(msg => ({
          id: msg.id,
          text: msg.content,
          isUser: msg.role === 'user',
          timestamp: new Date(msg.created_at),
          feedback: msg.metadata?.feedback || null,
          responseTime: msg.metadata?.responseTime || undefined,
          tokenUsage: msg.metadata?.tokenUsage || undefined,
          provider: msg.metadata?.provider || undefined,
        }));

        setMessages(loadedMessages);

        setTimeout(() => scrollToBottom(true), 300);
      } catch (error) {
        console.error('[FloatingChat] Error loading chat history:', error);
        setMessages([]);
      }
    };

    loadChatHistory();
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    const supabase = dbService.getClient();

    const channel = supabase
      .channel('floating-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${SESSION_ID}`
        },
        (payload) => {
          console.log('[FloatingChat] New message received:', payload.new);

          const newMessage: Message = {
            id: payload.new.id,
            text: payload.new.content,
            isUser: payload.new.role === 'user',
            timestamp: new Date(payload.new.created_at),
            feedback: payload.new.metadata?.feedback || null,
            responseTime: payload.new.metadata?.responseTime || undefined,
            tokenUsage: payload.new.metadata?.tokenUsage || undefined,
            provider: payload.new.metadata?.provider || undefined,
          };

          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) {
              console.log('[FloatingChat] Message already exists, skipping');
              return prev;
            }
            console.log('[FloatingChat] Adding new message to state');
            return [...prev, newMessage];
          });

          if (!isOpen && !newMessage.isUser) {
            setUnreadCount(prev => prev + 1);
          }
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
          console.log('[FloatingChat] Message updated (feedback):', payload.new);

          setMessages(prev => prev.map(msg =>
            msg.id === payload.new.id
              ? { ...msg, feedback: payload.new.metadata?.feedback || null }
              : msg
          ));
        }
      )
      .subscribe((status) => {
        console.log('[FloatingChat] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isConnected, isOpen]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !isConnected || isLoading) return;

    const userMessageContent = inputText;
    setInputText('');
    setIsLoading(true);

    const startTime = performance.now();

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

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      console.log('[FloatingChat] Response time:', responseTime, 'ms');
      console.log('[FloatingChat] Token usage:', aiResponse.tokenUsage);

      await dbService.addChatMessage(SESSION_ID, 'assistant', aiResponse.text, {
        responseTime,
        tokenUsage: aiResponse.tokenUsage,
        provider: aiResponse.provider
      });

      if (onEntityUpdate && (userMessageContent.toLowerCase().includes('turn on') ||
          userMessageContent.toLowerCase().includes('turn off') ||
          userMessageContent.toLowerCase().includes('set') ||
          userMessageContent.toLowerCase().includes('toggle'))) {
        setTimeout(() => onEntityUpdate?.(), 1500);
      }
    } catch (error) {
      console.error('[FloatingChat] Error sending message:', error);
      const errorMessage = "I'm having trouble processing that request. Please try again.";
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

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  if (!isConnected) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
        >
          <MessageCircle className="w-7 h-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl z-50 flex flex-col transition-all duration-300 ${
          isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
        }`}>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Assistant</h3>
                <p className="text-xs text-blue-100">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm mt-8">
                    <Bot className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Start a conversation!</p>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start space-x-2 max-w-[75%] ${message.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.isUser
                          ? 'bg-blue-600'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600'
                      }`}>
                        {message.isUser ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div>
                        <div className={`rounded-lg p-2.5 ${
                          message.isUser
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 shadow-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                          <div className={`flex items-center justify-between text-xs mt-1 ${
                            message.isUser ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            <span>
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!message.isUser && message.responseTime && (
                              <span className="ml-2 text-green-600 font-medium">
                                {message.responseTime < 1000
                                  ? `${message.responseTime}ms`
                                  : `${(message.responseTime / 1000).toFixed(1)}s`}
                              </span>
                            )}
                          </div>
                          {!message.isUser && message.tokenUsage && (
                            <div className="flex items-center gap-2 text-xs mt-1 text-gray-500">
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
                          <div className="flex items-center space-x-1 mt-1">
                            <button
                              onClick={async () => {
                                try {
                                  await dbService.updateChatMessageFeedback(message.id, 'up');
                                  setMessages(prev => prev.map(m =>
                                    m.id === message.id ? { ...m, feedback: 'up' } : m
                                  ));
                                } catch (error) {
                                  console.error('Error updating feedback:', error);
                                }
                              }}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                message.feedback === 'up' ? 'text-green-600' : 'text-gray-400'
                              }`}
                              title="Good response"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await dbService.updateChatMessageFeedback(message.id, 'down');
                                  setMessages(prev => prev.map(m =>
                                    m.id === message.id ? { ...m, feedback: 'down' } : m
                                  ));
                                } catch (error) {
                                  console.error('Error updating feedback:', error);
                                }
                              }}
                              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                message.feedback === 'down' ? 'text-red-600' : 'text-gray-400'
                              }`}
                              title="Bad response"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm">
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

              <div className="p-3 bg-white border-t border-gray-200 rounded-b-lg">
                <div className="flex space-x-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 text-sm"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isLoading}
                    className="px-3 py-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
