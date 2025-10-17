import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the migration file
const migrationPath = path.join(__dirname, 'supabase/migrations/20251016000003_add_correlation_insights_tables.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('Applying migration: 20251016000003_add_correlation_insights_tables.sql');

// Note: Supabase client doesn't support raw SQL execution from JavaScript
// You'll need to apply this migration through the Supabase dashboard SQL editor
// or use the Supabase CLI with proper credentials

console.log('\n=== MIGRATION SQL ===\n');
console.log(migrationSQL);
console.log('\n=== END MIGRATION SQL ===\n');
console.log('Please apply this SQL through the Supabase dashboard SQL editor:');
console.log(`1. Go to ${supabaseUrl.replace('/v1', '')}/project/_/sql`);
console.log('2. Paste the SQL above');
console.log('3. Click "Run"');
