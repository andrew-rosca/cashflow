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
    // Run migration with timeout (2 minutes should be plenty for a single migration)
    // Use direct prisma command (prisma is in node_modules/.bin after npm install)
    console.log('   Running: prisma migrate deploy');
    console.log('   This may take a moment to connect to the database...');
    
    // For Supabase (and other poolers), migrations need a direct connection
    // pgBouncer (port 6543) doesn't support migrations - we need port 5432
    let dbUrlForMigration = dbUrl;
    
    // For Supabase, migrations need a direct connection (not pgBouncer)
    // pgBouncer (port 6543) doesn't support DDL operations like migrations
    if (dbUrl.includes('pooler.supabase.com') || dbUrl.includes(':6543') || dbUrl.includes('pgbouncer=true')) {
      console.log('   Detected Supabase pooler - switching to direct connection for migrations...');
      
      // Try to use POSTGRES_URL_NON_POOLING first (if it's correctly configured)
      if (process.env.POSTGRES_URL_NON_POOLING && !process.env.POSTGRES_URL_NON_POOLING.includes('pooler')) {
        console.log('   Using POSTGRES_URL_NON_POOLING for migrations...');
        dbUrlForMigration = process.env.POSTGRES_URL_NON_POOLING;
      } else if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD) {
        // Construct direct connection from individual components
        const directHost = process.env.POSTGRES_HOST;
        const user = process.env.POSTGRES_USER;
        const password = process.env.POSTGRES_PASSWORD;
        const database = process.env.POSTGRES_DATABASE || 'postgres';
        dbUrlForMigration = `postgresql://${user}:${password}@${directHost}:5432/${database}?sslmode=require`;
        console.log(`   Constructed direct connection using POSTGRES_HOST: ${directHost}`);
      } else {
        // Fallback: parse pooler URL and construct direct connection
        const match = dbUrl.match(/postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
        if (match) {
          const [, , user, password, , , database] = match;
          // Use POSTGRES_HOST if available, otherwise try to extract from URL
          const directHost = process.env.POSTGRES_HOST || 'db.qwdthwwxkcpicvetavlc.supabase.co';
          dbUrlForMigration = `postgresql://${user}:${password}@${directHost}:5432/${database}?sslmode=require`;
          console.log(`   Constructed direct connection: ${directHost}`);
        } else {
          // Last resort: simple string replacement
          dbUrlForMigration = dbUrl
            .replace(':6543', ':5432')
            .replace('pooler.supabase.com', 'supabase.co')
            .replace(/[?&]pgbouncer=true/, '')
            .replace(/[?&]pgbouncer=1/, '')
            .replace(/[?&]supa=base-pooler[^&]*/, '');
        }
      }
    }
    
    // Ensure DATABASE_URL has connection timeout
    if (!dbUrlForMigration.includes('connect_timeout')) {
      const separator = dbUrlForMigration.includes('?') ? '&' : '?';
      dbUrlForMigration = `${dbUrlForMigration}${separator}connect_timeout=10`;
    }
    
    const startTime = Date.now();
    execSync('prisma migrate deploy', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: dbUrlForMigration,
      },
      timeout: 2 * 60 * 1000, // 2 minute timeout (should be plenty)
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Migrations deployed successfully (took ${duration}s)`);
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
