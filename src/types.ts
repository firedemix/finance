import { 
  Utensils, 
  Bus, 
  Gamepad2, 
  GraduationCap, 
  ShoppingBag, 
  Home, 
  Zap, 
  HeartPulse, 
  MoreHorizontal,
  PlusCircle,
  ArrowUpCircle
} from 'lucide-react';

export type TransactionType = 'income' | 'expense';

export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸'
};

export interface Category {
  id: string;
  name: string;
  icon: any;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  amount: number;
  categoryId: string;
  type: TransactionType;
  date: string;
  comment: string;
  isRecurring?: boolean;
}

export interface Budget {
  categoryId: string;
  amount: number;
}

export const CATEGORIES: Category[] = [
  // Expenses
  { id: 'food', name: 'Еда', icon: Utensils, color: '#ef4444', type: 'expense' },
  { id: 'transport', name: 'Транспорт', icon: Bus, color: '#f59e0b', type: 'expense' },
  { id: 'entertainment', name: 'Развлечения', icon: Gamepad2, color: '#8b5cf6', type: 'expense' },
  { id: 'education', name: 'Учёба', icon: GraduationCap, color: '#3b82f6', type: 'expense' },
  { id: 'shopping', name: 'Покупки', icon: ShoppingBag, color: '#ec4899', type: 'expense' },
  { id: 'housing', name: 'Жильё', icon: Home, color: '#10b981', type: 'expense' },
  { id: 'utilities', name: 'Коммуналка', icon: Zap, color: '#06b6d4', type: 'expense' },
  { id: 'health', name: 'Здоровье', icon: HeartPulse, color: '#f43f5e', type: 'expense' },
  { id: 'other-exp', name: 'Другое', icon: MoreHorizontal, color: '#6b7280', type: 'expense' },
  
  // Income
  { id: 'salary', name: 'Зарплата', icon: ArrowUpCircle, color: '#10b981', type: 'income' },
  { id: 'scholarship', name: 'Стипендия', icon: GraduationCap, color: '#3b82f6', type: 'income' },
  { id: 'gift', name: 'Подарок', icon: PlusCircle, color: '#ec4899', type: 'income' },
  { id: 'other-inc', name: 'Другое', icon: MoreHorizontal, color: '#6b7280', type: 'income' },
];
