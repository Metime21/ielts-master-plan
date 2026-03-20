import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X, Plus } from 'lucide-react';
import { generateGeminiResponse } from '../services/geminiService';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: ConversationMessage[];
};

const STORAGE_KEY = 'ielts-conversations';
const MAX_CONVERSATIONS = 7;

const SYSTEM_INSTRUCTION = `
You are a Cambridge IELTS examiner. Always:
1. Respond in English first.
2. Then write exactly: "中文翻译:" followed by a natural Chinese translation.
3. For essays: assess TR, CC, LR, GRA; give a realistic band score; highlight 2-3 weaknesses; rewrite up to 2 sentences to Band 9.
4. For grammar: quote error, explain type, correct it, optionally upgrade.
5. For speaking: provide ideas, vocabulary, sample answers.
No markdown. No mixed languages. Keep under 600 words.
`;

const isConversationArray = (value: unknown): value is Conversation[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const candidate = item as Conversation;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.createdAt === 'number' &&
      Array.isArray(candidate.messages) &&
      candidate.messages.every(
        (message) =>
          message &&
          typeof message === 'object' &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
      )
    );
  });
};

const loadStoredConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return isConversationArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse saved conversations:', error);
    return [];
  }
};

const persistConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.warn('Failed to save conversations:', error);
  }
};

const createConversationRecord = (): Conversation => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'New Chat',
  createdAt: Date.now(),
  messages: [],
});

const GeminiChat: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentConv = conversations.find((conversation) => conversation.id === currentConvId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const smartTrimContext = (messages: ConversationMessage[]) => {
    return messages.length > 4 ? messages.slice(-4) : messages;
  };

  const createNewConversation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const newConv = createConversationRecord();
    setConversations((prev) => [newConv, ...prev].slice(0, MAX_CONVERSATIONS));
    setCurrentConvId(newConv.id);
    setInput('');
    setIsTyping(false);
  };

  useEffect(() => {
    const savedConversations = loadStoredConversations();

    if (savedConversations.length > 0) {
      setConversations(savedConversations);
      setCurrentConvId(savedConversations[0].id);
    } else {
      const newConv = createConversationRecord();
      setConversations([newConv]);
      setCurrentConvId(newConv.id);
    }

    setHasLoadedConversations(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedConversations) {
      return;
    }

    persistConversations(conversations);
  }, [conversations, hasLoadedConversations]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, currentConvId, conversations, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || !currentConvId) {
      return;
    }

    const activeConversation = conversations.find((conversation) => conversation.id === currentConvId);
    if (!activeConversation) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userText = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      const contextForAI = smartTrimContext([
        ...activeConversation.messages,
        { role: 'user', content: userText },
      ]);

      const responseText = await generateGeminiResponse(
        contextForAI,
        SYSTEM_INSTRUCTION,
        controller.signal
      );

      if (controller.signal.aborted) {
        return;
      }

      const newTitle =
        activeConversation.title === 'New Chat'
          ? `${userText.substring(0, 20)}${userText.length > 20 ? '...' : ''}`
          : activeConversation.title;

      const updatedMessages: ConversationMessage[] = [
        ...activeConversation.messages,
        { role: 'user', content: userText },
        { role: 'assistant', content: responseText },
      ];

      const updatedConv: Conversation = {
        ...activeConversation,
        title: newTitle,
        messages: updatedMessages,
      };

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === currentConvId ? updatedConv : conversation
        )
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('GeminiChat Error:', error);

      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

      let errorMsgText = 'Oops! Something went wrong. Please try again.';
      if (message.includes('timed out')) {
        errorMsgText =
          'The AI is taking longer than expected. This is normal for full essay analysis with qwen-max. Please wait up to 45 seconds, or check your internet connection.';
      } else if (message.includes('network')) {
        errorMsgText = 'Network error. Please check your connection and try again.';
      } else if (message.includes('proxy failed')) {
        errorMsgText = 'The AI service is temporarily unavailable. Please try again in a moment.';
      }

      const updatedConv: Conversation = {
        ...activeConversation,
        messages: [
          ...activeConversation.messages,
          { role: 'user', content: userText },
          { role: 'assistant', content: errorMsgText },
        ],
      };

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === currentConvId ? updatedConv : conversation
        )
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="flex w-full max-w-4xl h-[90vh] mt-6 mr-6">
          <div className="w-64 bg-gray-50 border-r border-gray-200 rounded-l-2xl overflow-hidden flex flex-col">
            <button
              onClick={createNewConversation}
              className="p-3 text-left font-bold text-academic-800 hover:bg-academic-50 flex items-center gap-2 border-b border-gray-200"
            >
              <Plus size={16} />
              New Chat
            </button>
            <div className="flex-1 overflow-y-auto py-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setCurrentConvId(conv.id)}
                  className={`w-full text-left px-3 py-2 text-sm truncate ${
                    conv.id === currentConvId
                      ? 'bg-academic-100 text-academic-800 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {conv.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-r-2xl shadow-2xl flex flex-col">
            <div className="bg-academic-800 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">IELTS AI Tutor</h3>
                  <p className="text-xs text-academic-100">Powered by qwen-max</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                title="Collapse Chat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {currentConv &&
                (currentConv.messages.length === 0 ? (
                  <div className="flex justify-start">
                    <div className="bg-white px-4 py-2.5 rounded-2xl rounded-bl-none text-sm text-slate-700 border border-slate-100">
                      Hello! I am your IELTS AI Assistant. You can send a full essay for professional feedback.
                    </div>
                  </div>
                ) : (
                  currentConv.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-academic-500 text-white rounded-br-none'
                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none text-xs text-slate-400 border border-slate-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Send your full IELTS essay or question..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-academic-500"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="bg-accent-500 hover:bg-accent-600 text-white p-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 bg-academic-800 text-white px-5 py-3 rounded-full shadow-xl hover:shadow-2xl hover:bg-academic-900 transition-all flex items-center gap-3 group z-50"
    >
      <div className="bg-accent-500 p-1.5 rounded-full text-white group-hover:rotate-12 transition-transform shadow-inner">
        <Sparkles size={20} />
      </div>
      <span className="font-bold text-base">IELTS AI Tutor</span>
    </button>
  );
};

export default GeminiChat;
