import { useState } from 'react';
import { motion } from 'framer-motion';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';

export function DailySupplementLogger() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get all supplements
  const supplements = useLiveQuery(() => db.supplements.toArray());

  // Get today's logged supplements
  const todayLogs = useLiveQuery(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];

    return db.supplementLogs
      .where('date')
      .equals(dateStr)
      .toArray();
  }, [selectedDate]);

  const handleToggleSupplement = async (supplementId: number) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const existingLog = todayLogs?.find(log => log.supplementId === supplementId);

    if (existingLog) {
      // Toggle off
      await db.supplementLogs.delete(existingLog.id!);
    } else {
      // Toggle on
      await db.supplementLogs.add({
        supplementId,
        date: dateStr,
        isTaken: true,
        timestamp: new Date()
      });
    }
  };

  if (!supplements || supplements.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💊</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Supplements Yet</h3>
        <p className="text-white/70 mb-4">Add supplements in the Supplements tab to start logging</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Date selector */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <button
          onClick={() => {
            const prev = new Date(selectedDate);
            prev.setDate(prev.getDate() - 1);
            setSelectedDate(prev);
          }}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white border border-white/20"
        >
          ← Previous
        </button>
        <div className="text-2xl font-bold text-white">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </div>
        <button
          onClick={() => {
            const next = new Date(selectedDate);
            next.setDate(next.getDate() + 1);
            setSelectedDate(next);
          }}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white border border-white/20"
          disabled={selectedDate >= new Date()}
        >
          Next →
        </button>
      </div>

      {/* Vertical Timeline - Grouped by Section */}
      <div className="relative max-w-2xl mx-auto">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700" />

        {/* Group supplements by section */}
        {Object.entries(
          supplements.reduce((acc, sup) => {
            const section = sup.section || 'Other';
            if (!acc[section]) acc[section] = [];
            acc[section].push(sup);
            return acc;
          }, {} as Record<string, typeof supplements>)
        ).map(([section, sectionSupplements]) => (
          <div key={section} className="mb-8">
            {/* Section header */}
            <div className="relative pl-16 mb-4">
              <div className="absolute left-3 top-1 w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
              </div>
              <h2 className="text-xl font-bold text-white/90">{section}</h2>
            </div>

            {/* Supplements in this section */}
            {sectionSupplements.map((supplement) => {
              const isLogged = todayLogs?.some(log => log.supplementId === supplement.id);

              return (
                <div key={supplement.id} className="relative pl-16 pb-4">
                  {/* Timeline dot */}
                  <motion.div
                    className={`absolute left-4 top-3 w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                      isLogged
                        ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50'
                        : 'bg-slate-800 border-slate-600'
                    }`}
                    animate={isLogged ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  />

                  {/* Supplement card */}
                  <motion.div
                    whileHover={{ x: 4 }}
                    onClick={() => handleToggleSupplement(supplement.id!)}
                    className={`
                      cursor-pointer transition-all duration-300
                      backdrop-blur-xl rounded-xl p-4 border-l-4
                      ${isLogged
                        ? 'bg-green-500/10 border-green-400 shadow-lg'
                        : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800/60'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">
                          {supplement.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-white/60">
                            {supplement.dose} {supplement.doseUnit}
                          </span>
                        </div>
                      </div>
                      <div className={`
                        text-xl transition-all duration-300
                        ${isLogged ? 'text-green-400' : 'text-white/30'}
                      `}>
                        {isLogged ? '✓' : '○'}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
        <div className="text-center">
          <div className="text-4xl font-bold text-white">
            {todayLogs?.length || 0} / {supplements.length}
          </div>
          <p className="text-white/70 mt-2">Supplements taken today</p>
        </div>
      </div>
    </div>
  );
}
