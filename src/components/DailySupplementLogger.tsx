import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, Supplement, SupplementLog, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export function DailySupplementLogger() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [sectionsList, setSectionsList] = useState<SupplementSection[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load supplements
      const { data: supplementsData, error: supplementsError } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('section', { ascending: true })
        .order('order', { ascending: true });

      if (supplementsError) throw supplementsError;

      // Load today's logs
      const { data: logsData, error: logsError } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (logsError) throw logsError;

      // Load sections
      let { data: sectionsData, error: sectionsError } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      if (sectionsError) throw sectionsError;

      // Create default sections if none exist
      if (!sectionsData || sectionsData.length === 0) {
        try {
          const defaults = ['Morning', 'Afternoon', 'Evening', 'Night'];
          const defaultSections = defaults.map((name, i) => ({
            user_id: user.id,
            name,
            order: i
          }));

          const { error: insertError } = await supabase
            .from('supplement_sections')
            .insert(defaultSections);

          if (insertError) throw insertError;

          // Reload sections
          const { data: reloadedSections } = await supabase
            .from('supplement_sections')
            .select('*')
            .eq('user_id', user.id)
            .order('order', { ascending: true });
          sectionsData = reloadedSections;
        } catch (err) {
          console.error('Error creating default sections:', err);
          throw err;
        }
      }

      setSupplements(supplementsData || []);
      setSectionsList(sectionsData || []);

      // Build logs lookup
      const logsMap: Record<string, boolean> = {};
      (logsData || []).forEach((log: SupplementLog) => {
        logsMap[log.supplement_id] = log.is_taken;
      });
      setLogs(logsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSupplement = async (supplementId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const currentValue = logs[supplementId] || false;
      const newValue = !currentValue;

      // Optimistic update
      setLogs(prev => ({ ...prev, [supplementId]: newValue }));

      // Upsert: insert or update based on unique constraint
      const { error } = await supabase
        .from('supplement_logs')
        .upsert({
          user_id: user.id,
          supplement_id: supplementId,
          date: today,
          is_taken: newValue,
          timestamp: new Date().toISOString()
        }, {
          onConflict: 'user_id,supplement_id,date'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling supplement:', error);
      // Revert optimistic update on error
      const currentValue = logs[supplementId] || false;
      setLogs(prev => ({ ...prev, [supplementId]: !currentValue }));
      alert('Failed to update supplement log');
    }
  };

  const groupedSupplements = supplements.reduce((acc, supplement) => {
    const section = supplement.section || (sectionsList[0]?.name || 'Morning');
    if (!acc[section]) acc[section] = [];
    acc[section].push(supplement);
    return acc;
  }, {} as Record<string, Supplement[]>);

  const sections = sectionsList.map(s => s.name);
  const totalSupplements = supplements.length;
  const takenCount = Object.values(logs).filter(Boolean).length;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-white text-xl">Loading supplements...</div>
      </div>
    );
  }

  if (supplements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💊</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Supplements Yet</h3>
        <p className="text-white/70">Add supplements in the Supplements tab first</p>
      </div>
    );
  }

  if (sectionsList.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🕐</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Sections Yet</h3>
        <p className="text-white/70">Go to Sections tab to create time sections (Morning, Afternoon, etc)</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Daily Logger</h2>
        <div className="text-white/70 text-lg">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className="mt-4 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
          <div className="text-2xl font-bold text-white">
            {takenCount} / {totalSupplements} taken today
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 mt-2">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${totalSupplements > 0 ? (takenCount / totalSupplements) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-white/20" />

        <div className="space-y-8">
          {sections.map((section, sectionIndex) => {
            const sectionSupplements = groupedSupplements[section] || [];
            if (sectionSupplements.length === 0) return null;

            return (
              <div key={section} className="relative pl-20">
                {/* Timeline dot */}
                <div className="absolute left-6 top-2 w-5 h-5 rounded-full bg-white/30 border-4 border-purple-500/50 backdrop-blur-xl" />

                {/* Section header */}
                <h3 className="text-2xl font-bold text-white mb-4">{section}</h3>

                {/* Supplements in this section */}
                <div className="space-y-3">
                  {sectionSupplements.map(supplement => {
                    const isTaken = logs[supplement.id!] || false;

                    return (
                      <motion.button
                        key={supplement.id}
                        onClick={() => supplement.id && toggleSupplement(supplement.id)}
                        className={`w-full p-4 rounded-xl border transition-all text-left ${
                          isTaken
                            ? 'bg-green-500/20 border-green-500/30 backdrop-blur-xl'
                            : 'bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold text-white">{supplement.name}</div>
                            {supplement.ingredients && supplement.ingredients.length > 0 ? (
                              <div className="text-white/70 text-sm">
                                {supplement.ingredients.map((ing, i) => (
                                  <div key={i}>{ing.name}: {ing.dose} {ing.dose_unit}</div>
                                ))}
                              </div>
                            ) : supplement.dose && (
                              <div className="text-white/70 text-sm">
                                {supplement.dose} {supplement.dose_unit}
                              </div>
                            )}
                          </div>
                          <div
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                              isTaken
                                ? 'bg-green-500 border-green-500'
                                : 'border-white/30'
                            }`}
                          >
                            {isTaken && (
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
