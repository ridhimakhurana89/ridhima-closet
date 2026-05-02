-- Add a JSONB column to store onboarding questionnaire answers.
-- We keep the existing typed columns (color_season, style_rules, etc.) as
-- AI-prompt-friendly distillations; profile_answers is the raw record.

alter table user_preferences
  add column if not exists profile_answers jsonb not null default '{}'::jsonb,
  add column if not exists profile_updated_at timestamptz;
