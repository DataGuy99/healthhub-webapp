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
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return db.supplementLogs
      .where('timestamp')
      .between(startOfDay, endOfDay)
      .toArray();
  }, [selectedDate]);

  const handleToggleSupplement = async (supplementId: number) => {
    const existingLog = todayLogs?.find(log => log.supplementId === supplementId);

    if (existingLog) {
      // Remove log
      await db.supplementLogs.delete(existingLog.id!);
    } else {
      // Add log
      const supplement = supplements?.find(s => s.id === supplementId);
      if (supplement) {
        await db.supplementLogs.add({
          supplementId,
          timestamp: new Date(),
          dose: supplement.dosage,
          notes: ''
        });
      }
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

      {/* Supplement grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {supplements.map((supplement) => {
          const isLogged = todayLogs?.some(log => log.supplementId === supplement.id);

          return (
            <motion.div
              key={supplement.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleToggleSupplement(supplement.id!)}
              className={`
                p-6 rounded-2xl cursor-pointer transition-all duration-300
                backdrop-blur-xl border shadow-2xl
                ${isLogged
                  ? 'bg-green-500/20 border-green-400/50'
                  : 'bg-slate-900/60 border-slate-700/50 hover:bg-slate-800/60'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {supplement.name}
                  </h3>
                  <p className="text-white/70">
                    {supplement.dosage} {supplement.unit}
                  </p>
                  {supplement.timeOfDay && (
                    <p className="text-sm text-white/50 mt-1">
                      Best time: {supplement.timeOfDay}
                    </p>
                  )}
                </div>
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-2xl
                  ${isLogged ? 'bg-green-500/30' : 'bg-white/10'}
                `}>
                  {isLogged ? '✓' : '○'}
                </div>
              </div>
            </motion.div>
          );
        })}
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
