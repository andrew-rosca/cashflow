# End-to-End Testing

This directory contains end-to-end (E2E) tests using Playwright.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug

# Run tests in headed mode (see the browser)
npm run test:e2e:headed

# Run a specific test file
npm run test:e2e -- tests/e2e/workflows/simple-balance-projection.spec.ts
```

## Viewing Traces

Playwright automatically records traces for all test runs. To view them:

### Option 1: Use the npm script (easiest)
```bash
npm run test:e2e:trace
```

This will automatically open the most recent trace in the Playwright trace viewer.

### Option 2: Manual command
```bash
# Find the latest trace
find test-results -name 'trace.zip' -type f -exec ls -t {} + | head -1

# Open a specific trace
npx playwright show-trace test-results/workflows-simple-balance-p-704b1-t-balance-after-transaction-chromium/trace.zip
```

### Option 3: View all traces
```bash
# List all available traces
ls -lt test-results/*/trace.zip

# Open the HTML report (shows all test runs)
npx playwright show-report
```

## Trace Location

Traces are stored in:
- `test-results/<test-name>-<hash>/trace.zip` - Individual test traces
- `playwright-report/` - HTML report with all test runs

## What's in a Trace?

Each trace contains:
- **Timeline** - Step-by-step execution of the test
- **Screenshots** - Visual state at each step
- **Network requests** - All API calls and responses
- **Console logs** - Browser console output
- **DOM snapshots** - Page state at each step
- **Video** - Full video recording of the test (if enabled)

## Test Structure

- `fixtures/` - Custom Playwright fixtures (test server, database setup)
- `workflows/` - End-to-end workflow tests
- `utils/` - Helper utilities for tests

## Test Server

Each test runs with:
- A fresh, blank SQLite database (ephemeral)
- A dedicated Next.js server instance
- Clock mocking for deterministic date handling
- Automatic cleanup after test completion

See `fixtures/test-server.ts` for details.
