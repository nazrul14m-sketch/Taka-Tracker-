
import React from 'react';
import { Transaction } from '../types';
import { TRANSLATIONS } from '../constants';

interface ChartsProps {
  transactions: Transaction[];
  currency: string;
}

const COLORS = ['#10B981', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export const Charts: React.FC<ChartsProps> = ({ transactions, currency }) => {
  const lang = (localStorage.getItem('tracker_lang') as 'bn' | 'en') || 'bn';
  const t = TRANSLATIONS[lang];

  const expenseData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: { key: string; name: string; value: number }[], current) => {
      const existing = acc.find(item => item.key === current.category);
      if (existing) {
        existing.value += current.amount;
      } else {
        acc.push({ 
          key: current.category, 
          name: t.categories[current.category] || current.category, 
          value: current.amount 
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  if (expenseData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-50 dark:border-slate-800 text-center shadow-sm">
        <span className="text-4xl block mb-4 opacity-40">📊</span>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'বিশ্লেষণের তথ্য নেই' : 'No data'}</p>
      </div>
    );
  }

  const totalValue = expenseData.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercent = 0;

  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-sm border border-slate-50 dark:border-slate-800 animate-fade">
      <h3 className="text-xl font-black mb-10 dark:text-white flex items-center gap-3">
        <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
        {lang === 'bn' ? 'ব্যয় বিশ্লেষণ' : 'Expense Analytics'}
      </h3>
      
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48 mb-10">
          <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full drop-shadow-xl">
            {expenseData.map((slice, i) => {
              const startPercent = cumulativePercent;
              const slicePercent = slice.value / totalValue;
              cumulativePercent += slicePercent;
              const [startX, startY] = getCoordinatesForPercent(startPercent);
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
              const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
              const pathData = [`M ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(' ');
              return <path key={i} d={pathData} fill={COLORS[i % COLORS.length]} />;
            })}
            <circle cx="0" cy="0" r="0.75" fill="white" className="dark:fill-slate-900" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{lang === 'bn' ? 'মোট' : 'Total'}</span>
            <span className="text-xl font-black dark:text-white num-font">{totalValue.toLocaleString()}</span>
            <span className="text-[10px] opacity-40 font-bold">{currency}</span>
          </div>
        </div>

        <div className="w-full space-y-3">
          {expenseData.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                <span className="text-slate-600 dark:text-slate-400 font-bold text-xs">{item.name}</span>
              </div>
              <span className="font-black dark:text-white num-font text-xs">{item.value.toLocaleString()} {currency}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
