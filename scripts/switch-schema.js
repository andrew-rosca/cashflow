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

// Get DATABASE_URL from environment
const dbUrl = process.env.DATABASE_URL || '';

// Determine which schema to use
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

