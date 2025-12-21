#!/bin/bash

set -e

echo "🚀 CashFlow Project Initialization"
echo "===================================="

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your database credentials"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Check if database is accessible and push schema
echo "🗄️  Setting up database..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Database schema pushed successfully"
else
    echo "⚠️  Database push failed. Make sure your DATABASE_URL in .env is correct."
    echo "   For local development, you can use PostgreSQL or SQLite."
    echo ""
    echo "   Example PostgreSQL setup:"
    echo "   1. Install PostgreSQL: brew install postgresql"
    echo "   2. Start PostgreSQL: brew services start postgresql"
    echo "   3. Create database: createdb cashflow"
    echo "   4. Update .env: DATABASE_URL=\"postgresql://$(whoami)@localhost:5432/cashflow\""
    echo ""
    echo "   Then run ./init.sh again"
    exit 1
fi

# Seed database with sample data
echo "🌱 Seeding database with sample data..."
npm run db:seed

# Start development server
echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Starting development server..."
echo "   Access the app at: http://localhost:3000"
echo "   API available at: http://localhost:3000/api"
echo ""
npm run dev
