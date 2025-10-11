import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, CategoryItem, CategoryLog } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface CategoryHubProps {
  category: string;
  categoryName: string;
  icon: string;
  color: string;
  onBack: () => void;
}

export function CategoryHub({ category, categoryName, icon, color, onBack }: CategoryHubProps) {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [savedLogs, setSavedLogs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemFrequency, setNewItemFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'one-time'>('monthly');

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load items for this category
      const { data: itemsData, error: itemsError } = await supabase
        .from('category_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load logs for current date
      const { data: logsData, error: logsError } = await supabase
        .from('category_logs')
        .select('*, category_items!inner(category)')
        .eq('user_id', user.id)
        .eq('date', currentDate)
        .eq('category_items.category', category);

      if (logsError) throw logsError;

      // Build savedLogs set
      const savedSet = new Set<string>();
      logsData?.forEach((log: any) => {
        savedSet.add(log.category_item_id);
      });
      setSavedLogs(savedSet);

      setLoading(false);
    } catch (error) {
      console.error('Error loading category data:', error);
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setLogs(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const logAllSelected = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const selectedIds = Object.keys(logs).filter(id => logs[id]);
      if (selectedIds.length === 0) {
        alert('No items selected to log');
        return;
      }

      const logsToInsert = selectedIds.map(itemId => ({
        user_id: user.id,
        category_item_id: itemId,
        date: currentDate,
        is_planned: true,
        timestamp: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('category_logs')
        .upsert(logsToInsert, { onConflict: 'user_id,category_item_id,date' });

      if (error) throw error;

      // Update savedLogs and clear visual selections
      setSavedLogs(prev => {
        const newSet = new Set(prev);
        selectedIds.forEach(id => newSet.add(id));
        return newSet;
      });
      setLogs({});

      alert(`Logged ${selectedIds.length} item(s)!`);
    } catch (error) {
      console.error('Error logging items:', error);
      alert('Failed to log items');
    }
  };

  const addNewItem = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newItemName.trim()) {
        alert('Please enter an item name');
        return;
      }

      const { error } = await supabase
        .from('category_items')
        .insert({
          user_id: user.id,
          category: category,
          name: newItemName.trim(),
          amount: newItemAmount ? parseFloat(newItemAmount) : null,
          frequency: newItemFrequency,
          is_active: true
        });

      if (error) throw error;

      setNewItemName('');
      setNewItemAmount('');
      setShowAddItem(false);
      loadData();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('category_items')
        .update({ is_active: false })
        .eq('id', itemId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading {categoryName}...</div>
      </div>
    );
  }

  const selectedCount = Object.values(logs).filter(Boolean).length;
  const savedCount = savedLogs.size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ← Back
          </button>
          <span className="text-4xl">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{categoryName}</h1>
            <p className="text-white/60 text-sm">
              {savedCount} / {items.length} logged today
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddItem(!showAddItem)}
          className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
        >
          + Add Item
        </button>
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Item name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="number"
              placeholder="Amount (optional)"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <select
              value={newItemFrequency}
              onChange={(e) => setNewItemFrequency(e.target.value as any)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addNewItem}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Add Item
            </button>
            <button
              onClick={() => setShowAddItem(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Log Selected Button */}
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={logAllSelected}
              className="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-all shadow-lg"
            >
              Log Selected
            </button>
          </div>
        </motion.div>
      )}

      {/* Items List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Items</h2>

        {items.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No items yet. Click "Add Item" to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isLogged = savedLogs.has(item.id!);
              const isSelected = logs[item.id!] || false;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => toggleItem(item.id!)}
                      className="relative"
                    >
                      <div className={`w-6 h-6 rounded-full border-2 transition-all ${
                        isLogged
                          ? 'bg-green-500/20 border-green-500'
                          : isSelected
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'border-white/30'
                      }`}>
                        {(isLogged || isSelected) && (
                          <svg className={`w-4 h-4 ${isLogged ? 'text-green-500' : 'text-purple-500'} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>

                    <div className="flex-1">
                      <div className="font-medium text-white">{item.name}</div>
                      <div className="text-sm text-white/60">
                        {item.amount && `$${item.amount.toFixed(2)}`}
                        {item.amount && item.frequency && ' • '}
                        {item.frequency && item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteItem(item.id!)}
                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
