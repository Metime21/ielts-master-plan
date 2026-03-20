import React, { useEffect, useState } from 'react';
import { CalendarClock, Sparkles } from 'lucide-react';

const QUOTES = [
  { en: "Believe you can and you're halfway there.", cn: '相信你自己，你已经成功了一半。' },
  { en: "Don't watch the clock; do what it does. Keep going.", cn: '别盯着钟表；像它一样，坚持前行。' },
  { en: 'The future depends on what you do today.', cn: '未来取决于你今天做了什么。' },
  { en: 'Success is the sum of small efforts, repeated day in and day out.', cn: '成功是每天重复的小努力的总和。' },
  { en: 'Dream big and dare to fail.', cn: '敢于梦想，敢于失败。' },
];

const TARGET_DATE = {
  year: 2026,
  month: 3,
  day: 7,
};

const getDaysLeft = (): number => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDate = new Date(TARGET_DATE.year, TARGET_DATE.month - 1, TARGET_DATE.day).getTime();
  const distance = targetDate - todayStart;
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

const getDailyQuote = () => {
  const now = new Date();
  const daySeed = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / (1000 * 60 * 60 * 24)
  );
  return QUOTES[daySeed % QUOTES.length];
};

const Header: React.FC = () => {
  const [daysLeft, setDaysLeft] = useState<number>(getDaysLeft);
  const [quote, setQuote] = useState(getDailyQuote);

  useEffect(() => {
    const updateHeaderState = () => {
      setDaysLeft(getDaysLeft());
      setQuote(getDailyQuote());
    };

    updateHeaderState();
    const interval = setInterval(updateHeaderState, 1000 * 60 * 60);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-academic-800 text-white shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={120} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center space-x-3 z-10">
          <div className="bg-accent-500 p-2 rounded-xl shadow-lg">
            <CalendarClock size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">IELTS Master Plan</h1>
            <p className="text-academic-100 text-sm">雅思备考全能助手</p>
          </div>
        </div>

        <div className="flex flex-col items-center z-10 text-center">
          <span className="text-academic-100 text-xs uppercase tracking-widest mb-1">
            Countdown to Mar 7, 2026
          </span>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-3 border border-white/20 shadow-inner">
            <span className="text-5xl font-extrabold text-accent-400 drop-shadow-sm">{daysLeft}</span>
            <span className="text-lg text-white ml-2 font-medium">Days Left</span>
          </div>
        </div>

        <div className="max-w-sm text-center md:text-right z-10 hidden md:block">
          <p className="text-lg font-medium italic">"{quote.en}"</p>
          <p className="text-sm text-academic-100 mt-1">{quote.cn}</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
