// Run this script once to create category tables
// Usage: node create-category-tables.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the SQL file
const sql = fs.readFileSync('./supabase/migrations/20251011000002_create_category_tables.sql', 'utf8');

console.log('📝 Creating category tables...');
console.log('\nPlease run this SQL manually in Supabase Dashboard → SQL Editor:\n');
console.log('='.repeat(80));
console.log(sql);
console.log('='.repeat(80));
console.log('\n✅ Copy the SQL above and run it in your Supabase dashboard!');
console.log('📍 Dashboard: https://supabase.com/dashboard/project/clxocppshubwtbloefsv/sql');
