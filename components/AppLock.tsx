import React, { useState, useEffect, useRef } from 'react';
import { TRANSLATIONS } from '../constants';

interface AppLockProps {
  storedPin: string | null;
  onUnlock: (pin?: string) => void;
}

export const AppLock: React.FC<AppLockProps> = ({ storedPin, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const lang = (localStorage.getItem('tracker_lang') as 'bn' | 'en') || 'bn';
  const t = TRANSLATIONS[lang];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(value);
    if (error) setError(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (!storedPin) {
        onUnlock(pin);
      } else {
        if (pin === storedPin) {
          onUnlock();
        } else {
          setError(true);
          const timer = setTimeout(() => {
            setPin('');
            setError(false);
            inputRef.current?.focus();
          }, 800);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [pin, storedPin, onUnlock]);

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] dark:bg-slate-950 flex flex-col items-center justify-center p-12 text-center transition-all duration-700 font-bn">
      <div className="w-full max-w-xs animate-premium">
        <div className="mb-20">
          <div className="w-28 h-28 bg-emerald-600 rounded-[3rem] flex items-center justify-center mb-12 mx-auto shadow-2xl shadow-emerald-200 dark:shadow-none relative">
            <div className="absolute inset-0 bg-emerald-400 rounded-[3rem] blur-3xl opacity-30 animate-pulse"></div>
            <span className="text-white text-6xl font-black relative z-10">৳</span>
          </div>
          <h1 className="text-4xl font-black mb-6 dark:text-white tracking-tighter">
            {!storedPin ? t.setupPin : t.lockApp}
          </h1>
          <p className="text-slate-400 font-bold px-4 text-xs leading-relaxed uppercase tracking-[0.2em] opacity-80">
            {!storedPin ? (lang === 'bn' ? 'সুরক্ষার জন্য ৪ সংখ্যার পিন কোড সেট করুন' : 'Setup a 4-digit PIN for security') : t.enterPin}
          </p>
        </div>

        <div className="relative mb-16">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handleInputChange}
            className="absolute inset-0 opacity-0 cursor-default"
            autoFocus
          />
          <div className={`flex justify-center gap-6 ${error ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-[1.5rem] border-2 flex items-center justify-center transition-all duration-300 ${
                  pin.length > i
                    ? 'border-emerald-600 bg-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-none'
                    : 'border-slate-200 dark:border-slate-800'
                } ${error ? 'border-rose-500' : ''}`}
              >
                {pin.length > i && <div className="w-3 h-3 bg-white rounded-full"></div>}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-rose-500 text-[11px] font-black uppercase tracking-[0.3em] animate-pulse">
            {lang === 'bn' ? 'ভুল পিন কোড!' : 'INCORRECT PIN!'}
          </p>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};