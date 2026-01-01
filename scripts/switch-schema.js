#!/usr/bin/env node

/**
 * Schema Switching Script
 * 
 * Automatically switches between SQLite and PostgreSQL schemas based on DATABASE_URL.
 * - If DATABASE_URL starts with "postgresql://" or "postgres://" → uses PostgreSQL schema
 * - Otherwise → uses SQLite schema (default for local dev and tests)
 */

const fs = require('fs');
const path = require('path');

const prismaDir = path.join(__dirname, '..', 'prisma');
const sqliteSchema = path.join(prismaDir, 'schema.sqlite.prisma');
const postgresSchema = path.join(prismaDir, 'schema.postgres.prisma');
const targetSchema = path.join(prismaDir, 'schema.prisma');

function readEnvValueFromFile(envFilePath, key) {
  try {
    if (!fs.existsSync(envFilePath)) return null;
    const content = fs.readFileSync(envFilePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      if (k !== key) continue;
      let v = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

function getDatabaseUrl() {
  // Prefer explicit environment variable (e.g., CI / shell)
  const direct = process.env.DATABASE_URL;
  if (direct && direct.trim()) return direct.trim();

  // Next.js loads .env.local and .env, but this script runs BEFORE next dev.
  // So we replicate just enough env loading to detect DATABASE_URL correctly.
  const repoRoot = path.join(__dirname, '..');
  const envLocal = path.join(repoRoot, '.env.local');
  const env = path.join(repoRoot, '.env');

  return (
    readEnvValueFromFile(envLocal, 'DATABASE_URL') ||
    readEnvValueFromFile(env, 'DATABASE_URL') ||
    ''
  );
}

// Get DATABASE_URL from environment (or .env/.env.local when running before Next.js)
const dbUrl = getDatabaseUrl();

// Determine which schema to use
// Prefer postgresql:// over postgres:// for better Prisma compatibility
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

const sourceSchema = isPostgres ? postgresSchema : sqliteSchema;
const schemaName = isPostgres ? 'PostgreSQL' : 'SQLite';

// Check if source schema exists
if (!fs.existsSync(sourceSchema)) {
  console.error(`❌ Error: Source schema file not found: ${sourceSchema}`);
  process.exit(1);
}

// Copy the appropriate schema to schema.prisma
try {
  fs.copyFileSync(sourceSchema, targetSchema);
  console.log(`✓ Using ${schemaName} schema (detected from DATABASE_URL)`);
} catch (error) {
  console.error(`❌ Error copying schema: ${error.message}`);
  process.exit(1);
}

