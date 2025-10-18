import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import initSqlJs from 'sql.js';
import AdmZip from 'adm-zip';

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

interface HealthDataPoint {
  timestamp: string;
  type: string;
  value: number;
  source: string;
  metadata?: any;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { zipData, userId } = JSON.parse(event.body || '{}');

    if (!zipData || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing zipData or userId' })
      };
    }

    // Decode base64 zip data
    const zipBuffer = Buffer.from(zipData, 'base64');
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Find the .db file
    const dbEntry = zipEntries.find(entry => entry.entryName.endsWith('.db'));
    if (!dbEntry) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No .db file found in zip' })
      };
    }

    // Extract database file
    const dbBuffer = dbEntry.getData();

    // Initialize SQL.js
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(dbBuffer));

    const dataPoints: HealthDataPoint[] = [];
    let importCounts = {
      heart_rate: 0,
      blood_oxygen: 0,
      respiratory_rate: 0,
      steps: 0,
      distance: 0,
      calories: 0,
      sleep: 0
    };

    // Extract heart rate data
    try {
      const heartRateResult = db.exec(`
        SELECT epoch_millis, beats_per_minute
        FROM heart_rate_record_series_table
        ORDER BY epoch_millis
      `);

      if (heartRateResult[0]) {
        heartRateResult[0].values.forEach(([epochMillis, bpm]) => {
          dataPoints.push({
            timestamp: new Date(Number(epochMillis)).toISOString(),
            type: 'heart_rate',
            value: Number(bpm),
            source: 'health_connect'
          });
          importCounts.heart_rate++;
        });
      }
    } catch (e) {
      console.error('Error extracting heart rate:', e);
    }

    // Extract blood oxygen
    try {
      const oxygenResult = db.exec(`
        SELECT start_time, percentage
        FROM oxygen_saturation_record_table
        ORDER BY start_time
      `);

      if (oxygenResult[0]) {
        oxygenResult[0].values.forEach(([startTime, percentage]) => {
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'blood_oxygen',
            value: Number(percentage),
            source: 'health_connect'
          });
          importCounts.blood_oxygen++;
        });
      }
    } catch (e) {
      console.error('Error extracting blood oxygen:', e);
    }

    // Extract respiratory rate
    try {
      const respResult = db.exec(`
        SELECT start_time, rate
        FROM respiratory_rate_record_table
        ORDER BY start_time
      `);

      if (respResult[0]) {
        respResult[0].values.forEach(([startTime, rate]) => {
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'respiratory_rate',
            value: Number(rate),
            source: 'health_connect'
          });
          importCounts.respiratory_rate++;
        });
      }
    } catch (e) {
      console.error('Error extracting respiratory rate:', e);
    }

    // Extract steps
    try {
      const stepsResult = db.exec(`
        SELECT start_time, count
        FROM steps_record_table
        ORDER BY start_time
      `);

      if (stepsResult[0]) {
        stepsResult[0].values.forEach(([startTime, count]) => {
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'steps',
            value: Number(count),
            source: 'health_connect'
          });
          importCounts.steps++;
        });
      }
    } catch (e) {
      console.error('Error extracting steps:', e);
    }

    // Extract distance
    try {
      const distanceResult = db.exec(`
        SELECT start_time, distance_meters
        FROM distance_record_table
        ORDER BY start_time
      `);

      if (distanceResult[0]) {
        distanceResult[0].values.forEach(([startTime, meters]) => {
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'distance',
            value: Number(meters) / 1000, // Convert to km
            source: 'health_connect'
          });
          importCounts.distance++;
        });
      }
    } catch (e) {
      console.error('Error extracting distance:', e);
    }

    // Extract calories
    try {
      const caloriesResult = db.exec(`
        SELECT start_time, energy_kcal
        FROM total_calories_burned_record_table
        ORDER BY start_time
      `);

      if (caloriesResult[0]) {
        caloriesResult[0].values.forEach(([startTime, kcal]) => {
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'calories_burned',
            value: Number(kcal),
            source: 'health_connect'
          });
          importCounts.calories++;
        });
      }
    } catch (e) {
      console.error('Error extracting calories:', e);
    }

    // Extract sleep sessions
    try {
      const sleepResult = db.exec(`
        SELECT start_time, end_time
        FROM sleep_session_record_table
        ORDER BY start_time
      `);

      if (sleepResult[0]) {
        sleepResult[0].values.forEach(([startTime, endTime]) => {
          const durationHours = (Number(endTime) - Number(startTime)) / (1000 * 60 * 60);
          dataPoints.push({
            timestamp: new Date(Number(startTime)).toISOString(),
            type: 'sleep_duration',
            value: durationHours,
            source: 'health_connect',
            metadata: { end_time: new Date(Number(endTime)).toISOString() }
          });
          importCounts.sleep++;
        });
      }
    } catch (e) {
      console.error('Error extracting sleep:', e);
    }

    // Close database
    db.close();

    // Batch insert into Supabase (in chunks of 1000 to avoid payload limits)
    const BATCH_SIZE = 1000;
    let insertedCount = 0;

    for (let i = 0; i < dataPoints.length; i += BATCH_SIZE) {
      const batch = dataPoints.slice(i, i + BATCH_SIZE).map(dp => ({
        user_id: userId,
        timestamp: dp.timestamp,
        type: dp.type,
        value: dp.value,
        source: dp.source,
        accuracy: 95, // Default high accuracy for Health Connect data
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
    }

    // Update sync status
    await supabase
      .from('health_sync_status')
      .upsert({
        user_id: userId,
        last_sync_timestamp: new Date().toISOString(),
        data_points_count: insertedCount
      }, { onConflict: 'user_id' });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        imported: insertedCount,
        breakdown: importCounts
      })
    };

  } catch (error) {
    console.error('Error processing Health Connect import:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process Health Connect data',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
