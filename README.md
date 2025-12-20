# CashFlow

A personal finance application that helps you project future account balances based on expected inflows and outflows.

## Quick Start

1. Copy `.env.example` to `.env` and configure your database URL
2. Run `./init.sh` to install dependencies and start the development server
3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture

### Stack
- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Apple/Google Sign-In - to be configured)
- **Deployment**: Vercel-ready

### Key Design Decisions

1. **Data Adapter Pattern**: All data access goes through the `DataAdapter` interface, making it easy to swap storage backends (see `src/lib/data-adapter.ts`)

2. **Double-Entry Model**: Every transaction has a source and destination account, enabling accurate tracking and future reporting capabilities

3. **API-First**: All functionality exposed via REST API, making it easy to add mobile clients or third-party integrations

4. **Projection Engine**: Materializes recurring transactions and calculates daily balances (to be implemented)

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── accounts/
│   │   │   ├── transactions/
│   │   │   └── projections/
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   └── lib/
│       ├── db.ts             # Prisma client
│       ├── data-adapter.ts   # Data adapter interface
│       └── prisma-adapter.ts # Prisma implementation
├── feature_list.json         # All features to implement
├── implementation-progress.txt       # Development log
└── init.sh                   # Setup script
```

## Development Workflow

1. Run `./init.sh` to start the development environment
2. Check `feature_list.json` for the next feature to implement
3. Test features end-to-end before marking them complete
4. Update `implementation-progress.txt` with progress and decisions
5. Commit completed features with clear messages

## Features

See `feature_list.json` for the complete feature list and implementation status.

## API Endpoints

### Accounts
- `GET /api/accounts` - List accounts (filter by type: tracked/external)
- `POST /api/accounts` - Create account
- `GET /api/accounts/:id` - Get account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Transactions
- `GET /api/transactions` - List transactions (filter by account, date range, recurring)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Projections
- `GET /api/projections` - Get projected balances (query: accountId, startDate, endDate)

## License

MIT
