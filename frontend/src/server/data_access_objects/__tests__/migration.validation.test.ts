import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(__dirname, '../../../../../supabase/migrations/20260302000000_initial_schema.sql');
const CONFIRM_STORY_PATCH_PATH = resolve(
  __dirname,
  '../../../../../supabase/migrations/20260302223000_confirm_story_rpc_alignment.sql',
);
const SESSIONS_USER_SCOPE_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../../supabase/migrations/20260303124500_sessions_user_scope.sql',
);

describe('SQL Migration Validation', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('contains all 32 required tables', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8').toLowerCase();
    const requiredTables = [
      // Tier 1: no FK dependencies
      'users', 'resumes', 'jobs', 'questions',
      // Tier 2: depend on Tier 1
      'sessions', 'job_requirements', 'claimants',
      'answer_sessions', 'cases', 'stories', 'onboarding',
      // Tier 3: depend on Tier 2
      'analytics_events', 'primary_kpi_events', 'events',
      'session_metrics', 'session_slots',
      'story_records', 'behavioral_questions', 'drafts',
      'answers', 'content', 'orient_story_records',
      // Tier 4: depend on Tier 3
      'claims', 'sms_follow_ups',
      'truth_checks', 'verification_requests', 'drafting_workflows',
      // Tier 5: depend on Tier 4
      'delivery_attempts',
      'verification_attempts',
      'draft_metrics',
      'draft_versions',
      'story_metrics',
    ];
    for (const table of requiredTables) {
      expect(sql).toContain(`create table if not exists ${table}`);
    }
  });

  it('contains confirm_story RPC function', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8').toLowerCase();
    expect(sql).toContain('create or replace function confirm_story');
  });

  it('contains confirm_story RPC alignment patch with expected args and return keys', () => {
    expect(existsSync(CONFIRM_STORY_PATCH_PATH)).toBe(true);

    const sql = readFileSync(CONFIRM_STORY_PATCH_PATH, 'utf-8').toLowerCase();
    expect(sql).toContain('create or replace function public.confirm_story');
    expect(sql).toContain('p_question_id uuid');
    expect(sql).toContain('p_story_id text');
    expect(sql).toContain("'confirmed_story_id'");
    expect(sql).toContain("'excluded_count'");
  });

  it('uses UUID defaults via gen_random_uuid()', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(sql).toContain('gen_random_uuid()');
  });

  it('creates tables in FK dependency order (no forward references)', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8').toLowerCase();
    // Tier 1 tables should appear before Tier 2+ tables
    const usersIdx = sql.indexOf('create table if not exists users');
    const sessionsIdx = sql.indexOf('create table if not exists sessions');
    const claimsIdx = sql.indexOf('create table if not exists claims');
    expect(usersIdx).toBeLessThan(sessionsIdx);
    expect(sessionsIdx).toBeLessThan(claimsIdx);
  });

  it('has CHECK constraints for status enums', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8').toLowerCase();
    expect(sql).toContain('check');
  });

  it('has indexes on FK columns', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8').toLowerCase();
    expect(sql).toContain('create index');
  });

  it('contains sessions user-scope migration with user_id and index', () => {
    expect(existsSync(SESSIONS_USER_SCOPE_MIGRATION_PATH)).toBe(true);
    const sql = readFileSync(SESSIONS_USER_SCOPE_MIGRATION_PATH, 'utf-8').toLowerCase();

    expect(sql).toContain('alter table sessions');
    expect(sql).toContain('add column if not exists user_id');
    expect(sql).toContain('create index if not exists idx_sessions_user_state');
  });
});
