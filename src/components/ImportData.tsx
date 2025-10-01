import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { importHealthData } from '../hooks/useHealthData';

export function ImportData() {
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await importHealthData(Array.isArray(data) ? data : [data]);

      setResult({ success: true, count });
    } catch (error) {
      setResult({ success: false, error: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = await importHealthData(Array.isArray(data) ? data : [data]);

      setResult({ success: true, count });
    } catch (error) {
      setResult({ success: false, error: (error as Error).message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          backdrop-blur-xl bg-white/10 border-2 border-dashed rounded-3xl p-12
          transition-all duration-300
          ${isDragging ? 'border-white/60 bg-white/20 scale-105' : 'border-white/30'}
        `}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Import Health Data
          </h3>
          <p className="text-white/70 mb-6">
            Drag & drop your Health Connect JSON export here
          </p>

          <label className="inline-block">
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="px-8 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-semibold cursor-pointer transition-all duration-300 hover:scale-105">
              Choose File
            </div>
          </label>
        </div>
      </div>

      <AnimatePresence>
        {importing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-white"
          >
            <div className="inline-block animate-spin mr-2">⏳</div>
            Importing data...
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 p-4 rounded-xl ${
              result.success
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-red-500/20 border border-red-500/30'
            }`}
          >
            <p className="text-white font-medium">
              {result.success
                ? `✅ Successfully imported ${result.count} metrics!`
                : `❌ Error: ${result.error}`
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
