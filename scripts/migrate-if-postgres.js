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
      
      // Use POSTGRES_URL_NON_POOLING if available (Supabase provides this)
      // Even if it says "pooler" in the host, port 5432 is the direct connection
      if (process.env.POSTGRES_URL_NON_POOLING) {
        console.log('   Using POSTGRES_URL_NON_POOLING for migrations...');
        dbUrlForMigration = process.env.POSTGRES_URL_NON_POOLING;
        // Ensure it uses postgresql:// protocol (not postgres://)
        if (dbUrlForMigration.startsWith('postgres://')) {
          dbUrlForMigration = dbUrlForMigration.replace('postgres://', 'postgresql://');
        }
      } else {
        // Fallback: change port from 6543 to 5432 (same host, different port)
        // Supabase uses the same hostname for both pooler and direct connections
        console.log('   Converting pooler URL to direct connection (port 5432)...');
        dbUrlForMigration = dbUrl
          .replace(':6543', ':5432')
          .replace(/[?&]pgbouncer=true/, '')
          .replace(/[?&]pgbouncer=1/, '')
          .replace(/[?&]supa=base-pooler[^&]*/, '');
        // Ensure postgresql:// protocol
        if (dbUrlForMigration.startsWith('postgres://')) {
          dbUrlForMigration = dbUrlForMigration.replace('postgres://', 'postgresql://');
        }
      }
    }
    
    // Ensure DATABASE_URL has connection timeout
    if (!dbUrlForMigration.includes('connect_timeout')) {
      const separator = dbUrlForMigration.includes('?') ? '&' : '?';
      dbUrlForMigration = `${dbUrlForMigration}${separator}connect_timeout=10`;
    }
    
    const startTime = Date.now();
    
    // Try to deploy migrations
    let migrationOutput = '';
    let migrationSucceeded = false;
    
    try {
      // Capture output to check for P3005 error
      migrationOutput = execSync('prisma migrate deploy', { 
        stdio: 'pipe',
        env: {
          ...process.env,
          DATABASE_URL: dbUrlForMigration,
        },
        timeout: 2 * 60 * 1000, // 2 minute timeout (should be plenty)
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        encoding: 'utf8',
      }).toString();
      
      // Print the output
      console.log(migrationOutput);
      migrationSucceeded = true;
    } catch (migrateError) {
      // Get error output - Prisma errors are in stdout
      const stdout = migrateError.stdout?.toString() || '';
      const stderr = migrateError.stderr?.toString() || '';
      const errorOutput = stdout + stderr + (migrateError.message || '');
      
      // Print the error output
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      // Check if it's a P3005 error (schema not empty)
      const isP3005 = errorOutput.includes('P3005') || 
                      errorOutput.includes('database schema is not empty') ||
                      errorOutput.includes('schema is not empty');
      
      if (isP3005) {
        console.log('   Database schema exists but migration history is missing.');
        console.log('   Baselining database (marking existing schema as migrated)...');
        
        // Get the migration name from the migrations directory
        const fs = require('fs');
        const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
        const migrations = fs.readdirSync(migrationsDir)
          .filter(dir => {
            const fullPath = path.join(migrationsDir, dir);
            return fs.statSync(fullPath).isDirectory() && dir !== 'migration_lock.toml';
          })
          .sort();
        
        if (migrations.length > 0) {
          // Mark the first migration as already applied
          const firstMigration = migrations[0];
          console.log(`   Marking migration "${firstMigration}" as applied...`);
          
          try {
            const baselineOutput = execSync(`prisma migrate resolve --applied ${firstMigration}`, {
              stdio: 'pipe',
              env: {
                ...process.env,
                DATABASE_URL: dbUrlForMigration,
              },
              timeout: 30 * 1000, // 30 second timeout
              encoding: 'utf8',
            }).toString();
            console.log(baselineOutput);
            console.log('   ✅ Database baselined successfully');
            
            // Now try migrate deploy again
            console.log('   Retrying migration deployment...');
            const retryOutput = execSync('prisma migrate deploy', {
              stdio: 'pipe',
              env: {
                ...process.env,
                DATABASE_URL: dbUrlForMigration,
              },
              timeout: 2 * 60 * 1000,
              maxBuffer: 10 * 1024 * 1024,
              encoding: 'utf8',
            }).toString();
            console.log(retryOutput);
            migrationSucceeded = true;
          } catch (baselineError) {
            console.error('   ❌ Baselining failed:', baselineError.message);
            throw baselineError;
          }
        } else {
          throw new Error('No migrations found to baseline');
        }
      } else {
        // Re-throw if it's a different error
        throw migrateError;
      }
    }
    
    if (!migrationSucceeded) {
      throw new Error('Migration deployment failed');
    }
    
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
