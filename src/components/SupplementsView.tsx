import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, Supplement, SupplementSection, Ingredient } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export function SupplementsView() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [sections, setSections] = useState<SupplementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('mg');
  const [section, setSection] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [frequencyPattern, setFrequencyPattern] = useState<'everyday' | '5/2' | 'workout' | 'custom'>('everyday');
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Set default section when sections load
  useEffect(() => {
    if (sections.length > 0 && !section) {
      setSection(sections[0].name);
    }
  }, [sections]);

  // One-time migration: fix old supplements with wrong sections
  useEffect(() => {
    const migrateOldSupplements = async () => {
      if (sections.length === 0 || supplements.length === 0) return;

      const validSectionNames = sections.map(s => s.name);
      const supplementsToFix = supplements.filter(
        s => s.section && !validSectionNames.includes(s.section)
      );

      if (supplementsToFix.length > 0) {
        console.log('Migrating supplements with invalid sections:', supplementsToFix);

        for (const supplement of supplementsToFix) {
          const { error } = await supabase
            .from('supplements')
            .update({ section: sections[0].name })
            .eq('id', supplement.id);

          if (error) {
            console.error('Error migrating supplement:', supplement.id, error);
          } else {
            console.log('Migrated supplement:', supplement.name, 'to section:', sections[0].name);
          }
        }

        // Reload data to reflect changes
        await loadData();
      }
    };

    migrateOldSupplements();
  }, [sections, supplements]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: supplementsData, error: supplementsError } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supplementsError) throw supplementsError;

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      if (sectionsError) throw sectionsError;

      setSupplements(supplementsData || []);
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('No user found');
        alert('Not authenticated. Please log in again.');
        return;
      }

      console.log('Saving supplement:', { name, dose, doseUnit, section, ingredients });

      // Calculate active_days based on frequency pattern
      let calculatedActiveDays = null;
      if (frequencyPattern === 'everyday') {
        calculatedActiveDays = [0, 1, 2, 3, 4, 5, 6];
      } else if (frequencyPattern === '5/2') {
        calculatedActiveDays = [1, 2, 3, 4, 5]; // Mon-Fri
      } else if (frequencyPattern === 'workout') {
        calculatedActiveDays = null; // Will be handled by workout tracking
      } else if (frequencyPattern === 'custom') {
        calculatedActiveDays = activeDays;
      }

      const supplementData = {
        name,
        dose: ingredients.length > 0 ? null : dose,
        dose_unit: ingredients.length > 0 ? null : doseUnit,
        ingredients: ingredients.length > 0 ? ingredients : null,
        section,
        frequency_pattern: frequencyPattern,
        active_days: calculatedActiveDays,
        notes: notes || null
      };

      if (editingSupplement) {
        // Update existing (preserve cost data)
        console.log('Updating supplement:', editingSupplement.id);
        const { error } = await supabase
          .from('supplements')
          .update(supplementData)
          .eq('id', editingSupplement.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('Updated successfully');
      } else {
        // Create new
        console.log('Creating new supplement for user:', user.id);
        const { data, error } = await supabase
          .from('supplements')
          .insert([{ user_id: user.id, ...supplementData }])
          .select();

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        console.log('Created successfully:', data);
      }

      // Reset form
      setName('');
      setDose('');
      setDoseUnit('mg');
      setSection(sections[0]?.name || '');
      setIngredients([]);
      setFrequencyPattern('everyday');
      setActiveDays([0, 1, 2, 3, 4, 5, 6]);
      setNotes('');
      setIsAdding(false);
      setEditingSupplement(null);

      // Reload
      console.log('Reloading data...');
      await loadData();
    } catch (error) {
      console.error('Error saving supplement:', error);
      alert(`Failed to save supplement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (supplement: Supplement) => {
    setEditingSupplement(supplement);
    setName(supplement.name);
    setDose(supplement.dose || '');
    setDoseUnit(supplement.dose_unit || 'mg');
    setSection(supplement.section || 'Morning');
    setIngredients(supplement.ingredients || []);
    setFrequencyPattern(supplement.frequency_pattern || 'everyday');
    setActiveDays(supplement.active_days || [0, 1, 2, 3, 4, 5, 6]);
    setNotes(supplement.notes || '');
    setIsAdding(true);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', dose: '', dose_unit: 'mg' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplement?')) return;

    try {
      const { error } = await supabase
        .from('supplements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting supplement:', error);
      alert('Failed to delete supplement');
    }
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingSupplement(null);
    setName('');
    setDose('');
    setDoseUnit('mg');
    setSection(sections[0]?.name || '');
    setIngredients([]);
    setFrequencyPattern('everyday');
    setActiveDays([0, 1, 2, 3, 4, 5, 6]);
    setNotes('');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-white text-xl">Loading supplements...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Supplements</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-6 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold transition-all"
        >
          {isAdding ? 'Cancel' : '+ Add Supplement'}
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
            {editingSupplement ? 'Edit Supplement' : 'New Supplement'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-white mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                placeholder="Vitamin D"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                {frequencyPattern === 'workout' ? (
                  <>
                    <option value="Pre-Workout">Pre-Workout</option>
                    <option value="Post-Workout">Post-Workout</option>
                  </>
                ) : (
                  sections.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))
                )}
              </select>
            </div>

            {ingredients.length === 0 && (
              <>
                <div>
                  <label className="block text-white mb-2">Dose</label>
                  <input
                    type="text"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                    placeholder="1000"
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Unit</label>
                  <select
                    value={doseUnit}
                    onChange={(e) => setDoseUnit(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                  >
                    <option value="mg">mg</option>
                    <option value="mcg">mcg</option>
                    <option value="g">g</option>
                    <option value="IU">IU</option>
                    <option value="mL">mL</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Frequency Pattern */}
          <div className="mb-4">
            <label className="block text-white mb-2">When to take</label>
            <select
              value={frequencyPattern}
              onChange={(e) => {
                const newPattern = e.target.value as any;
                setFrequencyPattern(newPattern);
                // Auto-set section when switching to/from workout mode
                if (newPattern === 'workout') {
                  setSection('Pre-Workout');
                } else if (frequencyPattern === 'workout') {
                  setSection(sections[0]?.name || '');
                }
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white mb-2"
            >
              <option value="everyday">Everyday</option>
              <option value="5/2">Mon-Fri (5/2)</option>
              <option value="workout">Workout Days Only</option>
              <option value="custom">Custom Days</option>
            </select>

            {frequencyPattern === 'custom' && (
              <div className="flex gap-2 flex-wrap">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (activeDays.includes(index)) {
                        setActiveDays(activeDays.filter(d => d !== index));
                      } else {
                        setActiveDays([...activeDays, index].sort());
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${
                      activeDays.includes(index)
                        ? 'bg-blue-500/30 border border-blue-500/50 text-blue-200'
                        : 'bg-white/10 border border-white/20 text-white/60'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ingredients Section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-white">Multi-Ingredient (optional)</label>
              <button
                type="button"
                onClick={addIngredient}
                className="px-4 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
              >
                + Add Ingredient
              </button>
            </div>
            {ingredients.map((ingredient, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  placeholder="Ingredient name"
                  className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                />
                <input
                  type="text"
                  value={ingredient.dose}
                  onChange={(e) => updateIngredient(index, 'dose', e.target.value)}
                  placeholder="Dose"
                  className="w-24 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                />
                <select
                  value={ingredient.dose_unit}
                  onChange={(e) => updateIngredient(index, 'dose_unit', e.target.value)}
                  className="w-24 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                >
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="g">g</option>
                  <option value="IU">IU</option>
                  <option value="mL">mL</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 transition-all"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Notes (Optional) */}
          <div className="mb-4">
            <label className="block text-white mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white resize-none"
              rows={3}
              placeholder="Additional details about this supplement..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-semibold transition-all"
            >
              {editingSupplement ? 'Update' : 'Add'}
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

      {/* Supplements List */}
      {supplements.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💊</div>
          <h3 className="text-2xl font-bold text-white mb-2">No Supplements Yet</h3>
          <p className="text-white/70">Click "Add Supplement" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {supplements.map((supplement) => (
            <motion.div
              key={supplement.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 hover:bg-white/15 transition-all"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{supplement.name}</h3>
                  {supplement.ingredients && supplement.ingredients.length > 0 ? (
                    <div className="text-white/70 text-sm">
                      {supplement.ingredients.map((ing, i) => (
                        <div key={i}>{ing.name}: {ing.dose} {ing.dose_unit}</div>
                      ))}
                      <div className="mt-1">{supplement.section}</div>
                    </div>
                  ) : (
                    <p className="text-white/70 text-sm">
                      {supplement.dose} {supplement.dose_unit} • {supplement.section}
                    </p>
                  )}
                  {supplement.notes && (
                    <p className="text-white/50 text-xs mt-2 italic">
                      {supplement.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(supplement)}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => supplement.id && handleDelete(supplement.id)}
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
