import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, TransactionRule } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { TEMPLATE_MAP } from '../constants/templates';

interface MerchantRulesModalProps {
  onClose: () => void;
}

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

export function MerchantRulesModal({ onClose }: MerchantRulesModalProps) {
  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('grocery');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transaction_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('keyword');

      if (error) throw error;

      setRules(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading rules:', error);
      setLoading(false);
    }
  };

  const addRule = async () => {
    if (!newKeyword.trim()) return;

    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { error } = await supabase
        .from('transaction_rules')
        .insert({
          user_id: user.id,
          keyword: newKeyword.toUpperCase(),
          category: newCategory,
          template: TEMPLATE_MAP[newCategory],
        });

      if (error) throw error;

      setNewKeyword('');
      setNewCategory('grocery');
      loadRules();
    } catch (error) {
      console.error('Error adding rule:', error);
      alert('Failed to add rule');
    }
  };

  const updateRule = async (rule: TransactionRule) => {
    try {
      const { error } = await supabase
        .from('transaction_rules')
        .update({
          category: rule.category,
          template: TEMPLATE_MAP[rule.category],
        })
        .eq('id', rule.id);

      if (error) throw error;

      setEditingRule(null);
      loadRules();
    } catch (error) {
      console.error('Error updating rule:', error);
      alert('Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: string | undefined) => {
    if (!ruleId) {
      alert('Cannot delete rule: missing ID');
      return;
    }

    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('transaction_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8">
          <div className="text-white">Loading rules...</div>
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
          className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-xl rounded-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Merchant Recognition Rules</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-white/60 text-sm">
              Train the system to automatically categorize transactions based on merchant keywords.
            </p>
          </div>

          {/* Add New Rule */}
          <div className="border-b border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Add New Rule</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Keyword (e.g., KROGER)"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addRule}
                className="px-6 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
              >
                Add Rule
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="overflow-y-auto max-h-[calc(90vh-350px)] p-6">
            {rules.length === 0 ? (
              <div className="text-center text-white/40 py-8">
                No rules yet. Add your first rule above!
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* Keyword */}
                      <div className="flex-shrink-0 w-48">
                        <div className="text-white font-medium">{rule.keyword}</div>
                      </div>

                      {/* Category */}
                      {editingRule?.id === rule.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <select
                            value={editingRule.category}
                            onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          >
                            {CATEGORY_OPTIONS.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => updateRule(editingRule)}
                            className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingRule(null)}
                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="text-white/80">
                              {CATEGORY_OPTIONS.find(c => c.id === rule.category)?.icon}{' '}
                              {CATEGORY_OPTIONS.find(c => c.id === rule.category)?.name}
                            </div>
                          </div>

                          {/* Template Badge */}
                          <div className="flex-shrink-0 w-24">
                            <div className={`px-2 py-1 rounded text-xs font-medium text-center ${
                              rule.template === 'market' ? 'bg-green-500/20 text-green-300' :
                              rule.template === 'covenant' ? 'bg-blue-500/20 text-blue-300' :
                              rule.template === 'chronicle' ? 'bg-purple-500/20 text-purple-300' :
                              'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {rule.template?.toUpperCase()}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingRule(rule)}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteRule(rule.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-6">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
