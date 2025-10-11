import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, Supplement, SupplementLog, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export function DailySupplementLogger() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [sectionsList, setSectionsList] = useState<SupplementSection[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({}); // What's selected (not yet saved)
  const [savedLogs, setSavedLogs] = useState<Set<string>>(new Set()); // What's actually saved in DB
  const [loading, setLoading] = useState(true);
  const [isWorkoutMode, setIsWorkoutMode] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoLogTime, setAutoLogTime] = useState(() => {
    // Load from localStorage or default to midnight
    return localStorage.getItem('autoLogTime') || '00:00';
  });

  // Auto-log timer - checks every minute if it's time to auto-log
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newDate = now.toISOString().split('T')[0];

      // Check if it's time to auto-log
      if (currentTime === autoLogTime) {
        const selectedIds = Object.keys(logs).filter(id => logs[id]);
        if (selectedIds.length > 0) {
          console.log('Auto-logging', selectedIds.length, 'supplements at', currentTime);
          logAllSelected();
        }
      }

      // Check if date changed (midnight passed)
      if (newDate !== currentDate) {
        setCurrentDate(newDate);
        setLogs({}); // Clear visual selections for new day
        loadData(); // Reload logs for new day
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentDate, autoLogTime, logs]);

  // Save auto-log time to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('autoLogTime', autoLogTime);
  }, [autoLogTime]);

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
        .eq('date', currentDate);

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

      // Load what's been SAVED to database (for progress counter)
      const savedIds = new Set<string>();
      (logsData || []).forEach((log: SupplementLog) => {
        if (log.is_taken) {
          savedIds.add(log.supplement_id);
        }
      });
      setSavedLogs(savedIds);

      // Don't load into visual selection state
      // logs state is ONLY for what user has checked today (not yet saved)
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Just toggle visual selection (doesn't save to database)
  const toggleSupplement = (supplementId: string) => {
    setLogs(prev => ({
      ...prev,
      [supplementId]: !prev[supplementId]
    }));
  };

  // Save all currently selected supplements to database
  const logAllSelected = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get all supplements that are checked
      const selectedIds = Object.keys(logs).filter(id => logs[id]);
      if (selectedIds.length === 0) return;

      // Batch upsert to database
      const upsertData = selectedIds.map(supplementId => ({
        user_id: user.id,
        supplement_id: supplementId,
        date: currentDate,
        is_taken: true,
        timestamp: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('supplement_logs')
        .upsert(upsertData, {
          onConflict: 'user_id,supplement_id,date'
        });

      if (error) throw error;

      // Update savedLogs to reflect what's now in database
      setSavedLogs(prev => {
        const newSet = new Set(prev);
        selectedIds.forEach(id => newSet.add(id));
        return newSet;
      });

      // Clear visual selections after logging
      setLogs({});

      alert(`Logged ${selectedIds.length} supplements!`);
    } catch (error) {
      console.error('Error logging supplements:', error);
      alert('Failed to log supplements');
    }
  };

  // Toggle all supplements in a section (just visual, doesn't save)
  const toggleSection = (section: string, newValue: boolean) => {
    const sectionSupplements = groupedSupplements[section] || [];
    const updates: Record<string, boolean> = {};
    sectionSupplements.forEach(supplement => {
      if (supplement.id) {
        updates[supplement.id] = newValue;
      }
    });
    setLogs(prev => ({ ...prev, ...updates }));
  };

  // Filter supplements by workout mode
  const workoutSupplements = supplements.filter(s => s.frequency_pattern === 'workout');
  const regularSupplements = supplements.filter(s => s.frequency_pattern !== 'workout');

  // Group workout supplements by Pre-Workout/Post-Workout
  const groupedWorkout = workoutSupplements.reduce((acc, supplement) => {
    const section = supplement.section || 'Pre-Workout';
    if (!acc[section]) acc[section] = [];
    acc[section].push(supplement);
    return acc;
  }, {} as Record<string, Supplement[]>);

  // Group regular supplements by time sections
  const groupedSupplements = regularSupplements.reduce((acc, supplement) => {
    const section = supplement.section || (sectionsList[0]?.name || 'Morning');
    if (!acc[section]) acc[section] = [];
    acc[section].push(supplement);
    return acc;
  }, {} as Record<string, Supplement[]>);

  const sections = sectionsList.map(s => s.name);
  const activeSupplements = isWorkoutMode ? workoutSupplements : regularSupplements;
  const totalSupplements = activeSupplements.length;
  const takenCount = activeSupplements.filter(s => s.id && savedLogs.has(s.id)).length;

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

        {/* Auto-log Time Setting */}
        <div className="mt-4 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm">⏰ Auto-log at:</span>
              <input
                type="time"
                value={autoLogTime}
                onChange={(e) => setAutoLogTime(e.target.value)}
                className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <span className="text-white/50 text-xs">Selections auto-save at this time</span>
          </div>
        </div>

        {/* Workout Toggle */}
        {workoutSupplements.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setIsWorkoutMode(!isWorkoutMode)}
              className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                isWorkoutMode
                  ? 'bg-orange-500/30 border border-orange-500/40 text-orange-300'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
              }`}
            >
              💪 {isWorkoutMode ? 'Exit Workout Mode' : 'Workout Mode'}
            </button>
          </div>
        )}

        {/* Log Selected Button */}
        {Object.values(logs).some(val => val) && (
          <div className="mt-4">
            <button
              onClick={logAllSelected}
              className="w-full px-4 py-3 rounded-xl font-medium bg-green-500/30 border border-green-500/40 text-green-300 hover:bg-green-500/40 transition-all duration-300"
            >
              💾 Log All Selected ({Object.values(logs).filter(v => v).length})
            </button>
          </div>
        )}

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
          {isWorkoutMode ? (
            // Workout Mode - Show Pre-Workout and Post-Workout sections
            Object.entries(groupedWorkout).map(([section, sectionSupplements]) => {
              if (sectionSupplements.length === 0) return null;

              const sectionTakenCount = sectionSupplements.filter(s => logs[s.id!]).length;
              const sectionTotal = sectionSupplements.length;
              const allTaken = sectionTakenCount === sectionTotal;
              const someTaken = sectionTakenCount > 0 && sectionTakenCount < sectionTotal;

              return (
                <div key={section} className="relative pl-20">
                  {/* Timeline dot */}
                  <div className={`absolute left-6 top-2 w-5 h-5 rounded-full border-4 backdrop-blur-xl ${
                    allTaken
                      ? 'bg-green-500 border-green-500/50'
                      : someTaken
                      ? 'bg-yellow-500 border-yellow-500/50'
                      : 'bg-white/30 border-orange-500/50'
                  }`} />

                  {/* Section header with toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-white">{section}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHiddenSections(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(section)) {
                              newSet.delete(section);
                            } else {
                              newSet.add(section);
                            }
                            return newSet;
                          });
                        }}
                        className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
                      >
                        {hiddenSections.has(section) ? '👁️' : '🚫'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section, true);
                        }}
                        className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-300 text-sm transition-all"
                      >
                        ✓ All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section, false);
                        }}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-all"
                      >
                        ✗ None
                      </button>
                    </div>
                  </div>

                  {/* Supplements in this section */}
                  {!hiddenSections.has(section) && (
                    <div className="space-y-2">
                      {sectionSupplements.map(supplement => {
                        const isTaken = logs[supplement.id!] || false;

                        return (
                          <motion.button
                            key={supplement.id}
                            onClick={() => supplement.id && toggleSupplement(supplement.id)}
                            className={`w-full p-3 rounded-lg border text-left ${
                              isTaken
                                ? 'bg-green-500/20 border-green-500/30 backdrop-blur-xl'
                                : 'bg-white/10 border-white/20 backdrop-blur-xl active:bg-white/20'
                            }`}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.1 }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-white">{supplement.name}</div>
                                {supplement.ingredients && supplement.ingredients.length > 0 ? (
                                  <div className="text-white/60 text-xs mt-0.5">
                                    {supplement.ingredients.map((ing, i) => (
                                      <span key={i}>
                                        {i > 0 && ' • '}
                                        {ing.name}: {ing.dose}{ing.dose_unit}
                                      </span>
                                    ))}
                                  </div>
                                ) : supplement.dose && (
                                  <div className="text-white/60 text-xs mt-0.5">
                                    {supplement.dose} {supplement.dose_unit}
                                  </div>
                                )}
                                {supplement.notes && (
                                  <div className="text-white/50 text-xs mt-1 italic">
                                    {supplement.notes}
                                  </div>
                                )}
                              </div>
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                                  isTaken
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-white/30'
                                }`}
                              >
                                {isTaken && (
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // Regular Mode - Show time-based sections
            sections.map((section, sectionIndex) => {
              const sectionSupplements = groupedSupplements[section] || [];
              if (sectionSupplements.length === 0) return null;

            const sectionTakenCount = sectionSupplements.filter(s => logs[s.id!]).length;
            const sectionTotal = sectionSupplements.length;
            const allTaken = sectionTakenCount === sectionTotal;
            const someTaken = sectionTakenCount > 0 && sectionTakenCount < sectionTotal;

            return (
              <div key={section} className="relative pl-20">
                {/* Timeline dot */}
                <div className={`absolute left-6 top-2 w-5 h-5 rounded-full border-4 backdrop-blur-xl ${
                  allTaken
                    ? 'bg-green-500 border-green-500/50'
                    : someTaken
                    ? 'bg-yellow-500 border-yellow-500/50'
                    : 'bg-white/30 border-purple-500/50'
                }`} />

                {/* Section header with toggle */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">{section}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHiddenSections(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(section)) {
                            newSet.delete(section);
                          } else {
                            newSet.add(section);
                          }
                          return newSet;
                        });
                      }}
                      className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-300 text-sm transition-all"
                    >
                      {hiddenSections.has(section) ? '👁️' : '🚫'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section, true);
                      }}
                      className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-300 text-sm transition-all"
                    >
                      ✓ All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section, false);
                      }}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-all"
                    >
                      ✗ None
                    </button>
                  </div>
                </div>

                {/* Supplements in this section */}
                {!hiddenSections.has(section) && (
                  <div className="space-y-2">
                    {sectionSupplements.map(supplement => {
                      const isTaken = logs[supplement.id!] || false;

                      return (
                        <motion.button
                          key={supplement.id}
                          onClick={() => supplement.id && toggleSupplement(supplement.id)}
                          className={`w-full p-3 rounded-lg border text-left ${
                            isTaken
                              ? 'bg-green-500/20 border-green-500/30 backdrop-blur-xl'
                              : 'bg-white/10 border-white/20 backdrop-blur-xl active:bg-white/20'
                          }`}
                          whileTap={{ scale: 0.99 }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-white">{supplement.name}</div>
                              {supplement.ingredients && supplement.ingredients.length > 0 ? (
                                <div className="text-white/60 text-xs mt-0.5">
                                  {supplement.ingredients.map((ing, i) => (
                                    <span key={i}>
                                      {i > 0 && ' • '}
                                      {ing.name}: {ing.dose}{ing.dose_unit}
                                    </span>
                                  ))}
                                </div>
                              ) : supplement.dose && (
                                <div className="text-white/60 text-xs mt-0.5">
                                  {supplement.dose} {supplement.dose_unit}
                                </div>
                              )}
                              {supplement.notes && (
                                <div className="text-white/50 text-xs mt-1 italic">
                                  {supplement.notes}
                                </div>
                              )}
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                                isTaken
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-white/30'
                              }`}
                            >
                              {isTaken && (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
          )}
        </div>
      </div>
    </div>
  );
}
