import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface ImportStats {
  heartRate: number;
  bloodOxygen: number;
  respiratoryRate: number;
  steps: number;
  distance: number;
  calories: number;
  sleep: number;
  nutrition: number;
  exercise: number;
}

export function HealthConnectImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processHealthConnectFile = useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      setProgress(10);
      setError(null);

      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      // Convert to base64 for transmission
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      setProgress(30);

      // Determine if it's a zip or db file
      const isZip = file.name.endsWith('.zip');

      // Send to Netlify function for processing
      const response = await fetch('/.netlify/functions/health-connect-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64,
          isZip: isZip,
          userId: user.id
        })
      });

      setProgress(50);

      if (!response.ok) {
        // Try to parse JSON error, but handle HTML error pages
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Import failed');
        } else {
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): Function not found or not deployed`);
        }
      }

      // Parse response with error handling
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response from server - expected JSON');
      }

      const result = await response.json();
      setProgress(100);

      // Display real import stats from backend
      setImportStats({
        heartRate: result.breakdown?.heart_rate || 0,
        bloodOxygen: result.breakdown?.blood_oxygen || 0,
        respiratoryRate: result.breakdown?.respiratory_rate || 0,
        steps: result.breakdown?.steps || 0,
        distance: result.breakdown?.distance || 0,
        calories: result.breakdown?.calories || 0,
        sleep: result.breakdown?.sleep || 0,
        nutrition: result.breakdown?.nutrition || 0,
        exercise: result.breakdown?.exercise || 0
      });

      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 2000);

    } catch (err) {
      console.error('Error processing Health Connect zip:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip') && !file.name.endsWith('.db')) {
      setError('Please upload a .zip or .db file');
      return;
    }

    processHealthConnectFile(file);
  }, [processHealthConnectFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip') && !file.name.endsWith('.db')) {
      setError('Please upload a .zip or .db file');
      return;
    }

    processHealthConnectFile(file);
  }, [processHealthConnectFile]);

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10'
            : 'border-white/20 bg-white/5'
        }`}
      >
        <input
          type="file"
          accept=".zip,.db"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {isProcessing ? 'Processing Health Data...' : 'Import Health Connect Data'}
          </h3>
          <p className="text-white/60 mb-4">
            Drop your Health Connect export (.zip or .db) here or click to browse
          </p>

          {isProcessing && (
            <div className="mt-6">
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
              <p className="text-white/60 text-sm mt-2">{progress}% complete</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/20 border border-red-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="text-red-300 font-semibold">Import Failed</h4>
                <p className="text-red-200/80 text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-300 hover:text-red-200"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Stats */}
      <AnimatePresence>
        {importStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">✅ Import Successful</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">❤️</div>
                <div className="text-2xl font-bold text-white">{importStats.heartRate.toLocaleString()}</div>
                <div className="text-xs text-white/60">Heart Rate</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">🫁</div>
                <div className="text-2xl font-bold text-white">{importStats.bloodOxygen.toLocaleString()}</div>
                <div className="text-xs text-white/60">Blood Oxygen</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">🌬️</div>
                <div className="text-2xl font-bold text-white">{importStats.respiratoryRate.toLocaleString()}</div>
                <div className="text-xs text-white/60">Respiratory Rate</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">👣</div>
                <div className="text-2xl font-bold text-white">{importStats.steps.toLocaleString()}</div>
                <div className="text-xs text-white/60">Step Records</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">📏</div>
                <div className="text-2xl font-bold text-white">{importStats.distance.toLocaleString()}</div>
                <div className="text-xs text-white/60">Distance</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-2xl font-bold text-white">{importStats.calories.toLocaleString()}</div>
                <div className="text-xs text-white/60">Calories</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">😴</div>
                <div className="text-2xl font-bold text-white">{importStats.sleep.toLocaleString()}</div>
                <div className="text-xs text-white/60">Sleep Sessions</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">🍽️</div>
                <div className="text-2xl font-bold text-white">{importStats.nutrition.toLocaleString()}</div>
                <div className="text-xs text-white/60">Nutrition Logs</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">💪</div>
                <div className="text-2xl font-bold text-white">{importStats.exercise.toLocaleString()}</div>
                <div className="text-xs text-white/60">Workouts</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl mb-1">📊</div>
                <div className="text-2xl font-bold text-green-400">
                  {(importStats.heartRate + importStats.bloodOxygen + importStats.respiratoryRate + importStats.steps + importStats.distance + importStats.calories + importStats.sleep + importStats.nutrition + importStats.exercise).toLocaleString()}
                </div>
                <div className="text-xs text-white/60">Total Records</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-purple-200 text-sm">
                🎯 Data imported successfully! Correlation analysis will run automatically to generate health insights.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📱 How to Export from Health Connect</h3>
        <ol className="space-y-2 text-white/70 text-sm">
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold">1.</span>
            <span>Open Health Connect app on your Android device</span>
          </li>
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold">2.</span>
            <span>Go to Settings → Data and Privacy → Export data</span>
          </li>
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold">3.</span>
            <span>Select date range and export all available metrics</span>
          </li>
          <li className="flex gap-2">
            <span className="text-purple-400 font-bold">4.</span>
            <span>Upload the .zip file here, or extract and upload the .db file directly</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
