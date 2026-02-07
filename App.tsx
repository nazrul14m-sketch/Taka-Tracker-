
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, CategoryBudget } from './types';
import { TRANSLATIONS, DEFAULT_CATEGORY_KEYS, PAYMENT_METHOD_KEYS } from './constants';
import { AppLock } from './components/AppLock';
import { Charts } from './components/Charts';

const App: React.FC = () => {
  const [lang, setLang] = useState<'bn' | 'en'>(() => (localStorage.getItem('tracker_lang') as 'bn' | 'en') || 'bn');
  const t = TRANSLATIONS[lang];

  // System States
  const [pin, setPin] = useState<string | null>(localStorage.getItem('tracker_pin'));
  const [isLocked, setIsLocked] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('tracker_theme') as 'light' | 'dark') || 'light');
  const [currency] = useState<string>(() => localStorage.getItem('tracker_currency') || '৳');
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'budgets' | 'settings'>('dashboard');
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('tracker_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [budgets, setBudgets] = useState<CategoryBudget[]>(() => {
    const saved = localStorage.getItem('tracker_budgets');
    return saved ? JSON.parse(saved) : [];
  });

  const categories = DEFAULT_CATEGORY_KEYS;
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Success Message Timer - 10 seconds with progress bar
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Persistence
  useEffect(() => { localStorage.setItem('tracker_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('tracker_budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('tracker_lang', lang); }, [lang]);
  useEffect(() => {
    localStorage.setItem('tracker_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const totalCurrentBalance = useMemo(() => {
    return transactions.reduce((acc, tr) => tr.type === 'income' ? acc + tr.amount : acc - tr.amount, 0);
  }, [transactions]);

  const filteredPeriodStats = useMemo(() => {
    const now = new Date();
    const list = transactions.filter(tr => {
      const d = new Date(tr.date);
      if (activeTab === 'daily') return tr.date === now.toISOString().split('T')[0];
      if (activeTab === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear();
    });
    const income = list.filter(tr => tr.type === 'income').reduce((s, tr) => s + tr.amount, 0);
    const expense = list.filter(tr => tr.type === 'expense').reduce((s, tr) => s + tr.amount, 0);
    return { income, expense, list };
  }, [transactions, activeTab]);

  // History Filter Logic
  const filteredHistory = useMemo(() => {
    return transactions.filter(tr => {
      const matchCategory = filterCategory === 'all' || tr.category === filterCategory;
      const matchStart = !filterStartDate || tr.date >= filterStartDate;
      const matchEnd = !filterEndDate || tr.date <= filterEndDate;
      return matchCategory && matchStart && matchEnd;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterCategory, filterStartDate, filterEndDate]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'transaction' | 'budget'; id: string } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [formData, setFormData] = useState({
    amount: '', type: 'expense' as 'income' | 'expense', category: categories.expense[0],
    paymentMethod: PAYMENT_METHOD_KEYS[0], date: new Date().toISOString().split('T')[0], note: ''
  });

  const [budgetForm, setBudgetForm] = useState({ 
    category: categories.expense[0], 
    limit: ''
  });

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);
    if (!amount || amount <= 0) return;
    const data: Transaction = {
      id: editingTransaction ? editingTransaction.id : Date.now().toString(),
      amount, type: formData.type, category: formData.category,
      paymentMethod: formData.paymentMethod, date: formData.date, note: formData.note
    };
    setTransactions(editingTransaction ? transactions.map(t => t.id === editingTransaction.id ? data : t) : [data, ...transactions]);
    setIsModalOpen(false);
    setEditingTransaction(null);
    setSuccessMsg(t.saveSuccess);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(budgetForm.limit);
    if (!budgetForm.category || !limit) return;
    setBudgets(prev => {
      const existing = prev.findIndex(b => b.category === budgetForm.category);
      if (existing > -1) {
        const updated = [...prev];
        updated[existing] = { category: budgetForm.category, limit };
        return updated;
      }
      return [...prev, { category: budgetForm.category, limit }];
    });
    setIsBudgetModalOpen(false);
    setSuccessMsg(t.saveSuccess);
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'transaction') {
      setTransactions(transactions.filter(t => t.id !== deleteConfirm.id));
      setSuccessMsg(t.entryDeleteSuccess);
    } else {
      setBudgets(budgets.filter(b => b.category !== deleteConfirm.id));
      setSuccessMsg(t.budgetDeleteSuccess);
    }
    setDeleteConfirm(null);
  };

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Payment', 'Note'];
    const rows = transactions.map(tr => [
      tr.date,
      tr.type === 'income' ? 'Income' : 'Expense',
      t.categories[tr.category] || tr.category,
      tr.amount,
      t.payments[tr.paymentMethod] || tr.paymentMethod,
      tr.note || ''
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `taka_tracker_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMsg(lang === 'bn' ? 'এক্সপোর্ট সফল হয়েছে' : 'Export successful');
  };

  const handleUnlock = (newPin?: string) => {
    if (newPin) {
      localStorage.setItem('tracker_pin', newPin);
      setPin(newPin);
    }
    setIsLocked(false);
  };

  if (isLocked) return <AppLock storedPin={pin} onUnlock={handleUnlock} />;

  return (
    <div className={`min-h-screen pb-32 transition-colors duration-300 bg-[#F8FAFC] dark:bg-slate-950`}>
      {/* 10-Second Success Message */}
      {successMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white px-8 py-3.5 rounded-full shadow-2xl animate-fade font-black text-xs uppercase flex flex-col items-center gap-1 border-2 border-white/20 backdrop-blur-md min-w-[240px] overflow-hidden">
          <div className="flex items-center gap-2"><span>✨</span> {successMsg}</div>
          <div className="absolute bottom-0 left-0 h-1 bg-white/40 w-full">
            <div className="h-full bg-white animate-success-timer"></div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-[#F8FAFC]/90 dark:bg-slate-950/90 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-200 dark:shadow-none">
            {currency}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{t.appName}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'monthly' ? t.monthly : activeTab === 'daily' ? t.daily : t.yearly}</p>
          </div>
        </div>
        <div className="w-12 h-12"></div>
      </header>

      <main className="px-6 space-y-10 max-w-lg mx-auto animate-fade">
        {currentView === 'dashboard' && (
          <div className="space-y-10 mt-4">
            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(16,185,129,0.3)] group transition-transform duration-500 hover:scale-[1.01]">
              <div className="bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 p-10 text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <p className="text-emerald-50 text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">{t.currentBalance}</p>
                  <h2 className="text-6xl font-black num-font tracking-tighter mb-10 leading-none">
                    {totalCurrentBalance.toLocaleString()} <span className="text-2xl font-normal opacity-50">{currency}</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white/15 backdrop-blur-lg p-5 rounded-[2rem] border border-white/20">
                      <p className="text-[9px] uppercase font-black text-emerald-50 opacity-70 mb-2 tracking-widest">{t.totalIncome}</p>
                      <p className="text-xl font-black num-font">+{filteredPeriodStats.income.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-lg p-5 rounded-[2rem] border border-white/20">
                      <p className="text-[9px] uppercase font-black text-emerald-50 opacity-70 mb-2 tracking-widest">{t.totalExpense}</p>
                      <p className="text-xl font-black num-font">-{filteredPeriodStats.expense.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Period Selector */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-[1.8rem] shadow-sm border border-slate-50 dark:border-slate-800">
              {(['daily', 'monthly', 'yearly'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3.5 rounded-[1.4rem] text-[10px] font-black uppercase transition-all duration-300 ${activeTab === tab ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>
                  {t[tab]}
                </button>
              ))}
            </div>

            <Charts transactions={filteredPeriodStats.list} currency={currency} />

            <button onClick={() => { setEditingTransaction(null); setFormData(p => ({...p, amount: '', type: 'expense', paymentMethod: PAYMENT_METHOD_KEYS[0], date: new Date().toISOString().split('T')[0]})); setIsModalOpen(true); }} 
              className="w-full py-7 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase shadow-xl shadow-emerald-100 dark:shadow-none active:scale-[0.97] transition-all flex items-center justify-center gap-3">
              <span className="text-2xl">✨</span> {t.addTransaction}
            </button>

            {/* Recent History Preview */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-slate-800 dark:text-white px-2 tracking-tight">{t.transactionList}</h3>
              {filteredPeriodStats.list.slice(0, 5).map(tr => (
                <div key={tr.id} onClick={() => { setEditingTransaction(tr); setFormData({...tr, amount: tr.amount.toString()}); setIsModalOpen(true); }}
                  className="bg-white dark:bg-slate-900 p-6 rounded-[2.2rem] flex items-center justify-between border border-slate-50 dark:border-slate-800 shadow-sm transition-all hover:border-emerald-200">
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${tr.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                      {tr.type === 'income' ? '💰' : '💸'}
                    </div>
                    <div>
                      <p className="font-black text-[15px] text-slate-900 dark:text-white leading-none mb-1.5">{t.categories[tr.category] || tr.category}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{tr.date.split('-').reverse().join('-')} • {t.payments[tr.paymentMethod]}</p>
                    </div>
                  </div>
                  <p className={`font-black text-xl num-font ${tr.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {tr.type === 'income' ? '+' : '-'}{tr.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'transactions' && (
          <div className="space-y-6 mt-4 pb-10">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter px-2">{t.entryEntryTitle}</h2>
            
            {/* Filter Section */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-50 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <span className="text-lg">🔍</span> {t.filter}
                </span>
                <button 
                  onClick={() => { setFilterCategory('all'); setFilterStartDate(''); setFilterEndDate(''); }}
                  className="text-[10px] font-black text-emerald-600 uppercase"
                >
                  {t.clearFilters}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <select 
                  value={filterCategory} 
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs font-bold outline-none border border-slate-100 dark:border-slate-700 dark:text-white"
                >
                  <option value="all">{t.allCategories}</option>
                  {[...categories.income, ...categories.expense].map(c => (
                    <option key={c} value={c}>{t.categories[c] || c}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="date" 
                    value={filterStartDate} 
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[10px] font-bold outline-none border border-slate-100 dark:border-slate-700 dark:text-white"
                    placeholder={t.startDate}
                  />
                  <input 
                    type="date" 
                    value={filterEndDate} 
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-[10px] font-bold outline-none border border-slate-100 dark:border-slate-700 dark:text-white"
                    placeholder={t.endDate}
                  />
                </div>
              </div>
            </div>

            {/* List */}
            {filteredHistory.map(tr => (
              <div key={tr.id} onClick={() => { setEditingTransaction(tr); setFormData({...tr, amount: tr.amount.toString()}); setIsModalOpen(true); }}
                className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] flex items-center justify-between border border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${tr.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {tr.type === 'income' ? '💰' : '💸'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{t.categories[tr.category] || tr.category}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase">{tr.date.split('-').reverse().join('-')} • {t.payments[tr.paymentMethod]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <p className={`font-black text-lg num-font ${tr.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{tr.amount.toLocaleString()}</p>
                   <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({type: 'transaction', id: tr.id}); }} className="p-2 text-rose-400 hover:text-rose-600">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentView === 'budgets' && (
          <div className="space-y-8 mt-4 pb-10">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{t.budgetEntryTitle}</h2>
              <button onClick={() => { setBudgetForm({category: categories.expense[0], limit: ''}); setIsBudgetModalOpen(true); }} className="px-5 py-3 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase shadow-lg">
                {t.addBudgetBtn}
              </button>
            </div>
            {budgets.map(budget => {
              const spent = transactions.filter(tr => tr.category === budget.category && tr.type === 'expense' && tr.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, tr) => s + tr.amount, 0);
              const percent = Math.min(100, (spent / budget.limit) * 100);
              return (
                <div key={budget.category} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-50 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <p className="font-black text-lg text-slate-900 dark:text-white">{t.categories[budget.category] || budget.category}</p>
                      <p className="text-[11px] font-black text-slate-400 mt-1 uppercase tracking-widest num-font">{spent.toLocaleString()} / {budget.limit.toLocaleString()} {currency}</p>
                    </div>
                    <button onClick={() => setDeleteConfirm({type: 'budget', id: budget.category})} className="text-rose-400 p-2">🗑️</button>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{width: `${percent}%`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentView === 'settings' && (
          <div className="space-y-10 mt-4 pb-10">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter px-2">{t.settings}</h2>
            
            {/* General Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-4">{t.generalSettings}</h3>
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                <div className="p-8 flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{t.darkMode}</span>
                  <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-14 h-8 bg-slate-100 dark:bg-slate-800 rounded-full relative p-1 transition-all">
                    <div className={`w-6 h-6 bg-emerald-500 rounded-full shadow-lg transition-all transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="w-full p-8 flex items-center justify-between text-left">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{t.language}</span>
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{lang === 'bn' ? 'বাংলা' : 'English'}</span>
                </button>
              </div>
            </div>

            {/* Export Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-4">{t.reportSection}</h3>
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                <button onClick={exportCSV} className="w-full p-8 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">📊</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{t.exportCSV}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CSV</span>
                </button>
              </div>
            </div>

            {/* Security Section */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
               <button onClick={() => setIsLocked(true)} className="w-full p-8 flex items-center gap-4 text-rose-500 font-black uppercase text-sm">
                <span className="text-xl">🔒</span> {t.logout}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-8 pb-10 pt-5 flex items-center justify-between max-w-lg mx-auto rounded-t-[3rem] shadow-2xl">
        {[
          { id: 'dashboard', icon: '🏠', label: t.dashboard },
          { id: 'transactions', icon: '📜', label: t.transactions },
          { id: 'budgets', icon: '🎯', label: t.budgets },
          { id: 'settings', icon: '⚙️', label: t.settings }
        ].map(item => (
          <button key={item.id} onClick={() => setCurrentView(item.id as any)}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 ${currentView === item.id ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 scale-110' : 'text-slate-400 opacity-60'}`}>
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-10 space-y-6 max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{editingTransaction ? t.edit : t.addTransaction}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-4xl text-slate-300 hover:text-rose-500">&times;</button>
            </div>
            <form onSubmit={handleSaveTransaction} className="space-y-6">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-[1.8rem]">
                <button type="button" onClick={() => setFormData({...formData, type: 'expense'})}
                  className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase transition-all ${formData.type === 'expense' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500'}`}>
                  {t.expense}
                </button>
                <button type="button" onClick={() => setFormData({...formData, type: 'income'})}
                  className={`flex-1 py-4 rounded-[1.5rem] text-[11px] font-black uppercase transition-all ${formData.type === 'income' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>
                  {t.income}
                </button>
              </div>
              <div className="space-y-2 text-center">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.amount}</label>
                <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-8 rounded-[2rem] text-5xl font-black text-center text-emerald-600 dark:text-emerald-400 num-font outline-none border border-slate-100 dark:border-slate-700" placeholder="0" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">{t.category}</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-bold text-sm outline-none dark:text-white border border-slate-100 dark:border-slate-700">
                    {categories[formData.type].map(c => <option key={c} value={c}>{t.categories[c] || c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">{t.paymentMethod}</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-bold text-sm outline-none dark:text-white border border-slate-100 dark:border-slate-700">
                    {PAYMENT_METHOD_KEYS.map(m => <option key={m} value={m}>{t.payments[m] || m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">{t.date}</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-bold text-sm outline-none dark:text-white border border-slate-100 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">{t.note}</label>
                  <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-bold text-sm outline-none dark:text-white border border-slate-100 dark:border-slate-700" placeholder={t.note} />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2.2rem] font-black text-sm uppercase shadow-xl active:scale-95 transition-all">{t.save}</button>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-10 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{t.addBudgetBtn}</h2>
              <button onClick={() => setIsBudgetModalOpen(false)} className="text-4xl text-slate-300 hover:text-rose-500">&times;</button>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{lang === 'bn' ? 'ব্যয়ের জন্য বাজেট সেট করুন' : 'Set limit for expenses'}</p>
            <form onSubmit={handleSaveBudget} className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.amount}</label>
                <input type="number" required value={budgetForm.limit} onChange={e => setBudgetForm({...budgetForm, limit: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-10 rounded-[2.5rem] text-5xl font-black text-center text-emerald-600 dark:text-emerald-400 num-font outline-none border border-slate-100 dark:border-slate-700" placeholder="0" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">{t.category}</label>
                <select value={budgetForm.category} onChange={e => setBudgetForm({...budgetForm, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl font-bold text-sm dark:text-white border border-slate-100 dark:border-slate-700 outline-none">
                  {categories.expense.map(c => <option key={c} value={c}>{t.categories[c] || c}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2.2rem] font-black text-sm uppercase shadow-xl active:scale-95 transition-all">{t.confirmSave}</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex items-center justify-center p-8 animate-fade">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-[3rem] p-10 space-y-8 text-center shadow-2xl">
            <div className="text-5xl">⚠️</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {deleteConfirm.type === 'budget' ? t.confirmDeleteBudget : t.confirmDeleteEntry}
            </h2>
            <div className="flex flex-col gap-3">
              <button onClick={executeDelete} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg">{t.confirmDeleteBtn}</button>
              <button onClick={() => setDeleteConfirm(null)} className="w-full py-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest">{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes success-timer { from { width: 100%; } to { width: 0%; } }
        .animate-success-timer { animation: success-timer 10s linear forwards; }
      `}</style>
    </div>
  );
};

export default App;
