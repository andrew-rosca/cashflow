# CashFlow Application Specification

## Overview

**CashFlow** is an open source personal finance application that helps users project future account balances based on expected inflows and outflows. The primary goal is to ensure users never run out of money by visualizing when balances might approach or drop below zero.

**Platforms:** Web app (initial), mobile app (future)

---

## Core Concepts

### Double-Entry Model
Every transaction has two sides: a source and a destination. Money always comes from somewhere and goes somewhere.

| From | To | Common Name |
|------|----|-------------|
| External (Income) | Tracked Account | Inflow |
| Tracked Account | External (Expense) | Outflow |
| Tracked Account | Tracked Account | Transfer |

### Accounts
Two categories:
- **Tracked accounts**: Real accounts the user monitors (checking, savings, etc.)
- **External accounts**: Categories representing the outside world (Salary, Rent, Groceries, etc.)

Users primarily care about tracked account balances. External accounts are optional labels for where money comes from or goes to.

Future: Tracked accounts will sync with real banks via Plaid or similar services.

### Transactions
Every transaction:
- Debits one account (money leaves)
- Credits another account (money arrives)
- Has an amount
- Has a date (explicit or calculated from recurrence)
- Optionally recurs on a pattern

For transfers between tracked accounts, settlement lag (days between debit and credit) can be specified.

### Recurrence Patterns
Support flexible scheduling:
- Monthly on specific day (e.g., "15th of each month")
- Weekly on specific day (e.g., "every Wednesday")
- Bi-weekly starting from date (e.g., "every 2 weeks starting Jan 1")
- N occurrences (e.g., "10 times, weekly")
- Indefinite (no end date)

---

## Technical Architecture

### Principles
1. **API-first**: All functionality exposed via API; UI is just one client
2. **Platform-agnostic**: No assumptions about client type (web, mobile, CLI, third-party)
3. **Pluggable storage**: Data layer abstracted via adapter pattern
4. **Pluggable integrations**: Architecture prepared for Plaid-style sync services

### Stack Recommendations
- Modern, simple frameworks
- Deployment-friendly (Vercel, Supabase, or similar)
- Minimal infrastructure overhead
- No complex account setup required

### Authentication
- Apple Sign-In
- Google Sign-In

### Data Layer
- Implement via **Data Adapter** interface
- Reference implementation: relational DB or document store
- Data volume per user is small (transactions, recurrence rules, accounts)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Clients   │────▶│     API     │────▶│ Data Adapter │
│ (Web, etc.) │     │   Layer     │     │  (Pluggable) │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │ Integration │
                    │   Adapter   │
                    │  (Future)   │
                    └─────────────┘
```

---

## Data Model

### Account
```
id: string
user_id: string
name: string
type: "tracked" | "external"
category?: string              // For external: "income", "expense", etc.
initial_balance?: number       // For tracked accounts
external_id?: string           // For future Plaid integration
```

### Transaction
```
id: string
user_id: string
amount: number
from_account_id: string        // Debited account
to_account_id: string          // Credited account
date: date                     // For one-time; start date for recurring
recurrence?: RecurrencePattern // Null for one-time
settlement_days?: number       // Lag for transfers between tracked accounts
description?: string
```

### RecurrencePattern
```
frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly"
interval?: number              // e.g., every 2 weeks
day_of_week?: number           // 0-6
day_of_month?: number          // 1-31
end_date?: date
occurrences?: number           // If limited count
```

---

## API Endpoints

### Accounts
- `GET /accounts` — List accounts (filterable by type: tracked, external)
- `POST /accounts` — Create account
- `PUT /accounts/:id` — Update account
- `DELETE /accounts/:id` — Delete account

### Transactions
- `GET /transactions` — List transactions (filterable by account, date range, recurring)
- `POST /transactions` — Create transaction
- `PUT /transactions/:id` — Update transaction
- `DELETE /transactions/:id` — Delete transaction

### Projections
- `GET /projections` — Get projected balances for tracked accounts
  - Query params: `account_id` (optional), `start_date`, `end_date`
  - Returns: daily balance projections, dates where balance ≤ 0

---

## User Interface

### Design Philosophy
The interface is designed to feel like working with a spreadsheet: frictionless, direct manipulation of data, with minimal modals or navigation. Most values are editable inline by clicking on them, providing immediate feedback and eliminating unnecessary clicks.

### Main Screen Components

**Layout**: Two-column layout with sidebar and main content area.

#### Left Sidebar

**1. Current Balances Section**
- Displays all tracked accounts with their balance as of a specific date
- Each account shows: name, balance date, and balance amount
- **Interactions**:
  - Click account name → Opens dialog to rename or delete account
  - Click balance date → Inline edit the date
  - Click balance amount → Inline edit the amount
  - Plus button (+) → Instantly creates new account
- Negative balances display in red
- All amounts display without currency symbols (e.g., `2500.00` not `$2,500.00`)

**2. Upcoming Transactions Section**
- Displays all future transactions in chronological order
- Each transaction shows date, description, and amount on a single line
- Recurring transactions marked with circular arrow icon (↻)

**One-time transactions:**
- **Interactions**:
  - Click date → Inline edit the date
  - Click description → Inline edit the description
  - Click amount → Inline edit the amount
  - All inline edits save on blur or Enter key; ESC cancels

**Recurring transactions:**
- **Interactions**:
  - Click icon, date, description, or amount → Opens dialog to edit full transaction including recurrence pattern

**Add Transaction:**
- Plus button (+) → Opens dialog with:
  - Required: date, amount
  - Optional: description, account selection
  - Checkbox: "Make this recurring"
    - When checked, expands to show frequency, end date options

#### Right Content Area

**3. Balance Projection Table**
- Rows: dates (shows projection timeline)
- Columns: tracked accounts
- Cells: projected balance for each account on each date
- Negative balances highlighted in red
- All amounts without currency symbols
- Updates dynamically as accounts/transactions change

### Visual Design Principles
- **Spreadsheet-like UX**: Direct manipulation, inline editing
- **Minimal chrome**: No page title, clean layout, focus on data
- **Hover feedback**: Subtle background change on editable elements
- **Active state**: Blue border on focused input fields
- **Color coding**: Red for negative amounts, consistent throughout
- **No currency symbols**: Display raw numbers for cleaner, more spreadsheet-like appearance
- **Single-line layout**: Transactions show all info (date, description, amount) in one compact row

### Dialogs

**Account Management Dialog**
- Triggered by clicking account name
- Contains: account name field, delete button, cancel button
- Changes persist on Enter or when dialog closes

**Transaction Dialog** (Add/Edit)
- Triggered by plus button or clicking recurring transaction
- Required fields: date, amount
- Optional fields: description
- Account dropdown: select from tracked accounts
- "Make this recurring" checkbox
  - Expands to show: frequency dropdown (daily, weekly, bi-weekly, monthly, yearly), optional end date
- Buttons: Cancel, Save/Add

**Dialog Behavior**
- Modal overlay (dark backdrop)
- Centered on screen
- Click outside or Cancel to close without saving
- Enter key or Save/Add button to submit

### User Flows

**Editing a balance:**
1. Click on amount → Input appears
2. Type new value
3. Press Enter or click away → Saved

**Adding an account:**
1. Click + button in Current Balances
2. New account appears instantly with default values
3. Click account name to rename

**Editing a one-time transaction:**
1. Click on date, description, or amount
2. Inline input appears
3. Edit value, press Enter → Saved

**Editing a recurring transaction:**
1. Click anywhere on transaction (icon, date, description, amount)
2. Dialog opens with all fields
3. Edit values including recurrence pattern
4. Click Save → Changes persist

**Adding a transaction:**
1. Click + button in Upcoming Transactions
2. Dialog opens
3. Fill required fields (date, amount)
4. Optionally check "Make this recurring"
5. Click Add → Transaction created

---

## Legacy UI Documentation (for reference)

### Previous Main Screen Components

1. **Transaction Lists** (separated views)
   - One-time transactions
   - Recurring transactions
   - Shows from/to accounts for each
   - Add/edit/delete from each view

2. **Upcoming Calendar Panel**
   - Next 30-60 days of expected transactions
   - Materialized from one-time dates + recurring patterns
   - Highlights dates where balance drops below zero

3. **Balance Projection Graph**
   - Visual timeline of account balance
   - Clear indication of danger zones (approaching/below zero)

4. **Account Filter**
   - Filter by tracked account(s)
   - Shows transactions affecting selected account(s)
   - All tracked accounts or specific selection

### Account Management
- Dedicated screen for managing accounts
- **Tracked accounts**: Bank accounts, credit cards, etc. — these are what projections monitor
- **External accounts**: Income sources and expense categories — optional labels for organization
- **Inline creation**: When adding a transaction, user can create new accounts on the fly
- First-time users shouldn't need to set up accounts before entering transactions

### UX Goals
- Intuitive visualization of future cash position
- Easy identification of problem dates
- Quick transaction entry — double-entry complexity hidden from user
- Simple from/to selection; infer account types automatically
- Clear separation of one-time vs recurring

---

## Future Considerations

### Plaid Integration
- Architecture supports pluggable integration adapters
- Auto-sync account balances
- Auto-import transactions (map to from/to accounts)
- Map CashFlow tracked accounts to real bank accounts

### Mobile App
- Same API, native mobile client
- Consider offline-first with sync

### Double-Entry Benefits (enabled by this architecture)
- Income/expense reporting by external account
- Cash flow statements
- Net worth tracking across all tracked accounts
- Budget tracking against external expense accounts

### Additional Features (not in v1)
- Multiple currencies
- Shared accounts/households
- Reconciliation with imported transactions