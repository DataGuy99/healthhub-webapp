-- Import audit logs for tracking CSV and HealthConnect imports
-- Allows debugging and monitoring of import operations

CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('csv', 'healthconnect', 'plaid')),
  rows_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_user_created ON import_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_logs_type ON import_logs(import_type);

-- Enable Row Level Security
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own import logs" ON import_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own import logs" ON import_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
