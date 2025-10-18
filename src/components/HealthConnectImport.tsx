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

      let result;
      let usedFallback = false;

      try {
        // STEP 1: Try Netlify function first (faster, server-side)
        console.log('Attempting server-side import via Netlify...');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const response = await fetch('/.netlify/functions/health-connect-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            fileData: base64,
            isZip: isZip,
            userId: user.id
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        setProgress(50);

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server-side import failed');
          } else {
            throw new Error(`Server error (${response.status})`);
          }
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response from server');
        }

        result = await response.json();
        console.log('✓ Server-side import succeeded');

      } catch (serverError) {
        // STEP 2: Fallback to client-side parsing
        console.warn('Server-side import failed, falling back to client-side:', serverError);
        usedFallback = true;
        setProgress(40);

        // Import sql.js dynamically (only when needed)
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`
        });

        setProgress(50);

        let dbBuffer: Uint8Array;

        if (isZip) {
          // Extract .db from zip
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(Buffer.from(arrayBuffer));
          const zipEntries = zip.getEntries();
          const dbEntry = zipEntries.find(entry => entry.entryName.endsWith('.db'));

          if (!dbEntry) {
            throw new Error('No .db file found in zip');
          }

          dbBuffer = new Uint8Array(dbEntry.getData());
        } else {
          dbBuffer = new Uint8Array(arrayBuffer);
        }

        setProgress(60);

        // Parse database client-side
        const db = new SQL.Database(dbBuffer);
        const dataPoints: any[] = [];
        const breakdown = {
          heart_rate: 0,
          blood_oxygen: 0,
          respiratory_rate: 0,
          steps: 0,
          distance: 0,
          calories: 0,
          sleep: 0,
          nutrition: 0,
          exercise: 0
        };

        // Extract data from all tables
        const extractors = [
          {
            query: 'SELECT epoch_millis, beats_per_minute FROM heart_rate_record_series_table ORDER BY epoch_millis',
            type: 'heart_rate',
            map: ([epochMillis, bpm]: any[]) => ({
              timestamp: new Date(Number(epochMillis)).toISOString(),
              type: 'heart_rate',
              value: Number(bpm),
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, percentage FROM oxygen_saturation_record_table ORDER BY start_time',
            type: 'blood_oxygen',
            map: ([startTime, percentage]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'blood_oxygen',
              value: Number(percentage),
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, rate FROM respiratory_rate_record_table ORDER BY start_time',
            type: 'respiratory_rate',
            map: ([startTime, rate]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'respiratory_rate',
              value: Number(rate),
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, count FROM steps_record_table ORDER BY start_time',
            type: 'steps',
            map: ([startTime, count]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'steps',
              value: Number(count),
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, distance_meters FROM distance_record_table ORDER BY start_time',
            type: 'distance',
            map: ([startTime, meters]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'distance',
              value: Number(meters) / 1000,
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, energy_kcal FROM total_calories_burned_record_table ORDER BY start_time',
            type: 'calories',
            map: ([startTime, kcal]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'calories_burned',
              value: Number(kcal),
              source: 'health_connect'
            })
          },
          {
            query: 'SELECT start_time, end_time FROM sleep_session_record_table ORDER BY start_time',
            type: 'sleep',
            map: ([startTime, endTime]: any[]) => ({
              timestamp: new Date(Number(startTime)).toISOString(),
              type: 'sleep_duration',
              value: (Number(endTime) - Number(startTime)) / (1000 * 60 * 60),
              source: 'health_connect',
              metadata: { end_time: new Date(Number(endTime)).toISOString() }
            })
          }
        ];

        setProgress(70);

        for (const extractor of extractors) {
          try {
            const queryResult = db.exec(extractor.query);
            if (queryResult[0]) {
              queryResult[0].values.forEach((row: any) => {
                dataPoints.push(extractor.map(row));
                breakdown[extractor.type as keyof typeof breakdown]++;
              });
            }
          } catch (e) {
            console.warn(`Failed to extract ${extractor.type}:`, e);
          }
        }

        db.close();
        setProgress(80);

        // Insert to Supabase in batches
        const BATCH_SIZE = 1000;
        let insertedCount = 0;

        for (let i = 0; i < dataPoints.length; i += BATCH_SIZE) {
          const batch = dataPoints.slice(i, i + BATCH_SIZE).map(dp => ({
            user_id: user.id,
            timestamp: dp.timestamp,
            type: dp.type,
            value: dp.value,
            source: dp.source,
            accuracy: 95,
            metadata: dp.metadata || {}
          }));

          const { error } = await supabase
            .from('health_data_points')
            .insert(batch);

          if (error) {
            console.error('Batch insert error:', error);
            throw new Error(`Failed to insert batch: ${error.message}`);
          }

          insertedCount += batch.length;
          setProgress(80 + (20 * (i / dataPoints.length)));
        }

        // Update sync status
        await supabase
          .from('health_sync_status')
          .upsert({
            user_id: user.id,
            last_sync_timestamp: new Date().toISOString(),
            data_points_count: insertedCount
          }, { onConflict: 'user_id' });

        result = {
          success: true,
          imported: insertedCount,
          breakdown
        };

        console.log('✓ Client-side fallback import succeeded');
      }

      setProgress(100);

      // Display import stats (from either server or client-side import)
      if (result && result.breakdown) {
        setImportStats({
          heartRate: result.breakdown.heart_rate || 0,
          bloodOxygen: result.breakdown.blood_oxygen || 0,
          respiratoryRate: result.breakdown.respiratory_rate || 0,
          steps: result.breakdown.steps || 0,
          distance: result.breakdown.distance || 0,
          calories: result.breakdown.calories || 0,
          sleep: result.breakdown.sleep || 0,
          nutrition: result.breakdown.nutrition || 0,
          exercise: result.breakdown.exercise || 0
        });
      }

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
