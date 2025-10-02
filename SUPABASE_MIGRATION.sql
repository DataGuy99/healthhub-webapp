-- Migration to add ingredients column to supplements table
-- Run this in Supabase SQL Editor

ALTER TABLE supplements ADD COLUMN IF NOT EXISTS ingredients JSONB;
