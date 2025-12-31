# Production Database Migration Guide

## Adding the `preferences` Column

If you see an error like:
```
The column `User.preferences` does not exist in the current database.
```

You need to run a migration to add the column to your production database.

## Quick Fix: Deploy Existing Migration

The project now includes a migration for the `preferences` column. To apply it:

### Option 1: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login and link project
vercel login
vercel link

# Pull production environment variables
vercel env pull .env.production

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Generate Prisma client (schema auto-switches to PostgreSQL)
npm run db:generate

# Deploy migrations to production
npm run db:migrate:deploy
```

### Option 2: Manual Migration

```bash
# Get DATABASE_URL from Vercel Dashboard → Settings → Environment Variables
export DATABASE_URL="your-postgresql-connection-string"

# Generate Prisma client
npm run db:generate

# Deploy migrations
npm run db:migrate:deploy
```

## What This Does

The `npm run db:migrate:deploy` command will:
- Apply all pending migrations from `prisma/migrations/`
- Add the `preferences` column as `JSONB` type (PostgreSQL)
- Use `IF NOT EXISTS` so it's safe to run multiple times
- Not affect any existing data (the column is nullable)

## Migration Included

The migration `20250101000000_add_user_preferences` adds:
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
```

## Verification

After running the migration:
1. Check Vercel logs - the error should stop appearing
2. Test the app - user settings should work correctly
3. Verify migration status: `npx prisma migrate status` (if you have database access)

## For Future Migrations

See [docs/migrations-guide.md](./migrations-guide.md) for the complete migration workflow.

