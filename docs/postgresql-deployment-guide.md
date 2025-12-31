# Deployment Guide - Vercel with PostgreSQL

This guide walks you through deploying CashFlow to Vercel with PostgreSQL for production.

## Overview

- **Local Development**: SQLite (fast, no setup required)
- **Tests**: SQLite (temporary files, automatic cleanup)
- **Production**: PostgreSQL (Vercel Postgres, Supabase, Neon, or any PostgreSQL provider)
- **Deployment**: Vercel (zero-config Next.js deployment)

## Prerequisites

1. A Vercel account (free tier is fine)
2. A GitHub account (for connecting your repo)
3. Your code pushed to a GitHub repository
4. A PostgreSQL database (see options below)

## Step 1: Set Up PostgreSQL Database

You have several options for PostgreSQL:

### Option A: Vercel Postgres (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database** → **Postgres**
3. Choose a plan (Hobby tier is free)
4. Create the database
5. Vercel will automatically set the `POSTGRES_URL` environment variable

**Note**: Vercel Postgres uses `POSTGRES_URL` instead of `DATABASE_URL`. You may need to set `DATABASE_URL` to match `POSTGRES_URL` in your environment variables.

### Option B: Supabase (Free Tier Available)

1. Sign up at [Supabase](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. Copy the connection string (URI format)
5. Use this as your `DATABASE_URL` in Vercel

### Option C: Neon (Serverless PostgreSQL)

1. Sign up at [Neon](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Use this as your `DATABASE_URL` in Vercel

### Option D: Other PostgreSQL Providers

Any PostgreSQL-compatible database works:
- Railway
- Render
- AWS RDS
- Google Cloud SQL
- Self-hosted PostgreSQL

## Step 2: Configure Environment Variables in Vercel

1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Add the following variables:

### Required Variables:

```bash
# Database - PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
# Or: postgresql://user:password@host:port/database?sslmode=require
DATABASE_URL="postgresql://user:password@host:port/database"

# NextAuth
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="your-secret-key-here"  # Use a long random string

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Apple OAuth (optional)
APPLE_ID=""
APPLE_SECRET=""
```

### Important Notes:

- **DATABASE_URL**: Must start with `postgresql://` or `postgres://` for the schema switching script to work correctly
- **NEXTAUTH_URL**: Must match your production domain exactly
- **NEXTAUTH_SECRET**: Generate a secure random string: `openssl rand -base64 32`
- Set these for **Production**, **Preview**, and **Development** environments as needed

## Step 3: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   - `https://your-app.vercel.app/api/auth/callback/google`
   - `https://your-app-name.vercel.app/api/auth/callback/google` (if using Vercel's default domain)

## Step 4: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default - includes schema switching)
   - **Output Directory**: `.next` (default)
6. Add environment variables (from Step 2)
7. Click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

## Step 5: Run Database Migrations

After first deployment, you need to run Prisma migrations to create the database schema:

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# Pull environment variables
vercel env pull .env.production

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# The build script will automatically switch to PostgreSQL schema
# Generate Prisma client with PostgreSQL schema
npm run db:generate

# Push schema to production database
npm run db:push
```

### Option B: Manual Migration

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Copy the `DATABASE_URL` value
3. Run locally with that connection string:
   ```bash
   DATABASE_URL="your-postgresql-url" npm run db:generate
   DATABASE_URL="your-postgresql-url" npm run db:push
   ```

## Step 6: Verify Deployment

1. Visit your Vercel deployment URL
2. You should be redirected to the login page
3. Test Google Sign-In
4. Verify you can create accounts and transactions
5. Check that data persists (create something, refresh, verify it's still there)

## Local Development

Your local development environment uses SQLite:

```bash
# .env file (local)
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
# ... other variables
```

The schema switching script automatically detects SQLite URLs and uses the SQLite schema.

## Database Schema Management

### How Schema Switching Works

The project uses automatic schema switching based on `DATABASE_URL`:

- **SQLite URLs** (`file:...`): Uses `schema.sqlite.prisma`
- **PostgreSQL URLs** (`postgresql://...` or `postgres://...`): Uses `schema.postgres.prisma`

The switching happens automatically in:
- `npm run build` (production builds)
- `npm run db:push` (schema migrations)
- `npm run db:generate` (Prisma client generation)

### For Local Development:

```bash
# Uses SQLite schema automatically
npm run db:push
npm run db:generate
npm run dev
```

### For Production:

```bash
# Set production DATABASE_URL (PostgreSQL)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Schema switches to PostgreSQL automatically
npm run db:generate
npm run db:push
```

## Troubleshooting

### Issue: Database connection fails

**Solution**: 
- Verify `DATABASE_URL` is set correctly in Vercel
- Check that your PostgreSQL database is running and accessible
- Ensure the connection string format is correct: `postgresql://user:password@host:port/database`
- For cloud providers, check if SSL is required and add `?sslmode=require` if needed

### Issue: Schema switching doesn't work

**Solution**:
- Verify `DATABASE_URL` starts with `postgresql://` or `postgres://` for PostgreSQL
- Check that `schema.postgres.prisma` exists in `prisma/` directory
- Run `node scripts/switch-schema.js` manually to test

### Issue: Authentication redirects fail

**Solution**:
- Verify `NEXTAUTH_URL` matches your production domain exactly
- Check Google OAuth redirect URIs include production domain
- Clear browser cookies and try again

### Issue: Migrations fail

**Solution**:
- Check that you're using the correct `DATABASE_URL` format
- Verify database credentials are correct
- Ensure database exists and is accessible
- Check database user has CREATE TABLE permissions

## Next Steps

After successful deployment:
1. Set up a custom domain (optional)
2. Configure monitoring and error tracking
3. Set up automated backups for the database
4. Configure preview deployments for pull requests

## Summary

The deployment setup uses:
- ✅ SQLite for local development (simple, no setup)
- ✅ SQLite for tests (fast, isolated)
- ✅ PostgreSQL for production (robust, scalable)

The schema automatically switches based on your `DATABASE_URL`, so you don't need to manually manage different schemas.

