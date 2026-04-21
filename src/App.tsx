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
  Sun,
  FileDown,
  RefreshCcw,
  Globe
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
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLocalStorage, formatCurrency } from './utils';
import { CATEGORIES, Transaction, TransactionType, Currency, CURRENCY_SYMBOLS } from './types';

function App() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [budget, setBudget] = useLocalStorage<number>('monthly-budget', 30000);
  const [currency, setCurrency] = useLocalStorage<Currency>('currency', 'RUB');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useLocalStorage('dark-mode', false);
  const [lastRecurringCheck, setLastRecurringCheck] = useLocalStorage('last-recurring-check', new Date().toISOString());

  // Force apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Automatic Recurring Payments Logic
  useEffect(() => {
    const today = new Date();
    const lastCheck = parseISO(lastRecurringCheck);
    
    // Check if a new month has started since last check
    if (isBefore(startOfMonth(lastCheck), startOfMonth(today))) {
      const recurringOnes = transactions.filter(t => t.isRecurring);
      if (recurringOnes.length > 0) {
        const newTransactions = recurringOnes.map(t => ({
          ...t,
          id: crypto.randomUUID(),
          date: format(today, 'yyyy-MM-01'), 
          comment: t.comment ? `${t.comment} (Регулярный)` : 'Регулярный платеж'
        }));
        setTransactions([...newTransactions, ...transactions]);
      }
      setLastRecurringCheck(today.toISOString());
    }
  }, []);

  // New transaction form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

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
      comment,
      isRecurring
    };

    setTransactions([newTransaction, ...transactions]);
    setAmount('');
    setComment('');
    setCategoryId('');
    setIsRecurring(false);
    setIsFormOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const exportToCSV = () => {
    const headers = ['Дата', 'Тип', 'Категория', 'Сумма', 'Валюта', 'Комментарий'];
    const rows = transactions.map(t => [
      t.date,
      t.type === 'income' ? 'Доход' : 'Расход',
      CATEGORIES.find(c => c.id === t.categoryId)?.name || 'Другое',
      t.amount,
      currency,
      t.comment
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finances_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Отчет по финансам', 14, 15);
    doc.setFontSize(10);
    doc.text(`Период: ${format(new Date(), 'MMMM yyyy', { locale: ru })}`, 14, 22);
    doc.text(`Общий баланс: ${formatCurrency(stats.balance, currency)}`, 14, 28);

    const tableData = transactions.map(t => [
      t.date,
      CATEGORIES.find(c => c.id === t.categoryId)?.name || 'Другое',
      t.type === 'income' ? '+' : '-',
      `${t.amount} ${CURRENCY_SYMBOLS[currency]}`,
      t.comment
    ]);

    autoTable(doc, {
      head: [['Дата', 'Категория', 'Тип', 'Сумма', 'Комментарий']],
      body: tableData,
      startY: 35,
    });

    doc.save(`report_${format(new Date(), 'yyyy-MM')}.pdf`);
  };

  const budgetProgress = budget > 0 ? (stats.monthExpenses / budget) * 100 : 0;
  const budgetColor = budgetProgress >= 100 ? 'bg-rose-500' : budgetProgress >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-8 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-white">Мои финансы</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Включить светлую тему' : 'Включить темную тему'}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="hidden md:flex items-center gap-2 bg-slate-900 dark:bg-emerald-500 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Добавить
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border dark:border-slate-800 shadow-sm sticky top-[73px] z-10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Обзор</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">История</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'settings' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Настройки</span>
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Wallet className="w-4 h-4" /> Общий баланс
                </div>
                <div className="text-3xl font-black dark:text-white leading-tight">
                  {formatCurrency(stats.balance, currency)}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <TrendingUp className="w-4 h-4" /> Доход (мес)
                </div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 leading-tight">
                  {formatCurrency(stats.monthIncome, currency)}
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/50 shadow-sm">
                <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <TrendingDown className="w-4 h-4" /> Расход (мес)
                </div>
                <div className="text-3xl font-black text-rose-700 dark:text-rose-400 leading-tight">
                  {formatCurrency(stats.monthExpenses, currency)}
                </div>
              </div>
            </div>

            {/* Budget Progress */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-black text-lg dark:text-white flex items-center gap-2">
                  <RefreshCcw className="w-5 h-5 text-emerald-500" /> Бюджет на месяц
                </h2>
                <span className={`px-3 py-1 rounded-xl text-xs font-black ${budgetProgress >= 100 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' : budgetProgress >= 80 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'}`}>
                  {Math.round(budgetProgress)}%
                </span>
              </div>
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-5 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full shadow-lg ${budgetColor}`} 
                  style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mb-1">Потрачено</p>
                  <p className="font-black text-slate-800 dark:text-slate-200">{formatCurrency(stats.monthExpenses, currency)}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-right">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mb-1">Осталось</p>
                  <p className="font-black text-slate-800 dark:text-slate-200">{formatCurrency(Math.max(0, budget - stats.monthExpenses), currency)}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800 flex flex-col min-h-[420px]">
                <h2 className="font-black mb-6 flex items-center gap-2 dark:text-white">
                  <PieChartIcon className="w-5 h-5 text-emerald-500" /> Категории расходов
                </h2>
                <div className="flex-1 min-h-[250px] relative">
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
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => formatCurrency(Number(value), currency)}
                          contentStyle={{ 
                            borderRadius: '24px', 
                            border: 'none', 
                            background: isDarkMode ? '#1e293b' : '#fff', 
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                            padding: '12px 16px',
                            fontWeight: 'bold'
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full">
                        <PieChartIcon className="w-12 h-12 opacity-20" />
                      </div>
                      <p className="text-sm font-bold">Нет данных для анализа</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm border-slate-100 dark:border-slate-800 flex flex-col min-h-[420px]">
                <h2 className="font-black mb-6 flex items-center gap-2 dark:text-white">
                   <TrendingUp className="w-5 h-5 text-indigo-500" /> Активность за неделю
                </h2>
                <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tick={{fill: isDarkMode ? '#64748b' : '#94a3b8', fontWeight: 'bold'}} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                        formatter={(value: any) => formatCurrency(Number(value), currency)}
                        contentStyle={{ 
                          borderRadius: '20px', 
                          border: 'none', 
                          background: isDarkMode ? '#1e293b' : '#fff', 
                          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                          padding: '12px 16px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar dataKey="expenses" fill="#f43f5e" radius={[10, 10, 10, 10]} barSize={20} />
                      <Bar dataKey="income" fill="#10b981" radius={[10, 10, 10, 10]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border dark:border-slate-800 shadow-sm flex items-center gap-1 w-full sm:w-auto">
                <button 
                  onClick={() => setFilterType('all')}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${filterType === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Все
                </button>
                <button 
                  onClick={() => setFilterType('income')}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${filterType === 'income' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Доходы
                </button>
                <button 
                  onClick={() => setFilterType('expense')}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-black transition-all ${filterType === 'expense' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Расходы
                </button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={exportToPDF}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                >
                  <FileDown className="w-4 h-4 text-emerald-500" /> Отчет PDF
                </button>
                <button 
                  onClick={exportToCSV}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
                >
                  <RefreshCcw className="w-4 h-4 text-indigo-500" /> Экспорт CSV
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 shadow-sm border-slate-100 overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="p-24 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-5 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-full">
                    <Calendar className="w-16 h-16 opacity-20" />
                  </div>
                  <div>
                    <p className="font-black text-lg mb-1">Ничего не найдено</p>
                    <p className="text-sm opacity-60">Попробуйте изменить фильтры</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredTransactions.map(t => {
                    const category = CATEGORIES.find(c => c.id === t.categoryId);
                    const Icon = category?.icon || MoreHorizontal;
                    return (
                      <div key={t.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group">
                        <div className="flex items-center gap-5">
                          <div 
                            className="p-4 rounded-2xl shadow-sm transition-all group-hover:scale-110"
                            style={{ backgroundColor: `${category?.color}15`, color: category?.color }}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-0.5">
                              {category?.name}
                              {t.isRecurring && <RefreshCcw className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-bold flex items-center gap-2">
                              {format(parseISO(t.date), 'd MMMM yyyy', { locale: ru })}
                              {t.comment && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                  <span className="truncate max-w-[150px] sm:max-w-[300px] italic">{t.comment}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className={`font-black text-lg whitespace-nowrap ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount, currency)}
                          </div>
                          <button 
                            onClick={() => deleteTransaction(t.id)}
                            className="p-3 text-slate-300 dark:text-slate-700 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all sm:opacity-0 sm:group-hover:opacity-100 active:scale-90"
                          >
                            <Trash2 className="w-5 h-5" />
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

        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border dark:border-slate-800 shadow-sm border-slate-100">
              <h2 className="font-black text-2xl mb-10 dark:text-white flex items-center gap-3">
                <Settings className="w-8 h-8 text-emerald-500" /> Настройки профиля
              </h2>
              
              <div className="space-y-10">
                <div className="p-8 bg-slate-50 dark:bg-slate-950/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50">
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-5 ml-1">
                    Месячный бюджет (лимит)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full px-8 py-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-emerald-500 outline-none transition-all text-3xl font-black dark:text-white shadow-sm"
                    />
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-2xl">
                      {CURRENCY_SYMBOLS[currency]}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-5 ml-1">
                    Основная валюта приложения
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {(['RUB', 'USD', 'EUR', 'KZT'] as Currency[]).map((curr) => (
                      <button
                        key={curr}
                        onClick={() => setCurrency(curr)}
                        className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 transition-all gap-2 ${currency === curr ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'}`}
                      >
                        <span className="text-2xl font-black dark:text-white">{CURRENCY_SYMBOLS[curr]}</span>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{curr}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-5">
                  <div className="p-8 bg-indigo-50 dark:bg-indigo-950/20 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/30 flex gap-5">
                    <div className="bg-indigo-500 text-white p-4 rounded-2xl h-fit shadow-lg shadow-indigo-500/20">
                      <RefreshCcw className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-indigo-900 dark:text-indigo-300 mb-2">Автоматизация</h4>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 font-bold leading-relaxed opacity-80">Регулярные платежи и стипендии добавляются сами 1-го числа каждого месяца.</p>
                    </div>
                  </div>
                  <div className="p-8 bg-amber-50 dark:bg-amber-950/20 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/30 flex gap-5">
                    <div className="bg-amber-500 text-white p-4 rounded-2xl h-fit shadow-lg shadow-amber-500/20">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-900 dark:text-amber-300 mb-2">Локализация</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed opacity-80">Все отчеты и суммы подстраиваются под выбранную валюту автоматически.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (Mobile) */}
      <button 
        onClick={() => setIsFormOpen(true)}
        className="md:hidden fixed bottom-8 right-8 bg-slate-900 dark:bg-emerald-500 text-white p-6 rounded-[2.5rem] shadow-2xl z-30 transition-all hover:scale-110 active:scale-95 flex items-center justify-center border-4 border-white dark:border-slate-900"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Add Transaction Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-20 duration-500 border-4 border-slate-100 dark:border-slate-800">
            <div className="p-10 pb-6 flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">Новая операция</h3>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">Заполните данные ниже</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)} 
                className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-[2rem] transition-all active:scale-90"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-10 pt-4 space-y-8">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-[2rem] shadow-inner">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-4 text-sm font-black rounded-[1.5rem] transition-all ${type === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-4 text-sm font-black rounded-[1.5rem] transition-all ${type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Доход
                </button>
              </div>

              <div className="space-y-2">
                <div className="relative">
                   <input
                    autoFocus
                    required
                    type="text"
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setAmount('');
                        return;
                      }
                      let cleaned = raw.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) {
                        cleaned = parts[0] + '.' + parts.slice(1).join('');
                      }
                      setAmount(cleaned);
                    }}
                    className="w-full text-7xl font-black px-2 py-4 border-b-8 border-slate-100 dark:border-slate-800 bg-transparent text-slate-900 dark:text-white focus:border-emerald-500 outline-none transition-all placeholder-slate-200 dark:placeholder-slate-800"
                    placeholder="0"
                  />
                  <span className="absolute right-0 bottom-6 text-3xl font-black text-slate-300 dark:text-slate-600">{CURRENCY_SYMBOLS[currency]}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Категория</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-[2rem] border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-black appearance-none cursor-pointer"
                  >
                    <option value="" className="dark:bg-slate-900">Выбрать...</option>
                    {CATEGORIES.filter(c => c.type === type).map(c => (
                      <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Дата</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-[2rem] border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-black"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Комментарий (необязательно)</label>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-[2rem] border-none outline-none ring-2 ring-transparent focus:ring-emerald-500 transition-all font-black"
                    placeholder="Например: Студсовет или Обед"
                  />
                </div>

                <label className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800 rounded-[2rem] cursor-pointer group hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all border-2 border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/30">
                  <div className="relative h-7 w-12">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 transition-all" />
                    <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-all peer-checked:translate-x-5 shadow-sm" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">Регулярная операция</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Будет повторяться каждый месяц</span>
                  </div>
                  <RefreshCcw className="w-5 h-5 text-emerald-500 ml-auto opacity-40 group-hover:opacity-100 transition-all" />
                </label>
              </div>

              <button
                type="submit"
                className={`w-full py-6 rounded-[2.5rem] text-white text-xl font-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${type === 'income' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'}`}
              >
                Сохранить {type === 'income' ? 'доход' : 'расход'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
