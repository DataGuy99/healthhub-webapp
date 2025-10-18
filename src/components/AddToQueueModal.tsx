import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addToPurchaseQueue } from '../lib/budgetOptimizer';
import { getCurrentUser } from '../lib/auth';

interface AddToQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  prefillData?: {
    item_name?: string;
    category?: string;
    estimated_cost?: number;
    notes?: string;
  };
}

const CATEGORIES = [
  { id: 'supplements', name: 'Supplements', icon: '💊' },
  { id: 'grocery', name: 'Grocery', icon: '🛒' },
  { id: 'auto', name: 'Auto', icon: '🚗' },
  { id: 'bills', name: 'Bills & Utilities', icon: '💡' },
  { id: 'investment', name: 'Investment', icon: '📈' },
  { id: 'misc-shop', name: 'Misc Shopping', icon: '🛍️' },
  { id: 'misc-health', name: 'Misc Health', icon: '🏥' },
  { id: 'home-garden', name: 'Home & Garden', icon: '🌱' },
  { id: 'other', name: 'Other', icon: '📦' },
];

export function AddToQueueModal({ isOpen, onClose, onSuccess, prefillData }: AddToQueueModalProps) {
  const [itemName, setItemName] = useState(prefillData?.item_name || '');
  const [category, setCategory] = useState(prefillData?.category || 'supplements');
  const [estimatedCost, setEstimatedCost] = useState(prefillData?.estimated_cost?.toString() || '');
  const [productLink, setProductLink] = useState('');
  const [notes, setNotes] = useState(prefillData?.notes || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const user = await getCurrentUser();
      if (!user) {
        alert('Please log in to add items to queue');
        return;
      }

      const cost = parseFloat(estimatedCost) || 0;

      // Map priority to urgency score
      const urgencyMap = {
        low: 30,
        medium: 50,
        high: 75,
        urgent: 95
      };

      const fullNotes = [
        notes,
        productLink ? `Link: ${productLink}` : null
      ].filter(Boolean).join('\n');

      await addToPurchaseQueue(user.id, {
        item_name: itemName,
        category: category,
        estimated_cost: cost,
        health_impact_score: 50, // Default - will be updated by correlation engine
        timing_optimality_score: 50,
        urgency_score: urgencyMap[priority],
        notes: fullNotes || undefined
      });

      // Reset form
      setItemName('');
      setCategory('supplements');
      setEstimatedCost('');
      setProductLink('');
      setNotes('');
      setPriority('medium');

      onSuccess?.();
      onClose();
      alert('Item added to purchase queue!');
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add item to queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-gradient-to-br from-slate-900 to-slate-800 border-b border-white/10 p-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Add to Purchase Queue</h2>
                <p className="text-white/60 text-sm mt-1">
                  Add any item you're considering purchasing
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white text-2xl transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Item Name */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Item Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                placeholder="e.g., Omega-3 Fish Oil, New Tires, Coffee Maker"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      category === cat.id
                        ? 'bg-purple-500/30 border-purple-500 text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xl mb-1">{cat.icon}</div>
                    <div className="text-sm font-medium">{cat.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Cost */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Estimated Cost <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>

            {/* Product Link */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Product Link (Optional)
              </label>
              <input
                type="url"
                value={productLink}
                onChange={(e) => setProductLink(e.target.value)}
                placeholder="https://amazon.com/product-name"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <p className="text-white/50 text-xs mt-1">
                Add a link to the product for easy access later
              </p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'low', label: 'Low', color: 'bg-gray-500' },
                  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
                  { value: 'high', label: 'High', color: 'bg-orange-500' },
                  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value as any)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      priority === p.value
                        ? `${p.color} border-white/40 text-white`
                        : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why do you want this? Any specific features or details..."
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border border-purple-400/50 rounded-xl text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add to Queue'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
