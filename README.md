# CashFlow

A personal cash flow projection app that helps you see your account balances weeks or months ahead.

**Live at:** [https://cashflow.brasslogic.money](https://cashflow.brasslogic.money)

![CashFlow Screenshot](./public/landing-screenshot.png)

## What It Does

CashFlow helps you project your account balances into the future by:
- **Tracking Accounts**: Set initial balances and track multiple accounts
- **Recurring Transactions**: Set up recurring income and expenses (paychecks, rent, bills, etc.)
- **Projections**: See balance trends over time based on recurring transactions
- **Early Warnings**: Get alerted when balances are projected to go negative

To reseed the database at any time, run:
```bash
npm run db:seed
```

## Architecture

### Stack
- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (local dev/tests) + PostgreSQL (production) via Prisma ORM
- **Auth**: NextAuth.js with PrismaAdapter (Google and Apple Sign-In configured)
- **Deployment**: Vercel-ready with PostgreSQL

### Key Design Decisions

1. **Data Adapter Pattern**: All data access goes through the `DataAdapter` interface, making it easy to swap storage backends (see `src/lib/data-adapter.ts`)

2. **Double-Entry Model**: Every transaction has a source and destination account, enabling accurate tracking and future reporting capabilities

3. **API-First**: All functionality exposed via REST API, making it easy to add mobile clients or third-party integrations

4. **Projection Engine**: Materializes recurring transactions and calculates daily balances for future account projections

## Project Structure

```
├── docs/
│   ├── specification.md           # Project requirements
│   ├── feature_list.json          # All features to implement
│   ├── implementation-progress.txt # Development log
│   ├── coder-instructions.md       # Guidelines for coding sessions
│   ├── initializer-instructions.md # Setup guidelines
│   ├── postgresql-deployment-guide.md # Production deployment guide
│   ├── migrations-guide.md        # Database migrations guide
│   └── google-oauth-setup.md       # OAuth configuration guide
├── prisma/
│   ├── schema.prisma              # Active schema (auto-switched based on DATABASE_URL)
│   ├── schema.sqlite.prisma       # SQLite schema (for local dev and tests)
│   ├── schema.postgres.prisma     # PostgreSQL schema (for production)
│   └── migrations/                # Prisma migrations (PostgreSQL only)
├── scripts/
│   ├── switch-schema.js            # Automatic schema switching script
│   ├── migrate.js                  # Migration runner script
│   ├── create-migration.js         # Migration creation helper
│   └── seed-user.js                # User seeding utility
├── src/
│   ├── app/                        # Next.js app directory
│   │   ├── api/                    # API routes
│   │   │   ├── accounts/            # Account CRUD endpoints
│   │   │   ├── transactions/       # Transaction CRUD endpoints
│   │   │   ├── projections/        # Projection calculation endpoint
│   │   │   └── user/               # User settings endpoints
│   │   ├── login/                  # Landing/login page
│   │   └── page.tsx                 # Main dashboard
│   ├── lib/
│   │   ├── data-adapter.ts         # Data adapter interface
│   │   ├── prisma-adapter.ts       # Prisma implementation
│   │   ├── logical-date.ts         # Date handling utilities
│   │   └── auth.ts                 # NextAuth configuration
│   └── components/                 # React components
└── tests/
    ├── api/                        # API endpoint tests
    ├── features/                   # Feature integration tests
    ├── ui/                         # UI component tests
    └── e2e/                        # End-to-end tests (Playwright)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL (for production) or SQLite (for local dev)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd cashflow
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**:
   ```bash
   # For local development (SQLite)
   npm run db:push
   npm run db:generate
   
   # Or use the init script
   ./init.sh
   ```

5. **Seed the database** (optional):
   ```bash
   npm run db:seed
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

## Database Migrations

This project uses Prisma migrations for production (PostgreSQL) and `db push` for local development (SQLite).

### Local Development

```bash
# Apply schema changes (SQLite - uses db push)
npm run db:push
```

### Production

```bash
# Deploy migrations (PostgreSQL)
npm run db:migrate:deploy
```

### Creating New Migrations

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Create a new migration
npm run db:migrate:create add_feature_name
```

See [docs/migrations-guide.md](./docs/migrations-guide.md) for detailed migration instructions.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run unit/integration tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run db:push` - Apply schema changes to local database
- `npm run db:migrate:deploy` - Deploy migrations to production
- `npm run db:migrate:create <name>` - Create a new migration
- `npm run db:generate` - Generate Prisma Client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## Testing

- **Unit/Integration Tests**: `npm test` (Vitest)
- **E2E Tests**: `npm run test:e2e` (Playwright)
- **Test Coverage**: Tests run automatically on push via GitHub Actions

## Deployment

See [docs/postgresql-deployment-guide.md](./docs/postgresql-deployment-guide.md) for detailed deployment instructions.

Quick steps:
1. Set up PostgreSQL database (Supabase, Vercel Postgres, etc.)
2. Configure environment variables in Vercel
3. Deploy to Vercel
4. Run migrations: `npm run db:migrate:deploy`

## License

MIT
