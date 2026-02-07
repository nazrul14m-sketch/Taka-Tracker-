
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod: string;
  date: string;
  note: string;
}

export interface CategoryBudget {
  category: string;
  limit: number;
}

export interface AppState {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  pin: string | null;
  isLocked: boolean;
  theme: 'light' | 'dark';
  currency: string;
  notifications: {
    budgetAlert: boolean;
    dailyReminder: boolean;
  };
}
