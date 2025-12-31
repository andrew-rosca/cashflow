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
const fs = require('fs');

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
  
  // Prepare database URL for migration (direct connection, not pooler)
  let dbUrlForMigration = dbUrl;
  
  if (dbUrl.includes('pooler.supabase.com') || dbUrl.includes(':6543') || dbUrl.includes('pgbouncer=true')) {
    console.log('   Detected Supabase pooler - switching to direct connection for migrations...');
    
    if (process.env.POSTGRES_URL_NON_POOLING) {
      console.log('   Using POSTGRES_URL_NON_POOLING for migrations...');
      dbUrlForMigration = process.env.POSTGRES_URL_NON_POOLING;
      if (dbUrlForMigration.startsWith('postgres://')) {
        dbUrlForMigration = dbUrlForMigration.replace('postgres://', 'postgresql://');
      }
    } else {
      console.log('   Converting pooler URL to direct connection (port 5432)...');
      dbUrlForMigration = dbUrl
        .replace(':6543', ':5432')
        .replace(/[?&]pgbouncer=true/, '')
        .replace(/[?&]pgbouncer=1/, '')
        .replace(/[?&]supa=base-pooler[^&]*/, '');
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
  
  try {
    // Try to deploy migrations
    console.log('   Running: prisma migrate deploy');
    console.log('   This may take a moment to connect to the database...');
    
    let migrationOutput = '';
    let migrationSucceeded = false;
    
    try {
      migrationOutput = execSync('prisma migrate deploy', { 
        stdio: 'pipe',
        env: {
          ...process.env,
          DATABASE_URL: dbUrlForMigration,
        },
        timeout: 2 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8',
      }).toString();
      
      console.log(migrationOutput);
      migrationSucceeded = true;
    } catch (migrateError) {
      const stdout = migrateError.stdout?.toString() || '';
      const stderr = migrateError.stderr?.toString() || '';
      const errorOutput = stdout + stderr + (migrateError.message || '');
      
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      const isP3005 = errorOutput.includes('P3005') || 
                      errorOutput.includes('database schema is not empty') ||
                      errorOutput.includes('schema is not empty');
      
      if (isP3005) {
        console.log('   Database schema exists but migration history is missing.');
        console.log('   Applying migration SQL, then baselining...');
        
        const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
        const migrations = fs.readdirSync(migrationsDir)
          .filter(dir => {
            const fullPath = path.join(migrationsDir, dir);
            return fs.statSync(fullPath).isDirectory() && dir !== 'migration_lock.toml';
          })
          .sort();
        
        if (migrations.length > 0) {
          const firstMigration = migrations[0];
          const migrationSqlPath = path.join(migrationsDir, firstMigration, 'migration.sql');
          
          if (fs.existsSync(migrationSqlPath)) {
            const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8').trim();
            console.log(`   Running migration SQL for "${firstMigration}"...`);
            console.log(`   SQL: ${migrationSql}`);
            
            // Use Prisma Client to execute SQL - must be synchronous
            // Generate Prisma Client first if needed
            try {
              execSync('prisma generate', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: dbUrlForMigration } });
            } catch (e) {
              // Already generated, that's fine
            }
            
            // Execute SQL using a Node script that we'll run synchronously
            const sqlScript = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

(async () => {
  try {
    const sql = ${JSON.stringify(migrationSql)};
    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Migration SQL executed successfully');
  } catch (error) {
    const errorMsg = error.message || '';
    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || (errorMsg.includes('column') && errorMsg.includes('exists'))) {
      console.log('ℹ️  Column already exists (this is OK)');
    } else {
      console.error('❌ SQL execution failed:', errorMsg);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
})();
`;
            
            // Write temp script and execute it
            const tempScriptPath = path.join(__dirname, '..', '.temp-migration-exec.js');
            fs.writeFileSync(tempScriptPath, sqlScript);
            
            try {
              execSync(`node ${tempScriptPath}`, {
                stdio: 'inherit',
                env: {
                  ...process.env,
                  DATABASE_URL: dbUrlForMigration,
                },
                timeout: 30 * 1000,
              });
              console.log('   ✅ Migration SQL executed successfully');
            } finally {
              // Clean up temp script
              try {
                fs.unlinkSync(tempScriptPath);
              } catch (e) {
                // Ignore cleanup errors
              }
            }
            
            // Now baseline
            console.log(`   Marking migration "${firstMigration}" as applied...`);
            const baselineOutput = execSync(`prisma migrate resolve --applied ${firstMigration}`, {
              stdio: 'pipe',
              env: {
                ...process.env,
                DATABASE_URL: dbUrlForMigration,
              },
              timeout: 30 * 1000,
              encoding: 'utf8',
            }).toString();
            if (baselineOutput) console.log(baselineOutput);
            console.log('   ✅ Database baselined successfully');
            
            migrationSucceeded = true;
          } else {
            throw new Error(`Migration SQL file not found: ${migrationSqlPath}`);
          }
        } else {
          throw new Error('No migrations found to baseline');
        }
      } else {
        throw migrateError;
      }
    }
    
    if (!migrationSucceeded) {
      throw new Error('Migration deployment failed');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Migrations deployed successfully (took ${duration}s)`);
  } catch (error) {
    if (process.env.VERCEL || process.env.CI) {
      console.error('❌ Migration deployment failed in production');
      console.error('   Error:', error.message);
      console.error('   Build will fail to prevent deploying with incorrect schema');
      process.exit(1);
    } else {
      console.error('⚠️  Migration deployment failed:', error.message);
      console.error('   This may be expected if running locally without a PostgreSQL database.');
    }
  }
} else {
  console.log('ℹ️  Detected SQLite - skipping migrations (use db:push for local dev)');
}
