import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, UserCategory, CategoryTemplate, SubTabConfig } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface CategoryManagerProps {
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

const TEMPLATE_OPTIONS: { value: CategoryTemplate; label: string; description: string }[] = [
  { value: 'checklist', label: '✓ Checklist', description: 'Recurring items to check off (supplements, groceries, tasks)' },
  { value: 'spending', label: '💰 Spending Tracker', description: 'Track expenses and costs over time' },
  { value: 'events', label: '📅 Events Log', description: 'One-time events and records (purchases, appointments)' },
  // Phase 6.2: Removed 'investments' template option
];

const COLOR_OPTIONS = [
  { name: 'Purple', value: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  { name: 'Green', value: 'from-green-500/20 to-emerald-500/20 border-green-500/30' },
  { name: 'Blue', value: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' },
  { name: 'Red', value: 'from-red-500/20 to-rose-500/20 border-red-500/30' },
  { name: 'Yellow', value: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30' },
  { name: 'Indigo', value: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30' },
  { name: 'Pink', value: 'from-pink-500/20 to-fuchsia-500/20 border-pink-500/30' },
  { name: 'Teal', value: 'from-teal-500/20 to-cyan-500/20 border-teal-500/30' },
  { name: 'Lime', value: 'from-lime-500/20 to-green-500/20 border-lime-500/30' },
];

const COMMON_ICONS = ['💊', '🛒', '🏠', '💡', '🚗', '📈', '🛍️', '🏥', '🌱', '💰', '📚', '🎮', '🍔', '✈️', '🏋️', '🎵', '📱', '🎨'];

export function CategoryManager({ onClose, onCategoriesUpdated }: CategoryManagerProps) {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UserCategory | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('📁');
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value);
  const [formTemplate, setFormTemplate] = useState<CategoryTemplate>('checklist');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading categories:', error);
      setLoading(false);
    }
  };

  const createCategory = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!formName.trim()) {
        alert('Please enter a category name');
        return;
      }

      const slug = formName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const maxOrder = Math.max(...categories.map(c => c.order), 0);

      const { error } = await supabase
        .from('user_categories')
        .insert({
          user_id: user.id,
          name: formName.trim(),
          slug: slug,
          icon: formIcon,
          color: formColor,
          template: formTemplate,
          order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;

      resetForm();
      setShowCreateForm(false);
      loadCategories();
      onCategoriesUpdated();
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category');
    }
  };

  const updateCategory = async () => {
    if (!editingCategory) return;

    try {
      const slug = formName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const { error } = await supabase
        .from('user_categories')
        .update({
          name: formName.trim(),
          slug: slug,
          icon: formIcon,
          color: formColor,
          template: formTemplate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingCategory.id);

      if (error) throw error;

      resetForm();
      setEditingCategory(null);
      loadCategories();
      onCategoriesUpdated();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const deleteCategory = async (category: UserCategory) => {
    if (!confirm(`Delete "${category.name}" category? This will NOT delete your data, just hide the category.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_categories')
        .update({ is_active: false })
        .eq('id', category.id);

      if (error) throw error;

      loadCategories();
      onCategoriesUpdated();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const startEdit = (category: UserCategory) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormIcon(category.icon);
    setFormColor(category.color);
    setFormTemplate(category.template);
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormIcon('📁');
    setFormColor(COLOR_OPTIONS[0].value);
    setFormTemplate('checklist');
    setEditingCategory(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border-2 border-white/20 p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">⚙️ Manage Categories</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ✕ Close
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Category Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Fitness, Travel, Hobbies"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Icon (click to select)</label>
                <div className="flex gap-2 flex-wrap">
                  {COMMON_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setFormIcon(icon)}
                      className={`text-3xl p-2 rounded-lg transition-all ${
                        formIcon === icon
                          ? 'bg-purple-500/30 border-2 border-purple-500 scale-110'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="Or paste any emoji"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setFormColor(color.value)}
                      className={`px-4 py-3 rounded-lg bg-gradient-to-r ${color.value} font-medium transition-all ${
                        formColor === color.value ? 'ring-2 ring-white scale-105' : ''
                      }`}
                    >
                      <span className="text-white">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Type */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Functionality Type</label>
                <div className="space-y-2">
                  {TEMPLATE_OPTIONS.map(template => (
                    <button
                      key={template.value}
                      onClick={() => setFormTemplate(template.value)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        formTemplate === template.value
                          ? 'bg-purple-500/20 border-purple-500 text-white'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold">{template.label}</div>
                      <div className="text-sm opacity-70">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={editingCategory ? updateCategory : createCategory}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all"
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
                className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-white font-semibold transition-all mb-6"
          >
            + Create New Category
          </button>
        )}

        {/* Categories List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white/80 mb-3">Your Categories</h3>
          {categories.filter(c => c.is_active).length === 0 ? (
            <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
              <div className="text-white/40 text-lg">No custom categories yet</div>
              <div className="text-white/60 text-sm mt-2">Create your first category to get started!</div>
            </div>
          ) : (
            categories.filter(c => c.is_active).map(category => (
              <div
                key={category.id}
                className={`bg-gradient-to-r ${category.color} backdrop-blur-xl rounded-xl border p-4 hover:scale-[1.02] transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{category.icon}</div>
                    <div>
                      <div className="font-bold text-white text-lg">{category.name}</div>
                      <div className="text-sm text-white/60">
                        {TEMPLATE_OPTIONS.find(t => t.value === category.template)?.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-sm transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCategory(category)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
