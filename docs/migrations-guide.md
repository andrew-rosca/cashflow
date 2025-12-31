# Database Migrations Guide

This project uses Prisma migrations for production (PostgreSQL) and `db push` for local development (SQLite).

## Overview

- **Local Development (SQLite)**: Uses `prisma db push` (no migrations needed)
- **Production (PostgreSQL)**: Uses Prisma migrations for version-controlled schema changes
- **Schema Switching**: Automatically switches between SQLite and PostgreSQL schemas based on `DATABASE_URL`

## Migration Workflow

### Creating a New Migration

1. **Update the schema files**:
   - Edit `prisma/schema.postgres.prisma` for PostgreSQL changes
   - Edit `prisma/schema.sqlite.prisma` for SQLite changes (if needed)

2. **Create the migration** (PostgreSQL only):
   ```bash
   # Set production DATABASE_URL (or use Vercel env pull)
   export DATABASE_URL="postgresql://user:password@host:port/database"
   
   # Create migration
   npm run db:migrate:create add_feature_name
   ```

3. **Review the migration**:
   - Check the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`
   - Verify it's safe to apply

4. **Test locally** (optional):
   ```bash
   # Apply to local PostgreSQL if you have one
   npm run db:migrate:deploy
   ```

### Applying Migrations

#### Local Development (SQLite)
```bash
# Just push the schema (no migrations needed)
npm run db:push
```

#### Production (PostgreSQL)
```bash
# Option 1: Using Vercel CLI (Recommended)
vercel env pull .env.production
export $(cat .env.production | grep -v '^#' | xargs)
npm run db:migrate:deploy

# Option 2: Manual
export DATABASE_URL="your-postgresql-connection-string"
npm run db:migrate:deploy
```

## Migration Commands

- `npm run db:migrate` - Apply schema changes to local database (uses db push)
- `npm run db:migrate:deploy` - Deploy migrations to production (PostgreSQL only)
- `npm run db:migrate:create <name>` - Create a new migration (PostgreSQL only)

## Initial Migration: Add User Preferences

The first migration adds the `preferences` column to the `User` table:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
```

This migration is located at:
`prisma/migrations/20250101000000_add_user_preferences/migration.sql`

## Migration Best Practices

1. **Always test migrations locally first** (if you have a local PostgreSQL instance)
2. **Review generated SQL** before deploying to production
3. **Use descriptive migration names** (e.g., `add_user_preferences`, `add_transaction_category`)
4. **Keep migrations small and focused** - one logical change per migration
5. **Never edit existing migrations** - create a new migration to fix issues
6. **Back up production database** before running migrations (if possible)

## Troubleshooting

### Migration fails in production

1. Check the error message in Vercel logs
2. Verify `DATABASE_URL` is correct
3. Ensure database user has ALTER TABLE permissions
4. Check if migration was already applied: `prisma migrate status`

### Migration already applied

If you see "Migration already applied", the migration was likely run manually or via `db push`. You can mark it as applied:

```bash
npx prisma migrate resolve --applied <migration-name>
```

### Need to rollback

Prisma doesn't have built-in rollback. Options:
1. Create a new migration to reverse the changes
2. Manually run SQL to undo the migration
3. Restore from backup

## Schema Switching

The migration scripts automatically switch schemas based on `DATABASE_URL`:
- `postgresql://` or `postgres://` → Uses PostgreSQL schema
- `file:` → Uses SQLite schema

This happens automatically, so you don't need to manually switch schemas.

