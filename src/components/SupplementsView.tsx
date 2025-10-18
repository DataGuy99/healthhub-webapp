import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, Supplement, SupplementSection, Ingredient } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { ConfirmModal } from './ConfirmModal';
import { addToPurchaseQueue } from '../lib/budgetOptimizer';

export function SupplementsView() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [sections, setSections] = useState<SupplementSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [selectedSupplements, setSelectedSupplements] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id?: string; isBatch?: boolean }>({ isOpen: false });

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
    // If clicking edit on already-editing supplement, close it
    if (editingSupplement?.id === supplement.id) {
      cancelEdit();
      return;
    }

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
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    try {
      if (deleteConfirm.isBatch) {
        const idsToDelete = Array.from(selectedSupplements);
        const { error } = await supabase
          .from('supplements')
          .delete()
          .in('id', idsToDelete);

        if (error) throw error;
        setSelectedSupplements(new Set());
        setIsSelectionMode(false);
      } else if (deleteConfirm.id) {
        const { error } = await supabase
          .from('supplements')
          .delete()
          .eq('id', deleteConfirm.id);

        if (error) throw error;
      }
      setDeleteConfirm({ isOpen: false });
      await loadData();
    } catch (error) {
      console.error('Error deleting supplement:', error);
      alert('Failed to delete supplement');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSupplements.size === 0) return;
    setDeleteConfirm({ isOpen: true, isBatch: true });
  };

  const toggleSelection = (id: string) => {
    setSelectedSupplements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedSupplements(new Set(supplements.map(s => s.id!).filter(Boolean)));
  };

  const deselectAll = () => {
    setSelectedSupplements(new Set());
  };

  const handleAddToQueue = async (supplement: Supplement) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        alert('Please log in to add to queue');
        return;
      }

      await addToPurchaseQueue(user.id, {
        item_name: supplement.name,
        category: 'supplements',
        estimated_cost: supplement.cost || 25.00, // Default if no cost set
        health_impact_score: 0, // Will be calculated by correlation engine
        timing_optimality_score: 50, // Default middle score
        notes: supplement.notes || undefined
      });

      alert(`${supplement.name} added to purchase queue!`);
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add to purchase queue');
    }
  };

  const EditFormComponent = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mt-3"
    >
      <form
        onSubmit={handleSubmit}
        className="p-6 bg-blue-500/10 backdrop-blur-xl rounded-2xl border border-blue-500/30"
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
      </form>
    </motion.div>
  );

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
        <div className="flex gap-2">
          {!isSelectionMode ? (
            <>
              <button
                onClick={() => setIsSelectionMode(true)}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
              >
                Select
              </button>
              <button
                onClick={() => setIsAdding(!isAdding)}
                className="px-6 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold transition-all"
              >
                {isAdding ? 'Cancel' : '+ Add'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={selectAll}
                className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 text-sm transition-all"
              >
                All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm transition-all"
              >
                None
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={selectedSupplements.size === 0}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-300 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete ({selectedSupplements.size})
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedSupplements(new Set());
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-semibold transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

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
            <div key={supplement.id}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onClick={() => isSelectionMode && supplement.id && toggleSelection(supplement.id)}
                className={`p-4 rounded-xl border ${
                  isSelectionMode && selectedSupplements.has(supplement.id!)
                    ? 'bg-purple-500/20 border-purple-500/40 backdrop-blur-xl'
                    : 'bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15'
                } ${isSelectionMode ? 'cursor-pointer' : ''}`}
              >
                <div className="flex justify-between items-center">
                  {isSelectionMode && (
                    <div className="mr-3">
                      <div
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                          selectedSupplements.has(supplement.id!)
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-white/30'
                        }`}
                      >
                        {selectedSupplements.has(supplement.id!) && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
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
                  {!isSelectionMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToQueue(supplement)}
                        className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-300 transition-all text-sm"
                        title="Add to Purchase Queue"
                      >
                        📋 Queue
                      </button>
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
                  )}
                </div>
              </motion.div>

              {/* Inline Edit Form */}
              <AnimatePresence>
                {editingSupplement?.id === supplement.id && (
                  <EditFormComponent />
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Add New Form at bottom */}
          <AnimatePresence>
            {isAdding && !editingSupplement && (
              <EditFormComponent />
            )}
          </AnimatePresence>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.isBatch ? 'Delete Supplements?' : 'Delete Supplement?'}
        message={deleteConfirm.isBatch
          ? `Are you sure you want to delete ${selectedSupplements.size} supplement(s)? This action cannot be undone.`
          : 'Are you sure you want to delete this supplement? This action cannot be undone.'}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false })}
      />
    </div>
  );
}
