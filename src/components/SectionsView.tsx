import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export function SectionsView() {
  const [sections, setSections] = useState<SupplementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSection, setEditingSection] = useState<SupplementSection | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true});

      if (error) throw error;

      // Add default sections if none exist
      const allSections = data || [];
      const defaults = ['Morning', 'Afternoon', 'Evening', 'Night'];

      if (allSections.length === 0) {
        // Create default sections
        for (let i = 0; i < defaults.length; i++) {
          await supabase
            .from('supplement_sections')
            .insert([{ user_id: user.id, name: defaults[i], order: i }]);
        }
        // Reload after creating defaults
        const { data: reloadedData } = await supabase
          .from('supplement_sections')
          .select('*')
          .eq('user_id', user.id)
          .order('order', { ascending: true });
        setSections(reloadedData || []);
      } else {
        setSections(allSections);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (editingSection) {
        // Update existing
        const { error } = await supabase
          .from('supplement_sections')
          .update({ name })
          .eq('id', editingSection.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('supplement_sections')
          .insert([{ user_id: user.id, name, order: sections.length }]);

        if (error) throw error;
      }

      // Reset form
      setName('');
      setIsAdding(false);
      setEditingSection(null);

      // Reload
      await loadSections();
    } catch (error) {
      console.error('Error saving section:', error);
      alert('Failed to save section');
    }
  };

  const handleEdit = (section: SupplementSection) => {
    setEditingSection(section);
    setName(section.name);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this section? Supplements using this section will need to be reassigned.')) return;

    try {
      const { error } = await supabase
        .from('supplement_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadSections();
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('Failed to delete section');
    }
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingSection(null);
    setName('');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-white text-xl">Loading sections...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Time Sections</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-6 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold transition-all"
        >
          {isAdding ? 'Cancel' : '+ Add Section'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="mb-6 p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20"
        >
          <h3 className="text-xl font-bold text-white mb-4">
            {editingSection ? 'Edit Section' : 'New Section'}
          </h3>

          <div className="mb-4">
            <label className="block text-white mb-2">Section Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
              placeholder="e.g., Morning, Lunch, Pre-Workout"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-semibold transition-all"
            >
              {editingSection ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Sections List */}
      {sections.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🕐</div>
          <h3 className="text-2xl font-bold text-white mb-2">No Sections Yet</h3>
          <p className="text-white/70">Click "Add Section" to create your first time section</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 hover:bg-white/15 transition-all"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white">{section.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(section)}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => section.id && handleDelete(section.id)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
