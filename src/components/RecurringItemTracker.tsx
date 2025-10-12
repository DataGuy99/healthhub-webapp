import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface RecurringItem {
  id?: string;
  user_id?: string;
  category: string; // 'bills', 'rent', 'auto', 'grocery', etc.
  name: string;
  description?: string;
  amount?: number;
  frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'one-time';
  due_date?: string; // For bills/rent
  last_done?: string; // For maintenance
  notes?: string;
  completed?: boolean;
  created_at?: string;
}

interface TrackerConfig {
  category: string;
  title: string;
  icon: string;
  addButtonText: string;
  emptyMessage: string;
  showAmount?: boolean;
  showFrequency?: boolean;
  showDueDate?: boolean;
  showCompleted?: boolean;
  colorScheme: string;
}

interface RecurringItemTrackerProps {
  config: TrackerConfig;
}

export function RecurringItemTracker({ config }: RecurringItemTrackerProps) {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<RecurringItem>>({
    name: '',
    description: '',
    category: config.category,
    frequency: 'monthly',
    completed: false,
  });

  useEffect(() => {
    loadItems();
  }, [config.category]);

  const loadItems = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', config.category)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading items:', error);
      setLoading(false);
    }
  };

  const addItem = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newItem.name) {
        alert('Please fill in the name');
        return;
      }

      const { error } = await supabase
        .from('recurring_items')
        .insert([{
          ...newItem,
          user_id: user.id,
          category: config.category,
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      setNewItem({ name: '', description: '', category: config.category, frequency: 'monthly', completed: false });
      setShowAddForm(false);
      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const toggleComplete = async (item: RecurringItem) => {
    try {
      const { error } = await supabase
        .from('recurring_items')
        .update({
          completed: !item.completed,
          last_done: !item.completed ? new Date().toISOString() : item.last_done,
        })
        .eq('id', item.id);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;

    try {
      const { error } = await supabase
        .from('recurring_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{config.icon} {config.title}</h2>
          <p className="text-white/60 text-sm">Track and manage your {config.title.toLowerCase()}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 rounded-lg ${config.colorScheme} font-medium transition-all`}
        >
          {showAddForm ? '✕ Cancel' : config.addButtonText}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={config.showFrequency ? '' : 'md:col-span-2'}>
              <label className="block text-sm text-white/70 mb-2">Name</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="Item name"
              />
            </div>

            {config.showAmount && (
              <div>
                <label className="block text-sm text-white/70 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.amount || ''}
                  onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || undefined })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="$0.00"
                />
              </div>
            )}

            {config.showFrequency && (
              <div>
                <label className="block text-sm text-white/70 mb-2">Frequency</label>
                <select
                  value={newItem.frequency}
                  onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="daily" className="bg-slate-800">Daily</option>
                  <option value="weekly" className="bg-slate-800">Weekly</option>
                  <option value="biweekly" className="bg-slate-800">Biweekly</option>
                  <option value="monthly" className="bg-slate-800">Monthly</option>
                  <option value="yearly" className="bg-slate-800">Yearly</option>
                  <option value="one-time" className="bg-slate-800">One-time</option>
                </select>
              </div>
            )}

            {config.showDueDate && (
              <div>
                <label className="block text-sm text-white/70 mb-2">Due Date</label>
                <input
                  type="date"
                  value={newItem.due_date || ''}
                  onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
              <textarea
                value={newItem.notes || ''}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                rows={2}
                placeholder="Additional details..."
              />
            </div>
          </div>

          <button
            onClick={addItem}
            className={`mt-4 px-6 py-2 rounded-lg ${config.colorScheme.replace(/\/20|\/30/g, '')} text-white font-semibold transition-all`}
          >
            Add Item
          </button>
        </motion.div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">{config.emptyMessage}</div>
            <div className="text-white/60 text-sm">Click "{config.addButtonText}" to get started</div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/8 transition-all ${
                item.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {config.showCompleted && (
                      <button
                        onClick={() => toggleComplete(item)}
                        className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                          item.completed
                            ? 'bg-green-500/20 border-green-500'
                            : 'border-white/30 hover:border-white/50'
                        }`}
                      >
                        {item.completed && (
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )}
                    <div>
                      <div className={`font-semibold text-white text-lg ${item.completed ? 'line-through' : ''}`}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div className="text-sm text-white/60">{item.description}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 ml-9">
                    {item.amount && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Amount</div>
                        <div className="text-white font-medium">${item.amount.toFixed(2)}</div>
                      </div>
                    )}
                    {item.frequency && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Frequency</div>
                        <div className="text-white font-medium capitalize">{item.frequency}</div>
                      </div>
                    )}
                    {item.due_date && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Due Date</div>
                        <div className="text-white font-medium">
                          {new Date(item.due_date).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {item.last_done && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Last Done</div>
                        <div className="text-white font-medium">
                          {new Date(item.last_done).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.notes && (
                    <div className="mt-3 ml-9 text-sm text-white/70 bg-black/20 rounded-lg p-3">
                      {item.notes}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteItem(item.id!)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
