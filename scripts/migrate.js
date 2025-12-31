#!/usr/bin/env node

/**
 * Migration Script
 * 
 * Handles Prisma migrations for both SQLite (local dev) and PostgreSQL (production).
 * - For PostgreSQL: Uses Prisma migrations (prisma migrate)
 * - For SQLite: Uses db push (migrations not needed for local dev)
 * 
 * Usage:
 *   node scripts/migrate.js [command]
 * 
 * Commands:
 *   dev     - Run migrations for local development (SQLite - uses db push)
 *   deploy  - Run migrations for production (PostgreSQL - uses migrate deploy)
 *   create  - Create a new migration (PostgreSQL only)
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

const command = process.argv[2] || 'dev';

if (command === 'create') {
  // Create a new migration (PostgreSQL only)
  if (!isPostgres) {
    console.error('❌ Error: Migrations can only be created for PostgreSQL databases.');
    console.error('   For SQLite, use `npm run db:push` instead.');
    process.exit(1);
  }
  
  const migrationName = process.argv[3];
  if (!migrationName) {
    console.error('❌ Error: Migration name is required.');
    console.error('   Usage: npm run db:migrate:create <migration-name>');
    process.exit(1);
  }
  
  console.log('📝 Creating migration:', migrationName);
  execSync(`npx prisma migrate dev --name ${migrationName} --create-only`, { stdio: 'inherit' });
  
} else if (command === 'deploy') {
  // Deploy migrations to production (PostgreSQL only)
  if (!isPostgres) {
    console.error('❌ Error: Migration deployment is only for PostgreSQL databases.');
    console.error('   For SQLite, use `npm run db:push` instead.');
    process.exit(1);
  }
  
  console.log('🚀 Deploying migrations to production database...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
} else if (command === 'dev') {
  // Local development - use db push (works for both, but SQLite doesn't need migrations)
  console.log('🔧 Applying schema changes to local database...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  
} else {
  console.error(`❌ Error: Unknown command "${command}"`);
  console.error('');
  console.error('Available commands:');
  console.error('  dev     - Apply schema changes to local database (db push)');
  console.error('  deploy  - Deploy migrations to production (PostgreSQL only)');
  process.exit(1);
}

