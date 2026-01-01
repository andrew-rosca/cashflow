#!/usr/bin/env node

/**
 * Local dev bootstrap:
 * - Ensure DATABASE_URL defaults to local SQLite (file:./prisma/dev.db) unless explicitly provided
 * - Switch Prisma schema accordingly
 * - Generate Prisma client
 * - Start next dev
 *
 * This prevents accidentally using a production Postgres DATABASE_URL from `.env` during local dev,
 * which can cause schema/data-type mismatches (e.g. dayOfWeek Json vs Int).
 */

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function readEnvValueFromFile(envFilePath, key) {
  try {
    if (!fs.existsSync(envFilePath)) return null
    const content = fs.readFileSync(envFilePath, 'utf8')
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const k = trimmed.slice(0, eqIdx).trim()
      if (k !== key) continue
      let v = trimmed.slice(eqIdx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return v
    }
  } catch {
    // ignore
  }
  return null
}

function resolveDatabaseUrl() {
  // Local dev should default to SQLite to avoid accidentally using a production Postgres
  // DATABASE_URL from `.env.local` and causing schema/data mismatches.
  //
  // To opt into Postgres locally, set:
  //   CASHFLOW_USE_POSTGRES_LOCAL=true
  // and provide DATABASE_URL in the shell.
  if (process.env.CASHFLOW_USE_POSTGRES_LOCAL === 'true') {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
      console.error('CASHFLOW_USE_POSTGRES_LOCAL=true requires DATABASE_URL to be set in the shell.')
      process.exit(1)
    }
    return process.env.DATABASE_URL.trim()
  }

  const repoRoot = path.join(__dirname, '..')
  const absDbPath = path.resolve(repoRoot, 'prisma', 'dev.db')
  return `file:${absDbPath}`
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
    cwd: path.join(__dirname, '..'),
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const databaseUrl = resolveDatabaseUrl()
const env = { ...process.env, DATABASE_URL: databaseUrl }

// Force NextAuth to treat local dev as http://localhost:3000 so cookies are non-secure
// and scoped correctly, even if .env.local contains production NEXTAUTH_URL.
if (!env.NEXTAUTH_URL) env.NEXTAUTH_URL = 'http://localhost:3000'
if (!env.NEXTAUTH_URL_INTERNAL) env.NEXTAUTH_URL_INTERNAL = env.NEXTAUTH_URL

if (process.argv.includes('--print')) {
  console.log(databaseUrl)
  process.exit(0)
}

run('node', ['scripts/switch-schema.js'], env)
run('npx', ['prisma', 'generate'], env)

// If Next's dev manifests are corrupted (common after hard crashes), wipe .next to recover.
try {
  const repoRoot = path.join(__dirname, '..')
  const manifestPath = path.join(repoRoot, '.next', 'server', 'app-paths-manifest.json')
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, 'utf8')
    JSON.parse(raw)
  }
} catch {
  try {
    fs.rmSync(path.join(__dirname, '..', '.next'), { recursive: true, force: true })
    console.log('ℹ️  Cleared .next due to corrupted manifest')
  } catch {
    // ignore
  }
}

run('npx', ['next', 'dev'], env)


