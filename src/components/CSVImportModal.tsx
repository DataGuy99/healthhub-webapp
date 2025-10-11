import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, TransactionRule } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { mapBankCategory, type ParsedTransaction } from '../utils/csvParser';

interface CSVImportModalProps {
  transactions: ParsedTransaction[];
  onClose: () => void;
  onImport: (mappedTransactions: MappedTransaction[]) => void;
}

export interface MappedTransaction extends ParsedTransaction {
  category: string;           // LifeDashHub category
  template: 'market' | 'covenant' | 'chronicle' | 'treasury';
  saveRule: boolean;          // Should we save this as a rule?
  splits?: TransactionSplit[]; // Sub-transactions if split
}

export interface TransactionSplit {
  amount: number;
  category: string;
  template: 'market' | 'covenant' | 'chronicle' | 'treasury';
}

const TEMPLATE_MAP: Record<string, 'market' | 'covenant' | 'chronicle' | 'treasury'> = {
  'grocery': 'market',
  'auto': 'market',
  'rent': 'covenant',
  'bills': 'covenant',
  'investment': 'treasury',
  'supplements': 'market',
  'misc-shop': 'chronicle',
  'misc-health': 'chronicle',
  'home-garden': 'chronicle',
};

const CATEGORY_OPTIONS = [
  { id: 'grocery', name: 'Grocery', icon: '🛒' },
  { id: 'auto', name: 'Auto', icon: '🚗' },
  { id: 'rent', name: 'Rent', icon: '🏠' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡' },
  { id: 'investment', name: 'Investment', icon: '📈' },
  { id: 'supplements', name: 'Supplements', icon: '💊' },
  { id: 'misc-shop', name: 'Misc Shopping', icon: '🛍️' },
  { id: 'misc-health', name: 'Misc Health', icon: '🏥' },
  { id: 'home-garden', name: 'Home & Garden', icon: '🌱' },
];

export function CSVImportModal({ transactions, onClose, onImport }: CSVImportModalProps) {
  const [mappedTransactions, setMappedTransactions] = useState<MappedTransaction[]>([]);
  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [splittingIndex, setSplittingIndex] = useState<number | null>(null);

  useEffect(() => {
    loadRulesAndMap();
  }, [transactions]);

  const loadRulesAndMap = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load existing transaction rules
      const { data: rulesData, error } = await supabase
        .from('transaction_rules')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const loadedRules = rulesData || [];
      setRules(loadedRules);

      // Map transactions using rules and category mapping
      const mapped = transactions.map(tx => {
        // Check if merchant matches any rules (case-insensitive)
        const matchingRule = loadedRules.find(rule =>
          tx.merchant.toUpperCase().includes(rule.keyword.toUpperCase())
        );

        if (matchingRule) {
          return {
            ...tx,
            category: matchingRule.category,
            template: matchingRule.template as 'market' | 'covenant' | 'chronicle' | 'treasury',
            saveRule: false,
          };
        }

        // Try automatic category mapping
        const autoCategory = mapBankCategory(tx.bankCategory);
        if (autoCategory) {
          return {
            ...tx,
            category: autoCategory,
            template: TEMPLATE_MAP[autoCategory],
            saveRule: false,
          };
        }

        // Default to misc-shop chronicle
        return {
          ...tx,
          category: 'misc-shop',
          template: 'chronicle' as const,
          saveRule: false,
        };
      });

      setMappedTransactions(mapped);
      setLoading(false);
    } catch (error) {
      console.error('Error loading rules:', error);
      setLoading(false);
    }
  };

  const updateTransaction = (index: number, updates: Partial<MappedTransaction>) => {
    const newMapped = [...mappedTransactions];
    newMapped[index] = { ...newMapped[index], ...updates };

    // If category changed, update template
    if (updates.category) {
      newMapped[index].template = TEMPLATE_MAP[updates.category];
    }

    setMappedTransactions(newMapped);
  };

  const startSplit = (index: number) => {
    const tx = mappedTransactions[index];
    // Initialize with 2 equal splits
    const halfAmount = tx.amount / 2;
    updateTransaction(index, {
      splits: [
        { amount: halfAmount, category: tx.category, template: tx.template },
        { amount: halfAmount, category: tx.category, template: tx.template },
      ]
    });
    setSplittingIndex(index);
  };

  const updateSplit = (txIndex: number, splitIndex: number, updates: Partial<TransactionSplit>) => {
    const tx = mappedTransactions[txIndex];
    if (!tx.splits) return;

    const newSplits = [...tx.splits];
    newSplits[splitIndex] = { ...newSplits[splitIndex], ...updates };

    // If category changed, update template
    if (updates.category) {
      newSplits[splitIndex].template = TEMPLATE_MAP[updates.category];
    }

    updateTransaction(txIndex, { splits: newSplits });
  };

  const addSplit = (txIndex: number) => {
    const tx = mappedTransactions[txIndex];
    if (!tx.splits) return;

    const currentTotal = tx.splits.reduce((sum, split) => sum + split.amount, 0);
    const remaining = tx.amount - currentTotal;

    updateTransaction(txIndex, {
      splits: [...tx.splits, { amount: Math.max(remaining, 0), category: tx.category, template: tx.template }]
    });
  };

  const removeSplit = (txIndex: number, splitIndex: number) => {
    const tx = mappedTransactions[txIndex];
    if (!tx.splits || tx.splits.length <= 2) return;

    const newSplits = tx.splits.filter((_, i) => i !== splitIndex);
    updateTransaction(txIndex, { splits: newSplits });
  };

  const cancelSplit = (txIndex: number) => {
    updateTransaction(txIndex, { splits: undefined });
    setSplittingIndex(null);
  };

  const saveSplit = (txIndex: number) => {
    setSplittingIndex(null);
  };

  const handleImport = () => {
    onImport(mappedTransactions);
  };

  const getCategoryIcon = (categoryId: string) => {
    return CATEGORY_OPTIONS.find(c => c.id === categoryId)?.icon || '📦';
  };

  const matchedCount = mappedTransactions.filter(tx =>
    rules.some(rule => tx.merchant.toUpperCase().includes(rule.keyword.toUpperCase()))
  ).length;

  const autoMappedCount = mappedTransactions.filter(tx => {
    const hasRule = rules.some(rule => tx.merchant.toUpperCase().includes(rule.keyword.toUpperCase()));
    return !hasRule && mapBankCategory(tx.bankCategory);
  }).length;

  const unmappedCount = mappedTransactions.length - matchedCount - autoMappedCount;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-xl rounded-2xl border border-white/20 max-w-6xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Import Transactions</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="px-3 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300">
                {matchedCount} matched by rules
              </div>
              <div className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300">
                {autoMappedCount} auto-mapped
              </div>
              <div className="px-3 py-1 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
                {unmappedCount} need review
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
            <div className="space-y-3">
              {mappedTransactions.map((tx, index) => {
                const splitTotal = tx.splits?.reduce((sum, split) => sum + split.amount, 0) || 0;
                const splitDiff = tx.splits ? tx.amount - splitTotal : 0;
                const isSplitValid = !tx.splits || Math.abs(splitDiff) < 0.01;

                return (
                  <div
                    key={index}
                    className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Date & Amount */}
                      <div className="flex-shrink-0 w-32">
                        <div className="text-white/60 text-xs mb-1">{tx.date}</div>
                        <div className="text-white font-semibold">${tx.amount.toFixed(2)}</div>
                        {tx.splits && (
                          <div className={`text-xs mt-1 ${isSplitValid ? 'text-green-400' : 'text-red-400'}`}>
                            {splitDiff > 0 ? `+$${splitDiff.toFixed(2)}` : splitDiff < 0 ? `-$${Math.abs(splitDiff).toFixed(2)}` : '✓'}
                          </div>
                        )}
                      </div>

                      {/* Merchant */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{tx.merchant}</div>
                        <div className="text-white/40 text-xs">{tx.bankCategory}</div>
                      </div>

                      {!tx.splits ? (
                        <>
                          {/* Category Select */}
                          <div className="flex-shrink-0 w-48">
                            <select
                              value={tx.category}
                              onChange={(e) => updateTransaction(index, { category: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                              {CATEGORY_OPTIONS.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.icon} {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Template Badge */}
                          <div className="flex-shrink-0 w-24">
                            <div className={`px-2 py-1 rounded text-xs font-medium text-center ${
                              tx.template === 'market' ? 'bg-green-500/20 text-green-300' :
                              tx.template === 'covenant' ? 'bg-blue-500/20 text-blue-300' :
                              tx.template === 'chronicle' ? 'bg-purple-500/20 text-purple-300' :
                              'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {tx.template.toUpperCase()}
                            </div>
                          </div>

                          {/* Save Rule Checkbox */}
                          <div className="flex-shrink-0">
                            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tx.saveRule}
                                onChange={(e) => updateTransaction(index, { saveRule: e.target.checked })}
                                className="rounded"
                              />
                              <span>Save rule</span>
                            </label>
                          </div>

                          {/* Split Button */}
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => startSplit(index)}
                              className="px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all"
                            >
                              Split
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1">
                          <div className="space-y-2 mb-2">
                            {tx.splits.map((split, splitIndex) => (
                              <div key={splitIndex} className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={split.amount}
                                  onChange={(e) => updateSplit(index, splitIndex, { amount: parseFloat(e.target.value) || 0 })}
                                  className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                />
                                <select
                                  value={split.category}
                                  onChange={(e) => updateSplit(index, splitIndex, { category: e.target.value })}
                                  className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                                >
                                  {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.icon} {cat.name}
                                    </option>
                                  ))}
                                </select>
                                {tx.splits && tx.splits.length > 2 && (
                                  <button
                                    onClick={() => removeSplit(index, splitIndex)}
                                    className="text-red-400 hover:text-red-300 text-xs"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addSplit(index)}
                              className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs"
                            >
                              + Add Split
                            </button>
                            <button
                              onClick={() => saveSplit(index)}
                              disabled={!isSplitValid}
                              className={`px-2 py-1 rounded text-xs ${
                                isSplitValid
                                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                                  : 'bg-white/10 text-white/40 cursor-not-allowed'
                              }`}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => cancelSplit(index)}
                              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-6 flex gap-3">
            <button
              onClick={handleImport}
              className="flex-1 px-6 py-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Import {mappedTransactions.length} Transactions
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
