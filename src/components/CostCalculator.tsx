import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, Supplement, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface SupplementCost extends Supplement {
  cost?: number;
  quantity?: number;
  frequency?: number; // times per day
}

export function CostCalculator() {
  const [supplements, setSupplements] = useState<SupplementCost[]>([]);
  const [sections, setSections] = useState<SupplementSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: supplementsData } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id);

      const { data: sectionsData } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      setSupplements((supplementsData || []).map(s => ({ ...s, cost: 0, quantity: 0, frequency: 1 })));
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCost = (id: string, field: 'cost' | 'quantity' | 'frequency', value: number) => {
    setSupplements(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const calculateDailyCost = (supp: SupplementCost): number => {
    if (!supp.cost || !supp.quantity || !supp.frequency) return 0;
    const costPerUnit = supp.cost / supp.quantity;
    return costPerUnit * supp.frequency;
  };

  const groupedSupplements = supplements.reduce((acc, supplement) => {
    const section = supplement.section || (sections[0]?.name || 'Uncategorized');
    if (!acc[section]) acc[section] = [];
    acc[section].push(supplement);
    return acc;
  }, {} as Record<string, SupplementCost[]>);

  const totalDailyCost = supplements.reduce((sum, s) => sum + calculateDailyCost(s), 0);
  const totalWeeklyCost = totalDailyCost * 7;
  const totalMonthlyCost = totalDailyCost * 30;

  if (loading) {
    return <div className="text-center py-12 text-white">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-6">Cost Calculator</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
          <div className="text-white/70 text-sm">Daily</div>
          <div className="text-2xl font-bold text-white">${totalDailyCost.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
          <div className="text-white/70 text-sm">Weekly</div>
          <div className="text-2xl font-bold text-white">${totalWeeklyCost.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
          <div className="text-white/70 text-sm">Monthly</div>
          <div className="text-2xl font-bold text-white">${totalMonthlyCost.toFixed(2)}</div>
        </div>
      </div>

      {/* By Section */}
      <div className="space-y-6">
        {Object.entries(groupedSupplements).map(([section, sectionSupps]) => {
          const sectionDaily = sectionSupps.reduce((sum, s) => sum + calculateDailyCost(s), 0);

          return (
            <div key={section}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold text-white">{section}</h3>
                <div className="text-white/70">
                  ${sectionDaily.toFixed(2)}/day
                </div>
              </div>

              <div className="space-y-3">
                {sectionSupps.map(supp => {
                  const daily = calculateDailyCost(supp);

                  return (
                    <motion.div
                      key={supp.id}
                      className="p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20"
                    >
                      <div className="font-semibold text-white mb-3">{supp.name}</div>

                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-white/70 text-xs">Cost ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={supp.cost || ''}
                            onChange={(e) => updateCost(supp.id!, 'cost', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="text-white/70 text-xs">Quantity</label>
                          <input
                            type="number"
                            value={supp.quantity || ''}
                            onChange={(e) => updateCost(supp.id!, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-white/70 text-xs">Per Day</label>
                          <input
                            type="number"
                            value={supp.frequency || ''}
                            onChange={(e) => updateCost(supp.id!, 'frequency', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                            placeholder="1"
                          />
                        </div>
                      </div>

                      {daily > 0 && (
                        <div className="text-green-300 text-sm">
                          ${daily.toFixed(2)}/day • ${(daily * 7).toFixed(2)}/week • ${(daily * 30).toFixed(2)}/month
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
