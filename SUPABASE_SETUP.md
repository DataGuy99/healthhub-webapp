# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with GitHub
3. Click "New Project"
4. Fill in:
   - **Name**: healthhub-supplements
   - **Database Password**: (generate strong password and save it)
   - **Region**: Choose closest to you
5. Click "Create new project" (takes ~2 minutes)

## 2. Database Schema

Once your project is ready, go to **SQL Editor** and run this:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Supplements table
CREATE TABLE supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  dose_unit TEXT,
  form TEXT,
  section TEXT,
  active_days JSONB,
  is_stack BOOLEAN DEFAULT false,
  stack_id UUID,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement logs table
CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  is_taken BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id, date)
);

-- Supplement sections table
CREATE TABLE supplement_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_supplements_user ON supplements(user_id);
CREATE INDEX idx_supplement_logs_user ON supplement_logs(user_id);
CREATE INDEX idx_supplement_logs_date ON supplement_logs(date);
CREATE INDEX idx_supplement_sections_user ON supplement_sections(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_sections ENABLE ROW LEVEL SECURITY;

-- Supplements policies
CREATE POLICY "Users can view their own supplements"
  ON supplements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplements"
  ON supplements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplements"
  ON supplements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplements"
  ON supplements FOR DELETE
  USING (auth.uid() = user_id);

-- Supplement logs policies
CREATE POLICY "Users can view their own logs"
  ON supplement_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
  ON supplement_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON supplement_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON supplement_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Supplement sections policies
CREATE POLICY "Users can view their own sections"
  ON supplement_sections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sections"
  ON supplement_sections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sections"
  ON supplement_sections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sections"
  ON supplement_sections FOR DELETE
  USING (auth.uid() = user_id);
```

## 3. Enable Email Authentication

1. Go to **Authentication** > **Providers**
2. Enable **Email** provider
3. Disable **Confirm email** (for easier testing) - you can enable later
4. Click **Save**

## 4. Get API Keys

1. Go to **Project Settings** (gear icon) > **API**
2. Copy these values:
   - **Project URL**: (something like `https://xxx.supabase.co`)
   - **anon public key**: (long string starting with `eyJ...`)

## 5. Add to Netlify Environment Variables

1. Go to your Netlify site dashboard
2. Go to **Site settings** > **Environment variables**
3. Add these variables:
   - `VITE_SUPABASE_URL`: Your Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your anon public key
4. Click **Save**
5. Trigger a new deploy for changes to take effect

## 6. Local Development (.env file)

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Never commit this file to git** (already in .gitignore)

## 7. Test the Connection

After deploying, you should be able to:
1. Sign up with email/password
2. Create supplements
3. Log daily supplements
4. Data persists across devices/sessions

## Troubleshooting

### "JWT expired" or "Invalid API key"
- Check that environment variables are set correctly in Netlify
- Redeploy after adding env vars

### "Row Level Security policy violation"
- Make sure you're logged in
- Check that `user_id` matches `auth.uid()` in your queries

### Data not showing up
- Check browser console for errors
- Verify you're signed in (check localStorage for `supabase.auth.token`)
- Go to Supabase **Table Editor** to see raw data

## Next Steps

Once Supabase is set up:
1. Install `@supabase/supabase-js` package
2. Update `src/lib/supabase.ts` with configuration
3. Replace IndexedDB calls with Supabase queries
4. Test locally, then deploy to Netlify
