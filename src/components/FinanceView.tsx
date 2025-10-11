import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, BankAccount, Transaction, CategoryBudget, TransactionRule } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { CategoryHub } from './CategoryHub';
import { CovenantTemplate } from './CovenantTemplate';
import { ChronicleTemplate } from './ChronicleTemplate';
import { TreasuryTemplate } from './TreasuryTemplate';
import { parseBankCSV, validateCSVFile, downloadCSVTemplate, type ParsedTransaction } from '../utils/csvParser';
import { CSVImportModal, type MappedTransaction } from './CSVImportModal';
import { MerchantRulesModal } from './MerchantRulesModal';

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
  const [categorySpending, setCategorySpending] = useState<Map<string, number>>(new Map());
  const [categoryBudgets, setCategoryBudgets] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showBudgetPlanner, setShowBudgetPlanner] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Map<string, string>>(new Map());
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [showMerchantRules, setShowMerchantRules] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

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

      // Load category spending for current month
      const { data: logsData, error: logsError } = await supabase
        .from('category_logs')
        .select('*, category_items!inner(category)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (logsError) throw logsError;

      // Aggregate spending by category
      const spendingMap = new Map<string, number>();
      logsData?.forEach((log: any) => {
        const category = log.category_items?.category;
        if (category) {
          const currentSpend = spendingMap.get(category) || 0;
          spendingMap.set(category, currentSpend + (log.actual_amount || 0));
        }
      });
      setCategorySpending(spendingMap);

      // Load budgets for current month
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth);

      if (budgetsError) throw budgetsError;

      const budgetsMap = new Map<string, number>();
      const inputsMap = new Map<string, string>();
      budgetsData?.forEach((budget: CategoryBudget) => {
        budgetsMap.set(budget.category, budget.target_amount);
        inputsMap.set(budget.category, budget.target_amount.toString());
      });
      setCategoryBudgets(budgetsMap);
      setBudgetInputs(inputsMap);

      setLoading(false);
    } catch (error) {
      console.error('Error loading finance data:', error);
      setLoading(false);
    }
  };

  const saveBudgets = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const budgetsToSave = CATEGORIES.map((category) => {
        const value = budgetInputs.get(category.id);
        const amount = value ? parseFloat(value) : 0;
        return {
          user_id: user.id,
          category: category.id,
          month_year: currentMonth,
          target_amount: amount
        };
      }).filter((budget) => budget.target_amount > 0);

      const { error } = await supabase
        .from('category_budgets')
        .upsert(budgetsToSave, { onConflict: 'user_id,category,month_year' });

      if (error) throw error;

      setShowBudgetPlanner(false);
      loadData();
      alert('Budgets saved successfully!');
    } catch (error) {
      console.error('Error saving budgets:', error);
      alert('Failed to save budgets');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateCSVFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const content = await file.text();
      const result = parseBankCSV(content);

      if (result.errors.length > 0) {
        console.warn('CSV parsing errors:', result.errors);
      }

      setParsedTransactions(result.transactions);
      setShowImportPreview(true);
    } catch (error) {
      console.error('Error reading CSV:', error);
      alert('Failed to read CSV file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async (mappedTransactions: MappedTransaction[]) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Save transaction rules for transactions marked "saveRule"
      const rulesToSave = mappedTransactions
        .filter(tx => tx.saveRule)
        .map(tx => ({
          user_id: user.id,
          keyword: tx.merchant.split(' ')[0], // Use first word as keyword
          category: tx.category,
          template: tx.template,
        }));

      if (rulesToSave.length > 0) {
        const { error: rulesError } = await supabase
          .from('transaction_rules')
          .upsert(rulesToSave, { onConflict: 'user_id,keyword', ignoreDuplicates: true });

        if (rulesError) throw rulesError;
      }

      // Expand transactions with splits into multiple entries
      const expandedTransactions: Array<{ merchant: string; category: string; amount: number; date: string; bankCategory: string }> = [];

      for (const tx of mappedTransactions) {
        if (tx.splits && tx.splits.length > 0) {
          // Add each split as separate transaction
          for (const split of tx.splits) {
            expandedTransactions.push({
              merchant: `${tx.merchant} (split)`,
              category: split.category,
              amount: split.amount,
              date: tx.date,
              bankCategory: tx.bankCategory,
            });
          }
        } else {
          // Add as single transaction
          expandedTransactions.push({
            merchant: tx.merchant,
            category: tx.category,
            amount: tx.amount,
            date: tx.date,
            bankCategory: tx.bankCategory,
          });
        }
      }

      // Create category_items for each unique merchant-category pair
      const itemsToCreate = expandedTransactions.map(tx => ({
        user_id: user.id,
        category: tx.category,
        name: tx.merchant,
        description: `Imported from CSV on ${new Date().toISOString().slice(0, 10)}`,
        amount: tx.amount,
        frequency: 'one-time' as const,
        is_active: true,
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('category_items')
        .upsert(itemsToCreate, { onConflict: 'user_id,category,name', ignoreDuplicates: false })
        .select('id, name, category');

      if (itemsError) throw itemsError;

      // Create category_logs for each transaction
      const logsToCreate = expandedTransactions.map((tx, index) => {
        const matchingItem = createdItems?.find(item => item.name === tx.merchant && item.category === tx.category);
        return {
          user_id: user.id,
          category_item_id: matchingItem?.id || createdItems?.[index]?.id,
          date: tx.date,
          actual_amount: tx.amount,
          notes: `Imported: ${tx.bankCategory}`,
          is_planned: false,
        };
      });

      const { error: logsError } = await supabase
        .from('category_logs')
        .insert(logsToCreate);

      if (logsError) throw logsError;

      setShowImportPreview(false);
      setParsedTransactions([]);
      loadData();
      alert(`Successfully imported ${expandedTransactions.length} transaction logs from ${mappedTransactions.length} transactions!`);
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Failed to import transactions');
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowBudgetPlanner(!showBudgetPlanner)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
          >
            {showBudgetPlanner ? '✕ Close Planner' : '📊 Budget Planner'}
          </button>
          <button
            onClick={() => setShowMerchantRules(true)}
            className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 font-medium transition-all"
          >
            🏪 Rules
          </button>
          <button
            onClick={downloadCSVTemplate}
            className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 font-medium transition-all"
          >
            📥 Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
          >
            📤 Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportPreview && parsedTransactions.length > 0 && (
        <CSVImportModal
          transactions={parsedTransactions}
          onClose={() => {
            setShowImportPreview(false);
            setParsedTransactions([]);
          }}
          onImport={handleImport}
        />
      )}

      {/* Merchant Rules Modal */}
      {showMerchantRules && (
        <MerchantRulesModal
          onClose={() => setShowMerchantRules(false)}
        />
      )}

      {/* Budget Planner */}
      {showBudgetPlanner && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Set Monthly Budgets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => (
              <div key={category.id} className="flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                <div className="flex-1">
                  <label className="text-sm text-white/60 mb-1 block">{category.name}</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={budgetInputs.get(category.id) || ''}
                    onChange={(e) => {
                      const newInputs = new Map(budgetInputs);
                      newInputs.set(category.id, e.target.value);
                      setBudgetInputs(newInputs);
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={saveBudgets}
              className="px-6 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Save Budgets
            </button>
            <button
              onClick={() => setShowBudgetPlanner(false)}
              className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((category) => {
          const spent = categorySpending.get(category.id) || 0;
          const budget = categoryBudgets.get(category.id) || 0;
          const percentUsed = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

          return (
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
                  <div className="text-2xl font-bold text-white">${spent.toFixed(2)}</div>
                  <div className="text-xs text-white/60">This month</div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
              <p className="text-sm text-white/60">
                Budget: ${spent.toFixed(2)} / ${budget.toFixed(2)}
              </p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentUsed > 90 ? 'bg-red-400' : percentUsed > 75 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                ></div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Spent (Month)</h3>
          <p className="text-3xl font-bold text-white">
            ${Array.from(categorySpending.values()).reduce((sum, val) => sum + val, 0).toFixed(2)}
          </p>
          <p className="text-xs text-white/40 mt-2">Across all categories</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Budget Remaining</h3>
          <p className="text-3xl font-bold text-green-400">
            ${Math.max(
              Array.from(categoryBudgets.values()).reduce((sum, val) => sum + val, 0) -
              Array.from(categorySpending.values()).reduce((sum, val) => sum + val, 0),
              0
            ).toFixed(2)}
          </p>
          <p className="text-xs text-white/40 mt-2">
            {Array.from(categoryBudgets.values()).reduce((sum, val) => sum + val, 0) > 0
              ? Math.round(
                  ((Array.from(categoryBudgets.values()).reduce((sum, val) => sum + val, 0) -
                    Array.from(categorySpending.values()).reduce((sum, val) => sum + val, 0)) /
                    Array.from(categoryBudgets.values()).reduce((sum, val) => sum + val, 0)) *
                    100
                )
              : 0}% of monthly budget
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Budget</h3>
          <p className="text-3xl font-bold text-white">
            ${Array.from(categoryBudgets.values()).reduce((sum, val) => sum + val, 0).toFixed(2)}
          </p>
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
