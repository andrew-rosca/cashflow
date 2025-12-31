#!/usr/bin/env node

/**
 * Create Migration Script
 * 
 * Helper script to create a new Prisma migration.
 * This ensures the schema is switched correctly before creating the migration.
 * 
 * Usage:
 *   npm run db:migrate:create <migration-name>
 */

const { execSync } = require('child_process');
const path = require('path');

// First, switch to the correct schema
const switchSchemaScript = path.join(__dirname, 'switch-schema.js');
execSync(`node ${switchSchemaScript}`, { stdio: 'inherit' });

// Get DATABASE_URL from environment
const dbUrl = process.env.DATABASE_URL || '';

// Determine which database type
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.error('❌ Error: Migrations can only be created for PostgreSQL databases.');
  console.error('   For SQLite, use `npm run db:push` instead.');
  process.exit(1);
}

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('❌ Error: Migration name is required.');
  console.error('   Usage: npm run db:migrate:create <migration-name>');
  process.exit(1);
}

console.log('📝 Creating migration:', migrationName);
execSync(`npx prisma migrate dev --name ${migrationName} --create-only`, { stdio: 'inherit' });

