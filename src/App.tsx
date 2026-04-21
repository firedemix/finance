import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  PieChart as PieChartIcon, 
  LayoutDashboard, 
  Calendar,
  Settings,
  MoreHorizontal,
  X,
  Moon,
  Sun
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useLocalStorage, formatCurrency } from './utils';
import { CATEGORIES, Transaction, TransactionType } from './types';

function App() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [budget, setBudget] = useLocalStorage<number>('monthly-budget', 30000);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'budget'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useLocalStorage('dark-mode', false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // New transaction form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');

  // Calculations
  const currentMonth = {
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isCorrectType = filterType === 'all' || t.type === filterType;
      return isCorrectType;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType]);

  const stats = useMemo(() => {
    const totals = transactions.reduce(
      (acc, t) => {
        const tDate = parseISO(t.date);
        const inCurrentMonth = isWithinInterval(tDate, currentMonth);

        if (t.type === 'income') {
          acc.totalIncome += t.amount;
          if (inCurrentMonth) acc.monthIncome += t.amount;
        } else {
          acc.totalExpenses += t.amount;
          if (inCurrentMonth) acc.monthExpenses += t.amount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpenses: 0, monthIncome: 0, monthExpenses: 0 }
    );
    return { ...totals, balance: totals.totalIncome - totals.totalExpenses };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const currentMonthExpenses = transactions.filter(t => 
      t.type === 'expense' && isWithinInterval(parseISO(t.date), currentMonth)
    );

    const grouped = currentMonthExpenses.reduce((acc, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([id, value]) => ({
      name: CATEGORIES.find(c => c.id === id)?.name || id,
      value,
      color: CATEGORIES.find(c => c.id === id)?.color || '#94a3b8'
    }));
  }, [transactions]);

  const dailyData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return format(d, 'yyyy-MM-dd');
    });

    return days.map(day => {
      const dayTransactions = transactions.filter(t => t.date === day);
      const expenses = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      return {
        date: format(parseISO(day), 'd MMM', { locale: ru }),
        expenses,
        income
      };
    });
  }, [transactions]);

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      amount: parseFloat(amount),
      type,
      categoryId,
      date,
      comment
    };

    setTransactions([newTransaction, ...transactions]);
    setAmount('');
    setComment('');
    setIsFormOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const budgetProgress = (stats.monthExpenses / budget) * 100;
  const budgetColor = budgetProgress > 100 ? 'bg-rose-500' : budgetProgress > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-8 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-2 rounded-xl">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-white">Мои финансы</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="hidden md:flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium shadow-md transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border dark:border-slate-800 shadow-sm">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-950' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Обзор</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-950' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">История</span>
          </button>
          <button 
            onClick={() => setActiveTab('budget')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${activeTab === 'budget' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-950' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Бюджет</span>
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
                  <Wallet className="w-4 h-4" /> Общий баланс
                </div>
                <div className="text-3xl font-black dark:text-white">{formatCurrency(stats.balance)}</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-1">
                  <TrendingUp className="w-4 h-4" /> Доход (мес)
                </div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(stats.monthIncome)}</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/50 shadow-sm">
                <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-sm font-medium mb-1">
                  <TrendingDown className="w-4 h-4" /> Расход (мес)
                </div>
                <div className="text-3xl font-black text-rose-700 dark:text-rose-300">{formatCurrency(stats.monthExpenses)}</div>
              </div>
            </div>

            {/* Budget Progress */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg dark:text-white">Бюджет на месяц</h2>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${budgetProgress > 100 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'}`}>
                  {Math.round(budgetProgress)}%
                </span>
              </div>
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${budgetColor}`} 
                  style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm">
                  <p className="text-slate-400 dark:text-slate-500 font-medium">Потрачено</p>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(stats.monthExpenses)}</p>
                </div>
                <div className="text-sm text-right">
                  <p className="text-slate-400 dark:text-slate-500 font-medium">Осталось</p>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(Math.max(0, budget - stats.monthExpenses))}</p>
                </div>
              </div>
              {budgetProgress >= 100 && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-pulse">
                  <div className="bg-rose-500 p-1.5 rounded-full text-white">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-rose-700 font-bold">Лимит превышен! Самое время начать экономить.</p>
                </div>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800 flex flex-col min-h-[400px]">
                <h2 className="font-bold mb-6 flex items-center gap-2 dark:text-white">
                  <PieChartIcon className="w-5 h-5 text-emerald-500" /> Состав расходов
                </h2>
                <div className="flex-1 min-h-[250px]">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => formatCurrency(Number(value))}
                          contentStyle={{ 
                            borderRadius: '20px', 
                            border: 'none', 
                            background: isDarkMode ? '#1e293b' : '#fff', 
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            color: isDarkMode ? '#fff' : '#000'
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-2">
                      <PieChartIcon className="w-12 h-12 opacity-20" />
                      <p className="text-sm font-medium">Нет данных за этот месяц</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800 flex flex-col min-h-[400px]">
                <h2 className="font-bold mb-6 flex items-center gap-2 dark:text-white">
                   <TrendingUp className="w-5 h-5 text-indigo-500" /> Активность за неделю
                </h2>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: isDarkMode ? '#334155' : '#f8fafc' }}
                        formatter={(value: any) => formatCurrency(Number(value))}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          background: isDarkMode ? '#1e293b' : '#fff', 
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          color: isDarkMode ? '#fff' : '#000'
                        }}
                      />
                      <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Расход" barSize={12} />
                      <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Доход" barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800 shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Все
              </button>
              <button 
                onClick={() => setFilterType('income')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filterType === 'income' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100 dark:shadow-none' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Доходы
              </button>
              <button 
                onClick={() => setFilterType('expense')}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filterType === 'expense' ? 'bg-rose-500 text-white shadow-md shadow-rose-100 dark:shadow-none' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                Расходы
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-sm border-slate-100 overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full">
                    <Calendar className="w-12 h-12 opacity-20" />
                  </div>
                  <p className="font-semibold">Транзакций пока нет</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredTransactions.map(t => {
                    const category = CATEGORIES.find(c => c.id === t.categoryId);
                    const Icon = category?.icon || MoreHorizontal;
                    return (
                      <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-white dark:group-hover:bg-slate-700 transition-all shadow-sm group-hover:shadow-md">
                            <Icon className="w-5 h-5" style={{ color: category?.color }} />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{category?.name}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                              {format(parseISO(t.date), 'd MMM yyyy', { locale: ru })}
                              {t.comment && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                  <span className="truncate max-w-[120px] sm:max-w-none">{t.comment}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`font-black text-sm sm:text-base ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                          </div>
                          <button 
                            onClick={() => deleteTransaction(t.id)}
                            className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border dark:border-slate-800 shadow-sm border-slate-100">
              <h2 className="font-bold text-xl mb-6 dark:text-white">Управление бюджетом</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                    Ежемесячный лимит расходов (₽)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-xl font-bold dark:text-white"
                      placeholder="Например, 30000"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 font-bold">₽</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm mb-1">Режим экономии</h4>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">Система будет предупреждать вас при достижении 80% от лимита.</p>
                  </div>
                  <div className="p-5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm mb-1">Совет студенту</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">Средний бюджет студента в РФ составляет 20-35 тыс. рублей.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsFormOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 bg-slate-900 text-white p-5 rounded-3xl shadow-2xl z-30 transition-all hover:scale-110 active:scale-95 group"
      >
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform" />
      </button>

      {/* Add Transaction Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
            <div className="p-8 pb-4 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Новая запись</h3>
              <button 
                onClick={() => setIsFormOpen(false)} 
                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-8 pt-4 space-y-6">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${type === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Доход
                </button>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Сумма</label>
                <div className="relative">
                   <input
                    autoFocus
                    required
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-4xl font-black px-1 py-2 border-b-4 border-slate-100 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-all placeholder-slate-200 dark:placeholder-slate-700"
                    placeholder="0"
                  />
                  <span className="absolute right-0 bottom-3 text-2xl font-black text-slate-300 dark:text-slate-600">₽</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Категория</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-semibold"
                  >
                    <option value="" className="dark:bg-slate-900">Выбрать...</option>
                    {CATEGORIES.filter(c => c.type === type).map(c => (
                      <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Дата</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Заметка</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-semibold"
                  placeholder="Напишите коротко..."
                />
              </div>

              <button
                type="submit"
                className={`w-full py-5 rounded-[2rem] text-white text-lg font-black shadow-2xl transition-all active:scale-95 ${type === 'income' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'}`}
              >
                Готово
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
