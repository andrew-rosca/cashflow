#!/bin/bash

set -e

echo "🔄 Resetting database to blank state (user only)"
echo "================================================"

# Reset database schema (drops all tables and recreates them)
echo "🗄️  Resetting database schema..."
if npx prisma db push --accept-data-loss --force-reset; then
    echo "✅ Database schema reset successfully"
else
    echo "❌ Database reset failed"
    exit 1
fi

# Seed only the user (no accounts or transactions)
echo "🌱 Seeding database with user only..."
if npm run db:seed:user-only; then
    echo "✅ User seeded successfully"
else
    echo "❌ User seeding failed"
    exit 1
fi

echo ""
echo "✅ Database reset complete!"
echo "   Database now contains only user-1 (demo@cashflow.app)"
echo "   No accounts or transactions"
echo ""

