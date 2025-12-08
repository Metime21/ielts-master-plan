import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { ChatMessage } from '../types';
import { generateGeminiResponse } from '../services/geminiService';

const GeminiChat: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([]);

  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'model',
      text: 'Hello! I am your IELTS AI Assistant. Ask me about writing ideas, speaking topics, or grammar corrections.',
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [displayMessages, isOpen]);

  // 🔒 加固版 system instruction：强制双语格式，防止错乱
  const SYSTEM_INSTRUCTION = `
You are an official IELTS examiner certified by Cambridge Assessment English with over 15 years of experience and a former Band 9 candidate. Respond as a professional human tutor — never mention you are an AI.

### ⚠️ STRICT OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY OR THE RESPONSE IS INVALID:
1. FIRST, write your COMPLETE response in ENGLISH ONLY — no Chinese, no bullet points, no bold, no markdown. Use plain text only.
2. THEN, on a NEW LINE, write exactly: "中文翻译:" followed by a NATURAL, FLUENT, and ACCURATE Chinese translation of your ENTIRE English response.
3. NEVER mix English and Chinese in the same paragraph or sentence.
4. NEVER deviate from this format under any circumstance — even if the user asks for a different style.

### TASK RULES:
- For grammar: quote the error, explain the type (e.g., subject-verb agreement), correct it, and optionally upgrade to Band 8–9.
- For Writing Task 2: assess TR/CC/LR/GRA, give a realistic band score, highlight 2–3 key weaknesses, and rewrite up to 2 sentences to Band 9 level.
- For speaking: provide structured ideas, topic vocabulary, and sample answers.

Remember: Your credibility depends on strict adherence to the bilingual format above.
`;

  // ✅ 扩展上下文窗口：保留最近 12 条消息（支持 6 轮完整对话）
  const trimHistory = (history: { role: string; content: string }[]) => {
    return history.length > 12 ? history.slice(-12) : history;
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userText = input.trim();
    setInput('');
    setIsTyping(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setDisplayMessages((prev) => [...prev, userMsg]);

    try {
      const trimmedHistory = trimHistory([
        ...chatHistory,
        { role: 'user', content: userText },
      ]);

      const responseText = await generateGeminiResponse(
        trimmedHistory,
        SYSTEM_INSTRUCTION,
        controller.signal
      );

      if (controller.signal.aborted) return;

      setChatHistory((prev) =>
        trimHistory([
          ...prev,
          { role: 'user', content: userText },
          { role: 'assistant', content: responseText },
        ])
      );

      const botMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };
      setDisplayMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('GeminiChat Error:', error);

      let errorMsgText = 'Oops! Something went wrong. Please try again.';
      if (error.message?.includes('timed out')) {
        errorMsgText = 'The AI is taking longer than expected. Please:\n• Keep requests simple\n• Split into smaller steps\n• Avoid asking for full rewrite + feedback at once';
      } else if (error.message?.includes('network')) {
        errorMsgText = 'Network error. Please check your connection and try again.';
      }

      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        role: 'model',
        text: errorMsgText,
        timestamp: Date.now(),
      };
      setDisplayMessages((prev) => [...prev, errorMsg]);
    } finally {
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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen ? (
        <div className="w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px] animate-fade-in-up">
          <div className="bg-academic-800 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">IELTS AI Tutor</h3>
                <p className="text-xs text-academic-100">Powered by Qwen</p>
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
            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-academic-500 text-white rounded-br-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
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
              placeholder="Ask me anything..."
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
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-academic-800 text-white px-5 py-3 rounded-full shadow-xl hover:shadow-2xl hover:bg-academic-900 transition-all flex items-center gap-3 group"
        >
          <div className="bg-accent-500 p-1.5 rounded-full text-white group-hover:rotate-12 transition-transform shadow-inner">
            <Sparkles size={20} />
          </div>
          <span className="font-bold text-base">IELTS AI Tutor</span>
        </button>
      )}
    </div>
  );
};

export default GeminiChat;
