import { PrismaClient } from '@prisma/client'
import { today } from '../src/lib/logical-date'

const prisma = new PrismaClient()

// Helper to convert dayOfMonth to database format
function dayOfMonthToDbValue(dayOfMonth: number): any {
  const dbUrl = process.env.DATABASE_URL || ''
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
  
  if (isPostgres) {
    // PostgreSQL: return as JSON array
    return [dayOfMonth]
  } else {
    // SQLite: return as JSON string
    return JSON.stringify([dayOfMonth])
  }
}

async function main() {
  // Check if we should seed only the user (no accounts/transactions)
  const seedUserOnly = process.argv.includes('--user-only') || process.env.SEED_USER_ONLY === 'true'

  if (seedUserOnly) {
    console.log('🌱 Seeding database with user only...')
  } else {
    console.log('🌱 Seeding database with sample data...')
  }

  // Get user ID from environment variable, or default to 'user-1' for demo
  const targetUserId = process.env.USER_ID || 'user-1'
  
  // Try to find existing user, or create demo user if USER_ID not specified
  let user
  if (targetUserId === 'user-1' && !process.env.USER_ID) {
    // Create/update demo user
    user = await prisma.user.upsert({
      where: { id: 'user-1' },
      update: {},
      create: {
        id: 'user-1',
        email: 'demo@cashflow.app',
        name: 'Demo User',
      },
    })
    console.log('✅ Using demo user:', user.email)
  } else {
    // Find the specified user
    user = await prisma.user.findUnique({
      where: { id: targetUserId },
    })
    
    if (!user) {
      console.error(`❌ User with ID "${targetUserId}" not found.`)
      console.error('   Please sign in first, or check your user ID.')
      console.error('   Run: tsx scripts/list-users.ts to see all users')
      process.exit(1)
    }
    console.log(`✅ Found user: ${user.email || user.name || targetUserId}`)
  }

  // If user-only mode, exit early
  if (seedUserOnly) {
    console.log('\n🎉 User seeding complete!')
    console.log('✨ User created: demo@cashflow.app')
    return
  }

  // Clear existing data for this user
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.cashFlowAccount.deleteMany({ where: { userId: user.id } })

  // Get today's date as LogicalDate and convert to string
  const todayDate = today()
  const todayString = todayDate.toString()

  // Helper function to get dates (returns string YYYY-MM-DD)
  const daysFromNow = (days: number) => {
    return todayDate.addDays(days).toString()
  }

  // Create accounts
  // Starting with a very low balance to ensure negative occurs
  const checkingAccount = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Main Checking',
      initialBalance: 200, // Very low starting balance
      balanceAsOf: todayString,
    },
  })

  const income = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Income',
      initialBalance: 0,
      balanceAsOf: todayString,
    },
  })

  const expenses = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Expenses',
      initialBalance: 0,
      balanceAsOf: todayString,
    },
  })

  console.log('✅ Created accounts: Main Checking, Income, Expenses')

  // RECURRING INCOME
  // 1. Bi-weekly paycheck - delay first one to create gap
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: income.id,
      toAccountId: checkingAccount.id,
      amount: 3200, // Bi-weekly salary
      description: 'Paycheck',
      date: daysFromNow(10), // First paycheck in 10 days (delayed)
      recurrence: {
        create: {
          frequency: 'weekly',
          interval: 2, // Every 2 weeks
        },
      },
    },
  })
  console.log('✅ Created recurring paycheck (every 2 weeks, $3,200)')

  // RECURRING EXPENSES
  // 2. Rent - monthly on the 1st (moved to occur after first paycheck)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -1950, // Negative for expense
      description: 'Rent',
      date: daysFromNow(11), // Rent due in 11 days (day after first paycheck on day 10)
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: dayOfMonthToDbValue(1),
        },
      },
    },
  })
  console.log('✅ Created recurring rent (monthly on 1st, $1,950)')

  // 3. Car payment - monthly on the 15th (pushed to mid-February)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -420,
      description: 'Car Payment',
      date: daysFromNow(47), // Car payment in 47 days (mid-February)
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: dayOfMonthToDbValue(15),
        },
      },
    },
  })
  console.log('✅ Created recurring car payment (monthly on 15th, $420)')

  // 4. Utilities - monthly on the 5th
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -180,
      description: 'Utilities',
      date: daysFromNow(5), // Utilities in 5 days
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: dayOfMonthToDbValue(5),
        },
      },
    },
  })
  console.log('✅ Created recurring utilities (monthly on 5th, $180)')

  // 5. Credit card payment - monthly on the 25th (pushed to late January)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -550,
      description: 'Credit Card Payment',
      date: daysFromNow(26), // Credit card payment in 26 days (late January)
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: dayOfMonthToDbValue(25),
        },
      },
    },
  })
  console.log('✅ Created recurring credit card payment (monthly on 25th, $550)')

  // 6. Groceries - weekly on Fridays (day 5 = Friday)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -120,
      description: 'Groceries',
      date: daysFromNow(5), // Next Friday
      recurrence: {
        create: {
          frequency: 'weekly',
          interval: 1,
          dayOfWeek: 5, // Friday
        },
      },
    },
  })
  console.log('✅ Created recurring groceries (weekly on Friday, $120)')

  // ONE-TIME TRANSACTIONS
  // 7. One-time expense - Insurance payment (moved to occur after first paycheck)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -650,
      description: 'Car Insurance (6 months)',
      date: daysFromNow(13), // Insurance in 13 days (after first paycheck on day 10)
    },
  })
  console.log('✅ Created one-time car insurance payment ($650)')

  // 8. One-time expense - Medical bill (moved to occur after first paycheck)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -280,
      description: 'Medical Bill',
      date: daysFromNow(15), // Medical bill in 15 days (after first paycheck on day 10)
    },
  })
  console.log('✅ Created one-time medical bill ($280)')
  
  // 9. Additional large expense to ensure negative balance
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: -800,
      description: 'Home Repair',
      date: daysFromNow(18), // Home repair in 18 days (after first paycheck, before next paycheck on day 24)
    },
  })
  console.log('✅ Created one-time home repair expense ($800)')

  console.log('\n🎉 Seeding complete!')
  console.log('📊 Created 3 accounts (Main Checking, Income, Expenses)')
  console.log('💰 Created 6 recurring transactions:')
  console.log('   - Paycheck (bi-weekly, $3,200)')
  console.log('   - Rent (monthly, $1,950)')
  console.log('   - Car Payment (monthly, $420)')
  console.log('   - Utilities (monthly, $180)')
  console.log('   - Credit Card (monthly, $550)')
  console.log('   - Groceries (weekly, $120)')
  console.log('💸 Created 3 one-time transactions:')
  console.log('   - Car Insurance ($650)')
  console.log('   - Medical Bill ($280)')
  console.log('   - Home Repair ($800)')
  console.log('\n⚠️  Note: Balance will go negative around days 11-18')
  console.log('   After first paycheck on day 10 ($3,200), expenses accumulate (rent $1,950, insurance $650,')
  console.log('   medical $280, home repair $800) totaling $3,680, pushing balance negative before')
  console.log('   next paycheck on day 24, demonstrating early warning.')
  console.log('\n✨ You can now view the app with sample data at http://localhost:3000')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
