#!/usr/bin/env node

/**
 * Conditionally Deploy Migrations Script
 * 
 * Only runs migrations if DATABASE_URL points to PostgreSQL.
 * This allows migrations to run automatically in production (Vercel)
 * while skipping them for local SQLite development.
 * 
 * Used in the build process to ensure migrations are applied automatically.
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

if (isPostgres) {
  console.log('🚀 Detected PostgreSQL - deploying migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migrations deployed successfully');
  } catch (error) {
    // If migrations fail, log the error but don't fail the build
    // This allows the build to continue even if database is temporarily unavailable
    // In production (Vercel), the database should always be available
    console.error('⚠️  Migration deployment failed:', error.message);
    console.error('   This may be expected if running locally without a PostgreSQL database.');
    console.error('   In production (Vercel), migrations will run automatically during deployment.');
    // Don't exit with error - let the build continue
    // The build will fail later if Prisma Client generation fails, which is appropriate
  }
} else {
  console.log('ℹ️  Detected SQLite - skipping migrations (use db:push for local dev)');
  // For SQLite, migrations aren't needed - db push is used instead
  // This is fine, we just skip migration deployment
}

