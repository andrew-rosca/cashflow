You are a **coding agent** continuing work on an existing project. Your goal is to make **incremental progress** on ONE feature per session while leaving the codebase in a clean, mergeable state.

see also: https://www.anthropic.com/engineering/claude-code-best-practices

## Session Start Protocol

Execute these steps in order:

1. `pwd` - Confirm your working directory
2. Read `docs/implementation-progress.txt` - Understand recent work
3. Read `docs/feature_list.json` - Identify incomplete features
4. `git log --oneline -20` - Review recent commits
5. Run `./init.sh` - Start the development environment
6. **Verify basic functionality works** before making changes

## Work Rules

### DO:
- Work on ONE feature at a time
- Operate in TDD fashion--write failing tests first, then write the code to add functionality and pass the tests
- Write and execute automated tests which exercise each feature end-to-end before marking complete
- Commit after each completed feature with descriptive messages, but only if the user hasn't requested to review changes before committing
   - you should ask them what they prefer in the beginning of the session
- When committing, make separate logical commits, grouping related changes together; don't mix concerns in the same commit 
- Update `docs/implementation-progress.txt` with what you did
- Leave code in a clean, working state
- Only mark a feature as `"passes": true` after full verification
- do not attempt to start a development local server yourself if the user has already started one
- use ephemeral (in memory or temp files) data for automated testing; do not pollute local databases or files with test data
- follow additional best practices (see below)

### DO NOT:
- Attempt to complete the entire project in one session
- Mark features complete without automated tests present and passing
- Leave half-implemented features uncommitted
- Remove or modify feature definitions in `docs/feature_list.json` (only change `passes` field)
- Skip the verification step at session start

## Session End Protocol

Before ending your session:

1. Ensure all code changes are committed
2. Verify the app still works (run basic end-to-end test)
3. Update `docs/implementation-progress.txt` with:
   - What you worked on
   - What was completed
   - Any issues encountered
   - Recommended next steps
4. Final commit: "Session end: [summary of progress]"

## Feature Verification

A feature is ONLY complete when:
- The implementation is finished
- You have tested it as a user would (not just unit tests)
- Edge cases are handled
- No regressions in existing functionality
- Code is clean and documented


### Additional Best Practices

## API First Design
All functionality should be expressed in the API. Clients, such as web or mobile apps, must not implement any business logic directly, so that they are fungible. Always implement functionality at the API layer, and only after in the client. Always follow TDD practices for this API functionality.


## Database Patterns

### Database Client Singleton with Dynamic Configuration
- **Pattern**: Use a proxy or factory pattern to lazily create database client instances that respect connection string changes
- **Rationale**: 
  - In test mode, different tests may use different databases (different connection strings)
  - The proxy/factory ensures we always get a client for the current connection string
  - Prevents stale client instances from being reused across test runs
- **Implementation Details**:
  - Check if connection string changed and disconnect old client
  - In test mode, always check connection string (more aggressive)
  - In production/dev, use caching for performance
  - Never initialize global client at module load time
- **Best Practices**:
  - Create client on-demand, not at module load
  - Always check connection string before returning cached client
  - Disconnect old clients when connection string changes
  - Use environment variables to detect test mode

### Test Database Isolation
- **Pattern**: Each test run gets a unique temporary database instance
- **Implementation**:
  - Create database in temporary location with unique identifier (timestamp + random)
  - Database is deleted in test cleanup hook
  - Use schema initialization command to set up structure
- **Rationale**: Ensures test isolation - no test data pollution between runs
- **Best Practices**:
  - Use OS temporary directory for test databases
  - Include timestamp and random component in database name
  - Always clean up test databases in `afterAll` or equivalent cleanup hook
  - Use separate connection string for each test run

### Data Adapter Pattern for Testability
- **Pattern**: All database access goes through an abstract adapter interface
- **Benefits**:
  - Can swap implementations (different ORMs, databases, in-memory) without changing business logic
  - Easy to create mock adapters for testing
  - Tests can inject adapter instances with test databases
- **Best Practices**:
  - Tests create adapter instances with test database client
  - Production uses singleton adapter from factory
  - In test mode, adapter factory creates fresh instances to avoid caching issues
  - All adapter methods accept user ID parameter for data isolation

## Testing Patterns

### Test Server Pattern for E2E Tests
- **Pattern**: Start actual application server for end-to-end tests
- **Implementation**:
  - Spawn application server process on random port
  - Set test mode environment variable
  - Wait for server to be ready before tests run
  - Clean up server process in test cleanup
- **Benefits**:
  - Tests run against real server (not mocks)
  - Tests actual API routes, middleware, and authentication flow
  - More confidence that production code works
- **Best Practices**:
  - Use port numbers matching the test worker instance ID to avoid conflicts
  - Set test mode flag so server knows it's in test environment
  - Wait for health check or ready signal before running tests
  - Always clean up server process, even if tests fail

### Ephemeral Test Data
- **Pattern**: Tests use temporary databases/files that are cleaned up automatically
- **Implementation**:
  - Unit tests: Temporary database files in OS temp directory
  - E2E tests: Test server uses separate database
  - All test data deleted after test run
- **Rationale**: Prevents test data pollution, ensures test isolation
- **Best Practices**:
  - Create unique database per test run (timestamp + random)
  - Always clean up in `afterAll` or equivalent hook
  - Use separate connection string for test database
  - Don't rely on test data persisting between runs

### Test User Pattern
- **Pattern**: Tests create dedicated test users with predictable IDs
- **Implementation**:
  - Each test suite creates its own test user (e.g., `'test-user-accounts'`)
  - Use upsert operation to create user in test setup
  - Test user ID is constant within test suite
- **Benefits**:
  - Tests are isolated (each suite has its own user)
  - Tests can clean up by deleting all data for test user
  - Predictable test data
- **Best Practices**:
  - Use descriptive test user IDs (include test suite name)
  - Create test user in `beforeAll` or test setup
  - Clean up test user data in `afterAll` or test teardown

### Test Setup Synchronization
- **Pattern**: Database schema setup and client generation must happen synchronously at test setup
- **Critical Details**:
  - Schema setup runs BEFORE any test files are imported
  - Database client generation runs BEFORE any module imports database client
  - Use synchronous execution (not async) to ensure ordering
  - Suppress output but allow errors to surface
- **Rationale**: Module imports are synchronous. If database client isn't generated yet, imports will fail.
- **Best Practices**:
  - Run schema setup in test configuration file (before tests load)
  - Generate database client before any test imports
  - Handle errors gracefully but fail fast if setup fails
  - Document setup order requirements

## Build and Deployment Patterns

### Automatic Migration Deployment
- **Pattern**: Database migrations run automatically during deployment for production databases
- **Implementation**:
  - Deployment script detects database type from connection string
  - If production database type, runs migration deployment
  - If development database type, skips migrations (uses schema push locally)
- **Rationale**: Ensures production database is always up-to-date without manual steps
- **Best Practices**:
  - Detect database type from connection string or environment
  - Only run migrations for production database types
  - Use schema push for local development (faster, no migration files needed)
  - Fail build if migrations fail (don't deploy broken schema)

### Environment-Based Schema Selection
- **Pattern**: Build process automatically selects correct schema based on environment
- **Implementation**: Schema selection script runs before any database operations
- **Best Practices**:
  - Always run schema selection before database client generation
  - Build script handles this automatically
  - Manual commands should also run schema selection first
  - Use connection string or environment variable to determine schema

## Security Patterns

### User Data Isolation
- **Pattern**: All data access methods require user ID parameter
- **Implementation**: Every data access method filters by user ID
- **Example**: `getAccounts(userId: string)` only returns accounts for that user
- **Rationale**: Prevents users from accessing other users' data even if they guess resource IDs
- **Best Practices**:
  - Always pass user ID to data access methods
  - Never trust client-provided user ID (get from session)
  - Filter all queries by user ID
  - Test that users cannot access other users' data

### Test Mode Authentication Bypass
- **Pattern**: Authentication is bypassed in test mode via environment variable
- **Implementation**:
  - Authentication helper returns test user ID if test mode is enabled
  - Middleware/guards allow all requests in test mode
- **Rationale**: Allows tests to run without complex session setup while maintaining security in production
- **Best Practices**:
  - Only bypass authentication when test mode environment variable is set
  - Use separate test mode flag (don't rely solely on NODE_ENV)
  - Never allow test mode in production
  - Document test mode behavior clearly

## Error Handling Patterns

### Graceful Degradation in Components
- **Pattern**: Components handle API errors gracefully with user-friendly messages
- **Implementation**: 
  - Try-catch around API calls
  - Display error messages in UI
  - Don't crash entire app on single API failure
- **Best Practices**:
  - Show user-friendly error messages (not technical details)
  - Allow user to retry failed operations
  - Keep UI functional even when some operations fail
  - Log technical details server-side for debugging

### Validation Before API Calls
- **Pattern**: Validate input client-side before making API request
- **Benefits**:
  - Faster feedback (no network round-trip)
  - Better UX (immediate error messages)
  - Reduces server load
- **Implementation**: Form validation in components before API calls
- **Best Practices**:
  - Validate required fields, formats, ranges
  - Show validation errors immediately
  - Still validate server-side (client validation can be bypassed)
  - Clear validation errors when user starts correcting input