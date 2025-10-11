import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, BankAccount, Transaction } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { CategoryHub } from './CategoryHub';
import { CovenantTemplate } from './CovenantTemplate';
import { ChronicleTemplate } from './ChronicleTemplate';
import { TreasuryTemplate } from './TreasuryTemplate';

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  route: string;
};

const CATEGORIES: Category[] = [
  { id: 'supplements', name: 'Supplements', icon: '💊', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30', route: 'supplements' },
  { id: 'grocery', name: 'Grocery', icon: '🛒', color: 'from-green-500/20 to-emerald-500/20 border-green-500/30', route: 'grocery' },
  { id: 'rent', name: 'Rent', icon: '🏠', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30', route: 'rent' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡', color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30', route: 'bills' },
  { id: 'auto', name: 'Auto', icon: '🚗', color: 'from-red-500/20 to-rose-500/20 border-red-500/30', route: 'auto' },
  { id: 'investment', name: 'Investment', icon: '📈', color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30', route: 'investment' },
  { id: 'misc-shop', name: 'Misc Shopping', icon: '🛍️', color: 'from-pink-500/20 to-fuchsia-500/20 border-pink-500/30', route: 'misc-shop' },
  { id: 'misc-health', name: 'Misc Health', icon: '🏥', color: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30', route: 'misc-health' },
  { id: 'home-garden', name: 'Home & Garden', icon: '🌱', color: 'from-lime-500/20 to-green-500/20 border-lime-500/30', route: 'home-garden' },
];

interface FinanceViewProps {
  onCategorySelect: (category: string) => void;
}

export function FinanceView({ onCategorySelect }: FinanceViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load bank accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (accountsError) throw accountsError;
      setBankAccounts(accounts || []);

      // Load recent transactions
      const { data: txns, error: txnsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);

      if (txnsError) throw txnsError;
      setTransactions(txns || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading finance data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading finance data...</div>
      </div>
    );
  }

  // If a category is selected, show appropriate template
  if (selectedCategory) {
    if (selectedCategory.id === 'supplements') {
      // Navigate to supplements hub
      onCategorySelect('overview');
      setSelectedCategory(null);
      return null;
    }

    // Use COVENANT template for bills and rent
    if (selectedCategory.id === 'rent' || selectedCategory.id === 'bills') {
      return (
        <CovenantTemplate
          category={selectedCategory.id}
          categoryName={selectedCategory.name}
          icon={selectedCategory.icon}
          color={selectedCategory.color}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }

    // Use CHRONICLE template for misc categories
    if (selectedCategory.id === 'misc-shop' || selectedCategory.id === 'misc-health' || selectedCategory.id === 'home-garden') {
      return (
        <ChronicleTemplate
          category={selectedCategory.id}
          categoryName={selectedCategory.name}
          icon={selectedCategory.icon}
          color={selectedCategory.color}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }

    // Use TREASURY template for investment
    if (selectedCategory.id === 'investment') {
      return (
        <TreasuryTemplate
          category={selectedCategory.id}
          categoryName={selectedCategory.name}
          icon={selectedCategory.icon}
          color={selectedCategory.color}
          onBack={() => setSelectedCategory(null)}
        />
      );
    }

    // Use MARKET template for grocery and auto
    return (
      <CategoryHub
        category={selectedCategory.id}
        categoryName={selectedCategory.name}
        icon={selectedCategory.icon}
        color={selectedCategory.color}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">LifeDashHub</h1>
          <p className="text-white/60">Your complete financial overview</p>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((category) => (
          <motion.button
            key={category.id}
            onClick={() => setSelectedCategory(category)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative overflow-hidden bg-gradient-to-br ${category.color} backdrop-blur-xl rounded-2xl border p-6 text-left transition-all hover:shadow-lg`}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-5xl">{category.icon}</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">$0</div>
                <div className="text-xs text-white/60">This month</div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
            <p className="text-sm text-white/60">Budget: $0 / $0</p>
            <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white/30 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Spent (Month)</h3>
          <p className="text-3xl font-bold text-white">$0.00</p>
          <p className="text-xs text-white/40 mt-2">Across all categories</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Budget Remaining</h3>
          <p className="text-3xl font-bold text-green-400">$0.00</p>
          <p className="text-xs text-white/40 mt-2">0% of monthly budget</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Budget</h3>
          <p className="text-3xl font-bold text-white">$0.00</p>
          <p className="text-xs text-white/40 mt-2">Set monthly targets</p>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Connected Accounts</h2>
          <button className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all">
            + Connect Bank
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🏦</div>
            <h3 className="text-base font-medium text-white mb-1">No accounts connected</h3>
            <p className="text-sm text-white/60 mb-4">
              Connect your bank with Plaid to automatically sync transactions
            </p>
            <p className="text-xs text-white/40">
              Waiting for Plaid approval. Once approved, you'll be able to connect banks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bankAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-white">{account.institution_name}</h3>
                    <p className="text-sm text-white/60">
                      {account.account_type} •••• {account.account_mask}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/40">
                      Last synced: {account.last_synced_at
                        ? new Date(account.last_synced_at).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </motion.div>
  );
}
