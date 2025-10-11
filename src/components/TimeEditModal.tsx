import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
  defaultDate?: string;
  defaultTime?: string;
  supplementName: string;
}

export function TimeEditModal({
  isOpen,
  onClose,
  onConfirm,
  defaultDate,
  defaultTime,
  supplementName
}: TimeEditModalProps) {
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(defaultTime || new Date().toTimeString().slice(0, 5));

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setTime(defaultTime || new Date().toTimeString().slice(0, 5));
    }
  }, [isOpen, defaultDate, defaultTime]);

  const handleConfirm = () => {
    onConfirm(date, time);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">
                Edit Log Time
              </h2>

              <div className="mb-4">
                <p className="text-white/70 mb-4">
                  Logging: <span className="font-medium text-white">{supplementName}</span>
                </p>
              </div>

              {/* Date Input */}
              <div className="mb-4">
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Time Input */}
              <div className="mb-6">
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 hover:bg-green-500/40 transition-all font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
