import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with sample data...')

  // Create sample user
  const user = await prisma.user.upsert({
    where: { id: 'user-1' },
    update: {},
    create: {
      id: 'user-1',
      email: 'demo@cashflow.app',
      name: 'Demo User',
    },
  })

  console.log('✅ Created user:', user.email)

  // Clear existing data for this user
  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  await prisma.cashFlowAccount.deleteMany({ where: { userId: user.id } })

  // Create single tracked account
  const checkingAccount = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Main Checking',
      type: 'tracked',
      initialBalance: 3500,
    },
  })

  console.log('✅ Created tracked account: Main Checking')

  // Create external accounts (simplified to just Income and Expenses)
  const income = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Income',
      type: 'external',
      category: 'income',
    },
  })

  const expenses = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Expenses',
      type: 'external',
      category: 'expense',
    },
  })

  console.log('✅ Created external accounts: Income, Expenses')

  // Helper function to get dates
  const today = new Date()
  const daysFromNow = (days: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() + days)
    return date
  }

  // 1. Recurring income - Paycheck every 2 weeks
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: income.id,
      toAccountId: checkingAccount.id,
      amount: 2800,
      description: 'Paycheck',
      date: daysFromNow(7), // Next paycheck in 7 days
      recurrence: {
        create: {
          frequency: 'weekly',
          interval: 2,
        },
      },
    },
  })

  console.log('✅ Created recurring paycheck (every 2 weeks)')

  // 2. Recurring expense - Rent on the 1st of each month
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: 1800,
      description: 'Rent',
      date: daysFromNow(1),
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 1,
        },
      },
    },
  })

  console.log('✅ Created recurring rent (monthly on 1st)')

  // 3. Recurring expense - Credit card payment on the 25th
  // NOTE: This will eventually support variable amounts (future feature)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: expenses.id,
      amount: 450,
      description: 'Credit Card Payment',
      date: daysFromNow(5),
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 25,
        },
      },
    },
  })

  console.log('✅ Created recurring credit card payment (monthly on 25th)')

  console.log('\n🎉 Seeding complete!')
  console.log('📊 Created 1 tracked account (Main Checking)')
  console.log('📊 Created 2 external accounts (Income, Expenses)')
  console.log('💰 Created 3 recurring transactions (Paycheck, Rent, Credit Card)')
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
