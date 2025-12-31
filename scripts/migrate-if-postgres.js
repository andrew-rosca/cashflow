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
  // Log masked database URL for debugging (hide password)
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log('   Database:', maskedUrl.split('@')[1] || 'configured');
  
  try {
    // Run migration with timeout (5 minutes should be plenty)
    // Use direct prisma command instead of npx for faster execution
    console.log('   Running: prisma migrate deploy');
    execSync('prisma migrate deploy', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        // Add connection timeout to prevent hanging
        PRISMA_CLIENT_ENGINE_TYPE: 'binary',
      },
      timeout: 5 * 60 * 1000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    });
    console.log('✅ Migrations deployed successfully');
  } catch (error) {
    // In production (Vercel), migrations must succeed
    if (process.env.VERCEL || process.env.CI) {
      console.error('❌ Migration deployment failed in production');
      console.error('   Error:', error.message);
      console.error('   Build will fail to prevent deploying with incorrect schema');
      process.exit(1);
    } else {
      // Local development - allow build to continue
      console.error('⚠️  Migration deployment failed:', error.message);
      console.error('   This may be expected if running locally without a PostgreSQL database.');
    }
  }
} else {
  console.log('ℹ️  Detected SQLite - skipping migrations (use db:push for local dev)');
  // For SQLite, migrations aren't needed - db push is used instead
  // This is fine, we just skip migration deployment
}
