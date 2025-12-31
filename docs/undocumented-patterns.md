# Undocumented Best Practices and Patterns

This document captures coding patterns, best practices, and architectural decisions that are present in the codebase but not yet documented in the instruction files. These should eventually be integrated into `coder-instructions.md` and `initializer-instructions.md`.

## Date Handling Patterns

### LogicalDate Abstraction
- **Pattern**: Use `LogicalDate` class instead of JavaScript `Date` objects for all financial dates
- **Location**: `src/lib/logical-date.ts`
- **Rationale**: Financial transactions are calendar dates without time components. Using `Date` objects introduces timezone bugs and time-of-day confusion.
- **Best Practices**:
  - Always use `LogicalDate.fromString()` to parse date strings (YYYY-MM-DD format)
  - Use `LogicalDate.today()` for server-side date comparisons (uses UTC)
  - Use `today()` helper function (from logical-date.ts) for UI defaults (uses local timezone)
  - Never pass `Date` objects to `LogicalDate.parse()` - it will throw an error to force proper refactoring
  - Convert `LogicalDate` to strings using `.toString()` for API responses
  - Use Temporal.PlainDate internally (via `@js-temporal/polyfill`) for date arithmetic

### UTC Consistency
- **Pattern**: All date parsing and storage uses UTC methods to avoid timezone conversion bugs
- **Implementation**: 
  - API routes use `Date.UTC()` when parsing date strings
  - DateInput component uses `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` methods
  - Database stores dates as strings (YYYY-MM-DD) without timezone
- **Rationale**: Prevents dates from shifting when crossing timezone boundaries (e.g., 2025-01-01 becoming 2024-12-31)

### React State Race Conditions with Dates
- **Pattern**: Use `useRef` to store latest date values immediately when handling date changes
- **Location**: `src/app/page.tsx` - `dateValueRef` pattern
- **Rationale**: React state updates are asynchronous. When `handleCellBlur` fires, `editValue` state may not have updated yet. Using a ref ensures the latest value is always available.
- **Example**:
  ```typescript
  const dateValueRef = useRef<Record<string, string>>({})
  
  const handleDateChange = (value: string) => {
    dateValueRef.current[cellId] = value // Store immediately
    setEditValue(value) // Update state (async)
  }
  
  const handleCellBlur = () => {
    const value = dateValueRef.current[cellId] || editValue // Use ref if available
    // ... save logic
  }
  ```

## Database Patterns

### Prisma Client Singleton with Proxy Pattern
- **Pattern**: Use a Proxy to lazily create PrismaClient instances that respect DATABASE_URL changes
- **Location**: `src/lib/db.ts`
- **Rationale**: 
  - In test mode, different tests may use different databases (different DATABASE_URL)
  - The Proxy ensures we always get a client for the current DATABASE_URL
  - Prevents stale client instances from being reused across test runs
- **Implementation Details**:
  - Checks if `DATABASE_URL` changed and disconnects old client
  - In test mode, always checks DATABASE_URL (more aggressive)
  - In production/dev, uses caching for performance
  - Never initializes global client at module load time

### Test Database Isolation
- **Pattern**: Each test run gets a unique temporary database file
- **Location**: `vitest.setup.ts`
- **Implementation**:
  - Creates database in OS temp directory: `cashflow-test-{timestamp}-{random}.db`
  - Database is deleted in `afterAll` hook
  - Uses `prisma db push --force-reset` to initialize schema
- **Rationale**: Ensures test isolation - no test data pollution between runs

### Schema Switching for Multi-Database Support
- **Pattern**: Automatically switch between SQLite and PostgreSQL schemas based on `DATABASE_URL`
- **Location**: `scripts/switch-schema.js`
- **Implementation**:
  - Detects `postgresql://` or `postgres://` prefix → uses `schema.postgres.prisma`
  - Otherwise → uses `schema.sqlite.prisma`
  - Copies appropriate schema to `schema.prisma` before Prisma operations
- **Best Practices**:
  - Always run schema switching before `prisma generate` or `prisma db push`
  - Build script automatically switches schema based on environment
  - Tests always use SQLite (faster, no server required)

### Data Adapter Pattern for Testability
- **Pattern**: All database access goes through `DataAdapter` interface
- **Location**: `src/lib/data-adapter.ts` (interface), `src/lib/prisma-adapter.ts` (implementation)
- **Benefits**:
  - Can swap implementations (Prisma, MongoDB, in-memory) without changing business logic
  - Easy to create mock adapters for testing
  - Tests can inject adapter instances with test databases
- **Best Practices**:
  - Tests create `new PrismaDataAdapter(prisma)` with test database client
  - Production uses singleton `dataAdapter` from `prisma-adapter.ts`
  - In test mode, adapter factory creates fresh instances to avoid caching issues

## API Route Patterns

### Consistent Error Handling
- **Pattern**: All API routes use try-catch with consistent error responses
- **Structure**:
  ```typescript
  export async function GET(request: NextRequest) {
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      // ... logic
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error description:', error)
      return NextResponse.json({ error: 'User-friendly message' }, { status: 500 })
    }
  }
  ```
- **Best Practices**:
  - Always check authentication first
  - Return appropriate HTTP status codes (400, 401, 404, 500)
  - Log errors server-side but return user-friendly messages
  - Use consistent error response format: `{ error: string }`

### Date Conversion in API Routes
- **Pattern**: Convert between `LogicalDate` objects (internal) and date strings (API)
- **Implementation**:
  - Request bodies: Convert date strings to `LogicalDate` using `LogicalDate.fromString()`
  - Response bodies: Convert `LogicalDate` to strings using `.toString()`
  - Query parameters: Parse date strings from `searchParams.get()`
- **Example**:
  ```typescript
  // Request: body.date is "2025-01-15" (string)
  body.date = LogicalDate.fromString(body.date)
  
  // Response: transaction.date is LogicalDate
  return NextResponse.json({
    ...transaction,
    date: transaction.date.toString() // Convert to "2025-01-15"
  })
  ```

### Cache Control Headers
- **Pattern**: Use explicit cache control headers for dynamic data
- **Location**: `src/app/api/projections/route.ts`
- **Implementation**:
  ```typescript
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
  ```
- **Rationale**: Projections are computed data that changes when transactions change. Must never be cached.

### Authentication Helper Pattern
- **Pattern**: Use `getCurrentUserId()` helper in all API routes
- **Location**: `src/lib/auth.ts`
- **Behavior**:
  - Returns user ID from session in production
  - Returns `'user-1'` in test mode (allows tests to work without session setup)
  - Returns `null` if unauthenticated
- **Best Practices**:
  - Always call `getCurrentUserId()` at start of API route
  - Return 401 immediately if `null`
  - Pass `userId` to all data adapter methods (enforces data isolation)

## Testing Patterns

### Test Server Pattern for E2E Tests
- **Pattern**: Start actual Next.js dev server for end-to-end tests
- **Location**: `tests/e2e/fixtures/test-server.ts`
- **Implementation**:
  - Spawns `next dev` process on random port
  - Sets `TEST_MODE=true` environment variable
  - Waits for server to be ready before tests run
  - Cleans up server process in `afterAll`
- **Benefits**:
  - Tests run against real Next.js server (not mocks)
  - Tests actual API routes, middleware, and authentication flow
  - More confidence that production code works

### Ephemeral Test Data
- **Pattern**: Tests use temporary databases/files that are cleaned up automatically
- **Implementation**:
  - Unit tests: Temporary SQLite files in OS temp directory
  - E2E tests: Test server uses separate database
  - All test data deleted after test run
- **Rationale**: Prevents test data pollution, ensures test isolation

### Test User Pattern
- **Pattern**: Tests create dedicated test users with predictable IDs
- **Implementation**:
  - Each test suite creates its own test user (e.g., `'test-user-accounts'`)
  - Uses `prisma.user.upsert()` to create user in `beforeAll`
  - Test user ID is constant within test suite
- **Benefits**:
  - Tests are isolated (each suite has its own user)
  - Tests can clean up by deleting all data for test user
  - Predictable test data

### Vitest Setup Synchronization
- **Pattern**: Schema switching and Prisma generation must happen synchronously at module load
- **Location**: `vitest.setup.ts`
- **Critical Details**:
  - Schema switching runs BEFORE any test files are imported
  - Prisma Client generation runs BEFORE any module imports `PrismaClient`
  - Uses `execSync()` (not async) to ensure ordering
  - Suppresses output with `stdio: 'pipe'` but allows errors
- **Rationale**: Module imports are synchronous. If Prisma Client isn't generated yet, imports will fail.

## Component Patterns

### Inline Editing Pattern
- **Pattern**: Click-to-edit cells with immediate save on blur/Enter
- **Location**: `src/app/page.tsx`
- **Implementation**:
  - `editingCell` state tracks which cell is being edited
  - `editValue` state holds current edit value
  - Click handler sets both states
  - Blur handler saves and clears editing state
  - ESC key cancels edit
- **Best Practices**:
  - Use refs for values that need immediate access (dates)
  - Clear editing state on successful save
  - Show visual feedback (blue border) when editing

### Dialog State Management
- **Pattern**: Separate state for each dialog type with associated selected item
- **Example**:
  ```typescript
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  ```
- **Best Practices**:
  - Open dialog and set selected item in same handler
  - Clear selected item when closing dialog
  - Use selected item ID to determine if creating (null) or editing (has ID)

### Tooltip Positioning Pattern
- **Pattern**: Calculate tooltip position dynamically based on viewport bounds
- **Location**: `src/components/Tooltip.tsx`
- **Implementation**:
  - Uses `getBoundingClientRect()` to get element positions
  - Calculates position on mount and on scroll/resize
  - Falls back to showing below if not enough space above
  - Keeps tooltip within viewport bounds (8px padding)
- **Best Practices**:
  - Use `requestAnimationFrame` to ensure tooltip is rendered before calculating position
  - Listen to scroll and resize events to update position
  - Clean up event listeners in `useEffect` return

## Type Safety Patterns

### Type Definitions Co-located with Usage
- **Pattern**: Define interfaces near where they're used (not in separate types file)
- **Location**: Component files define their own interfaces
- **Example**: `src/app/page.tsx` defines `Account`, `Transaction`, `ProjectionData` interfaces
- **Rationale**: 
  - Types are only used in one place
  - Easier to understand component's data needs
  - Reduces import complexity

### Shared Types in Data Adapter
- **Pattern**: Core domain types defined in data adapter interface
- **Location**: `src/lib/data-adapter.ts`
- **Types**: `Account`, `Transaction`, `ProjectionData`, `RecurrencePattern`
- **Rationale**: These types are shared across API routes, components, and adapters

## Build and Deployment Patterns

### Automatic Migration Deployment
- **Pattern**: Migrations run automatically during build for PostgreSQL
- **Location**: `package.json` build script
- **Implementation**:
  ```json
  "build": "node scripts/switch-schema.js && npm run db:migrate:deploy:if-postgres && prisma generate && next build"
  ```
- **Behavior**:
  - Switches schema based on DATABASE_URL
  - If PostgreSQL, runs `prisma migrate deploy`
  - If SQLite, skips migrations (uses db push locally)
- **Rationale**: Ensures production database is always up-to-date without manual steps

### Environment-Based Schema Selection
- **Pattern**: Build process automatically selects correct schema
- **Implementation**: `switch-schema.js` runs before any Prisma command
- **Best Practices**:
  - Always run schema switching before `prisma generate`
  - Build script handles this automatically
  - Manual commands should also run switching first

## Code Organization Patterns

### API Route File Structure
- **Pattern**: One file per resource with nested routes for individual items
- **Structure**:
  ```
  src/app/api/
    accounts/
      route.ts          # GET /api/accounts, POST /api/accounts
      [id]/
        route.ts        # GET /api/accounts/:id, PUT, DELETE
    transactions/
      route.ts
      [id]/
        route.ts
  ```
- **Benefits**: Clear organization, easy to find route handlers

### Library File Organization
- **Pattern**: Core utilities in `src/lib/` with descriptive names
- **Structure**:
  - `data-adapter.ts` - Interface definition
  - `prisma-adapter.ts` - Prisma implementation
  - `logical-date.ts` - Date abstraction
  - `auth.ts` - Authentication helpers
  - `db.ts` - Prisma client singleton
- **Best Practices**: One concept per file, clear naming

## Security Patterns

### User Data Isolation
- **Pattern**: All data adapter methods require `userId` parameter
- **Implementation**: Every adapter method filters by `userId`
- **Example**: `getAccounts(userId: string)` only returns accounts for that user
- **Rationale**: Prevents users from accessing other users' data even if they guess IDs

### Test Mode Authentication Bypass
- **Pattern**: Authentication is bypassed in test mode via environment variable
- **Location**: `src/lib/auth.ts`, `src/middleware.ts`
- **Implementation**:
  - `getCurrentUserId()` returns `'user-1'` if `NODE_ENV === 'test'` or `TEST_MODE === 'true'`
  - Middleware allows all requests in test mode
- **Rationale**: Allows tests to run without complex session setup while maintaining security in production

## Performance Patterns

### Lazy Prisma Client Creation
- **Pattern**: Prisma client created on-demand, not at module load
- **Location**: `src/lib/db.ts` Proxy pattern
- **Benefits**: 
  - Faster module load time
  - Respects DATABASE_URL changes
  - Works correctly in test environments

### Projection Caching Strategy
- **Pattern**: Projections are NOT cached (computed on-demand)
- **Location**: `src/app/api/projections/route.ts`
- **Rationale**: 
  - Projections change whenever transactions change
  - User data is small (hundreds of transactions, not millions)
  - On-demand computation ensures accuracy
  - Cache headers prevent browser caching

## Error Handling Patterns

### Graceful Degradation in Components
- **Pattern**: Components handle API errors gracefully with user-friendly messages
- **Implementation**: 
  - Try-catch around API calls
  - Display error messages in UI
  - Don't crash entire app on single API failure
- **Example**: Failed account creation shows error message, form remains usable

### Validation Before API Calls
- **Pattern**: Validate input client-side before making API request
- **Benefits**:
  - Faster feedback (no network round-trip)
  - Better UX (immediate error messages)
  - Reduces server load
- **Implementation**: Form validation in components before `fetch()` calls

## Future Considerations

These patterns may need updates as the project evolves:

1. **Plaid Integration**: When adding bank sync, follow the Integration Adapter pattern (similar to Data Adapter)
2. **Mobile App**: API routes are already mobile-ready (JSON responses, no HTML assumptions)
3. **Offline Support**: May need to add caching layer for projections if mobile app goes offline-first
4. **Multi-User Features**: Current user isolation patterns will need extension for shared accounts
5. **Rate Limiting**: May need to add rate limiting to API routes as usage grows

