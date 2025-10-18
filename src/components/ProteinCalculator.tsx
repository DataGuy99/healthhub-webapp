import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface ProteinCalculation {
  id?: string;
  user_id?: string;
  food_name: string;
  serving_size: number;
  serving_unit: string;
  protein_grams: number;
  num_servings: number;
  price: number;
  cost_per_gram: number;
  date: string;
  notes?: string;
  created_at?: string;
}

interface ProteinTarget {
  id?: string;
  user_id?: string;
  target_cost_per_gram: number;
  tolerance_percentage: number;
  created_at?: string;
}

export function ProteinCalculator() {
  const [calculations, setCalculations] = useState<ProteinCalculation[]>([]);
  const [target, setTarget] = useState<ProteinTarget | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick calculator state
  const [foodName, setFoodName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [servingUnit, setServingUnit] = useState('oz');
  const [proteinGrams, setProteinGrams] = useState('');
  const [numServings, setNumServings] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  // Target settings state
  const [showTargetSettings, setShowTargetSettings] = useState(false);
  const [targetCost, setTargetCost] = useState('');
  const [tolerancePercent, setTolerancePercent] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load calculations
      const { data: calcsData, error: calcsError } = await supabase
        .from('protein_calculations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (calcsError) throw calcsError;
      setCalculations(calcsData || []);

      // Load target
      const { data: targetData, error: targetError } = await supabase
        .from('protein_targets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (targetError && targetError.code !== 'PGRST116') throw targetError;
      setTarget(targetData);

      if (targetData) {
        // Convert from dollars to cents for display
        setTargetCost((targetData.target_cost_per_gram * 100).toFixed(1));
        setTolerancePercent(targetData.tolerance_percentage.toString());
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const calculate = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!foodName.trim() || !servingSize || !proteinGrams || !numServings || !price) {
        alert('Please fill in all required fields');
        return;
      }

      const serving = parseFloat(servingSize);
      const protein = parseFloat(proteinGrams);
      const servings = parseFloat(numServings);
      const cost = parseFloat(price);

      if (serving <= 0 || protein <= 0 || servings <= 0 || cost <= 0) {
        alert('Values must be greater than 0');
        return;
      }

      // Calculate total protein: protein per serving × number of servings
      const totalProtein = protein * servings;
      const costPerGram = cost / totalProtein;

      const { error } = await supabase
        .from('protein_calculations')
        .insert({
          user_id: user.id,
          food_name: foodName.trim(),
          serving_size: serving,
          serving_unit: servingUnit,
          protein_grams: protein,
          num_servings: servings,
          price: cost,
          cost_per_gram: costPerGram,
          date: new Date().toISOString().split('T')[0],
          notes: notes.trim() || null,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Reset form
      setFoodName('');
      setServingSize('');
      setProteinGrams('');
      setNumServings('');
      setPrice('');
      setNotes('');
      loadData();
    } catch (error) {
      console.error('Error saving calculation:', error);
      alert('Failed to save calculation');
    }
  };

  const saveTarget = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!targetCost || !tolerancePercent) {
        alert('Please fill in target cost and tolerance');
        return;
      }

      const costInCents = parseFloat(targetCost);
      const tolerance = parseFloat(tolerancePercent);

      if (costInCents <= 0 || tolerance < 0) {
        alert('Invalid values');
        return;
      }

      // Convert cents to dollars for storage
      const costInDollars = costInCents / 100;

      if (target) {
        // Update existing
        const { error } = await supabase
          .from('protein_targets')
          .update({
            target_cost_per_gram: costInDollars,
            tolerance_percentage: tolerance,
          })
          .eq('id', target.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('protein_targets')
          .insert({
            user_id: user.id,
            target_cost_per_gram: costInDollars,
            tolerance_percentage: tolerance,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setShowTargetSettings(false);
      loadData();
    } catch (error) {
      console.error('Error saving target:', error);
      alert('Failed to save target');
    }
  };

  const deleteCalculation = async (id: string) => {
    if (!confirm('Delete this calculation?')) return;

    try {
      const { error } = await supabase
        .from('protein_calculations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting calculation:', error);
      alert('Failed to delete calculation');
    }
  };

  const markAsBought = async (calc: ProteinCalculation) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const totalProtein = calc.protein_grams * calc.num_servings;

      const { error } = await supabase
        .from('grocery_purchases')
        .insert({
          user_id: user.id,
          store: calc.notes || 'Grocery Store',
          amount: calc.price,
          date: new Date().toISOString().split('T')[0],
          notes: `${calc.food_name} - ${calc.serving_size}${calc.serving_unit} × ${calc.num_servings} servings`,
          protein_grams: totalProtein,
          is_protein_source: true,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      alert(`✓ Added ${calc.food_name} to Grocery purchases!`);
    } catch (error) {
      console.error('Error marking as bought:', error);
      alert('Failed to mark as bought');
    }
  };

  const getCostStatus = (costPerGram: number) => {
    if (!target) return 'neutral';

    const targetCost = target.target_cost_per_gram;
    const maxAcceptable = targetCost * (1 + target.tolerance_percentage / 100);

    if (costPerGram <= targetCost) return 'excellent';
    if (costPerGram <= maxAcceptable) return 'acceptable';
    return 'expensive';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/50';
      case 'acceptable':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/50';
      case 'expensive':
        return 'from-red-500/20 to-rose-500/20 border-red-500/50';
      default:
        return 'from-white/5 to-white/10 border-white/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent':
        return '✓ Great Value';
      case 'acceptable':
        return '⚠ Within Tolerance';
      case 'expensive':
        return '✗ Over Budget';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading calculator...</div>
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
          <h2 className="text-3xl font-bold text-white">🥩 Protein Cost Calculator</h2>
          <p className="text-white/60 text-sm">Calculate cost per gram of protein</p>
        </div>
        <button
          onClick={() => setShowTargetSettings(!showTargetSettings)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
        >
          ⚙️ Target Settings
        </button>
      </div>

      {/* Target Display */}
      {target && (
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5">
          <div className="text-white/70 text-sm mb-2">Your Target</div>
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-white text-3xl font-bold">{(target.target_cost_per_gram * 100).toFixed(1)}¢</span>
              <span className="text-white/60 text-lg ml-2">per gram</span>
            </div>
            <div className="text-white/60">
              (tolerance: +{target.tolerance_percentage}%)
            </div>
          </div>
        </div>
      )}

      {/* Target Settings */}
      {showTargetSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Set Your Protein Cost Target</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Target Cost per Gram (¢)</label>
              <input
                type="number"
                step="0.1"
                value={targetCost}
                onChange={(e) => setTargetCost(e.target.value)}
                placeholder="e.g., 5.5"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Tolerance (%)</label>
              <input
                type="number"
                step="1"
                value={tolerancePercent}
                onChange={(e) => setTolerancePercent(e.target.value)}
                placeholder="e.g., 15"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
          </div>
          <button
            onClick={saveTarget}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all"
          >
            Save Target
          </button>
        </motion.div>
      )}

      {/* Quick Calculator */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Quick Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-white/70 mb-2">Food Name</label>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g., Chicken Breast"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Serving Size</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                placeholder="10"
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
              <select
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
              >
                <option value="oz" className="bg-slate-800">oz</option>
                <option value="lb" className="bg-slate-800">lb</option>
                <option value="g" className="bg-slate-800">g</option>
                <option value="kg" className="bg-slate-800">kg</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Protein per Serving (g)</label>
            <input
              type="number"
              step="0.1"
              value={proteinGrams}
              onChange={(e) => setProteinGrams(e.target.value)}
              placeholder="25"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
            <p className="text-xs text-white/50 mt-1">Per serving</p>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Number of Servings</label>
            <input
              type="number"
              step="0.1"
              value={numServings}
              onChange={(e) => setNumServings(e.target.value)}
              placeholder="4"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
            <p className="text-xs text-white/50 mt-1">In package</p>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Total Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="12.99"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
            <p className="text-xs text-white/50 mt-1">For whole package</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., From Walmart, on sale"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
        </div>
        <button
          onClick={calculate}
          className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all"
        >
          Calculate & Save
        </button>
      </div>

      {/* Calculation History */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white">Recent Calculations</h3>
        {calculations.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No calculations yet</div>
            <div className="text-white/60 text-sm">Use the calculator above to track protein costs</div>
          </div>
        ) : (
          calculations.map((calc) => {
            const status = getCostStatus(calc.cost_per_gram);
            const statusColor = getStatusColor(status);
            const statusLabel = getStatusLabel(status);

            return (
              <div
                key={calc.id}
                className={`bg-gradient-to-r ${statusColor} backdrop-blur-xl rounded-2xl border p-5 hover:scale-[1.01] transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl">🥩</div>
                      <div>
                        <div className="font-bold text-white text-lg">{calc.food_name}</div>
                        <div className="text-sm text-white/60">
                          {calc.serving_size}{calc.serving_unit} serving × {calc.num_servings} servings • {calc.protein_grams}g protein per serving • ${calc.price.toFixed(2)} total
                        </div>
                        <div className="text-xs text-white/50">
                          Total protein: {(calc.protein_grams * calc.num_servings).toFixed(1)}g
                        </div>
                      </div>
                    </div>
                    <div className="ml-11 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-white/50 mb-1">Cost per Gram</div>
                        <div className="text-white text-2xl font-bold">${calc.cost_per_gram.toFixed(3)}</div>
                      </div>
                      {statusLabel && (
                        <div>
                          <div className="text-xs text-white/50 mb-1">Status</div>
                          <div className="text-white font-semibold">{statusLabel}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-white/50 mb-1">Date</div>
                        <div className="text-white">{new Date(calc.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {calc.notes && (
                      <div className="ml-11 mt-3 text-sm text-white/70 bg-black/20 rounded-lg p-3">
                        {calc.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAsBought(calc)}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm transition-all"
                    >
                      🛒 Mark as Bought
                    </button>
                    <button
                      onClick={() => deleteCalculation(calc.id!)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
