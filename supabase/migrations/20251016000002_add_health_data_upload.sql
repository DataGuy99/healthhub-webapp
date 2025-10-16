-- Migration: Add health data upload endpoint table
-- Created: 2025-10-16
-- Purpose: Receive encrypted health data uploads from Android HealthBridge app

-- Health data upload staging table (receives encrypted data from Android)
CREATE TABLE IF NOT EXISTS health_data_upload (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_data INTEGER[] NOT NULL,
    iv INTEGER[] NOT NULL,
    data_point_count INTEGER NOT NULL,
    extraction_timestamp TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT non_negative_data_points CHECK (data_point_count >= 0)
);

COMMENT ON TABLE health_data_upload IS
'Staging table for encrypted health data uploads from Android HealthBridge app';

COMMENT ON COLUMN health_data_upload.encrypted_data IS
'AES-256-GCM encrypted health data as integer array (from byte array)';

COMMENT ON COLUMN health_data_upload.iv IS
'Initialization vector for AES-GCM decryption as integer array';

COMMENT ON COLUMN health_data_upload.processed IS
'Whether this upload has been decrypted and inserted into health_data_points';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_upload_user
ON health_data_upload (user_id);

CREATE INDEX IF NOT EXISTS idx_health_upload_created
ON health_data_upload (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_upload_unprocessed
ON health_data_upload (user_id, created_at DESC)
WHERE processed = false;

-- Enable Row Level Security
ALTER TABLE health_data_upload ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only upload and access their own health data
CREATE POLICY health_upload_isolation ON health_data_upload
    FOR ALL USING (auth.uid() = user_id);

-- Function to process uploaded health data (decrypt and insert into health_data_points)
-- NOTE: Actual decryption happens client-side in web app for security
-- This function marks uploads as processed after web app decrypts and inserts data
CREATE OR REPLACE FUNCTION mark_health_upload_processed(upload_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE health_data_upload
    SET processed = true
    WHERE id = upload_id
        AND user_id = auth.uid()
        AND processed = false;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_health_upload_processed IS
'Mark a health data upload as processed after web app decrypts and inserts the data';

-- Function to get unprocessed uploads for current user
CREATE OR REPLACE FUNCTION get_unprocessed_health_uploads()
RETURNS TABLE (
    id UUID,
    encrypted_data INTEGER[],
    iv INTEGER[],
    data_point_count INTEGER,
    extraction_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hdu.id,
        hdu.encrypted_data,
        hdu.iv,
        hdu.data_point_count,
        hdu.extraction_timestamp,
        hdu.created_at
    FROM health_data_upload hdu
    WHERE hdu.user_id = auth.uid()
        AND hdu.processed = false
    ORDER BY hdu.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unprocessed_health_uploads IS
'Retrieve all unprocessed health data uploads for the current user for client-side decryption';

-- Function to clean up old processed uploads (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_health_uploads()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete processed uploads older than 7 days
    DELETE FROM health_data_upload
    WHERE processed = true
        AND created_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_health_uploads IS
'Clean up processed health uploads older than 7 days (retention policy)';
