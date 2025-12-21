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

  // Create tracked accounts
  const checkingAccount = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Main Checking',
      type: 'tracked',
      initialBalance: 2500,
    },
  })

  const savingsAccount = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Savings Account',
      type: 'tracked',
      initialBalance: 10000,
    },
  })

  const creditCard = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Credit Card',
      type: 'tracked',
      initialBalance: -450, // Credit cards typically show as negative
    },
  })

  console.log('✅ Created tracked accounts')

  // Create external accounts (income/expense categories)
  const salary = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Salary',
      type: 'external',
      category: 'income',
    },
  })

  const groceries = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Groceries',
      type: 'external',
      category: 'expense',
    },
  })

  const utilities = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Utilities',
      type: 'external',
      category: 'expense',
    },
  })

  const rent = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Rent/Mortgage',
      type: 'external',
      category: 'expense',
    },
  })

  const entertainment = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Entertainment',
      type: 'external',
      category: 'expense',
    },
  })

  const dining = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Dining Out',
      type: 'external',
      category: 'expense',
    },
  })

  const insurance = await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: 'Insurance',
      type: 'external',
      category: 'expense',
    },
  })

  console.log('✅ Created external accounts')

  // Helper function to get dates
  const today = new Date()
  const daysAgo = (days: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() - days)
    return date
  }
  const daysFromNow = (days: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() + days)
    return date
  }

  // Create recurring income (salary - biweekly)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: salary.id,
      toAccountId: checkingAccount.id,
      amount: 2800,
      description: 'Biweekly Paycheck',
      date: daysFromNow(7), // Next paycheck in 7 days
      recurrence: {
        create: {
          frequency: 'biweekly',
          interval: 1,
        },
      },
    },
  })

  console.log('✅ Created recurring salary')

  // Create recurring expenses
  // Rent - monthly on the 1st
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: rent.id,
      amount: 1500,
      description: 'Monthly Rent',
      date: daysFromNow(1), // Assuming rent is due soon
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 1,
        },
      },
    },
  })

  // Utilities - monthly on the 15th
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: utilities.id,
      amount: 180,
      description: 'Electric, Water, Internet',
      date: daysFromNow(15),
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 15,
        },
      },
    },
  })

  // Insurance - monthly on the 10th
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: insurance.id,
      amount: 250,
      description: 'Car & Health Insurance',
      date: daysFromNow(10),
      recurrence: {
        create: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 10,
        },
      },
    },
  })

  console.log('✅ Created recurring expenses')

  // Create some one-time past transactions
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: groceries.id,
      amount: 85.50,
      description: 'Whole Foods',
      date: daysAgo(2),
    },
  })

  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: dining.id,
      amount: 42.30,
      description: 'Dinner at Italian Restaurant',
      date: daysAgo(4),
    },
  })

  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: entertainment.id,
      amount: 15.99,
      description: 'Netflix Subscription',
      date: daysAgo(7),
    },
  })

  // Past salary
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: salary.id,
      toAccountId: checkingAccount.id,
      amount: 2800,
      description: 'Biweekly Paycheck',
      date: daysAgo(7),
    },
  })

  console.log('✅ Created past transactions')

  // Create some upcoming one-time transactions
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: groceries.id,
      amount: 120,
      description: 'Grocery Shopping (planned)',
      date: daysFromNow(3),
    },
  })

  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: entertainment.id,
      amount: 65,
      description: 'Concert Tickets',
      date: daysFromNow(12),
    },
  })

  // Credit card payment (transfer between tracked accounts)
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: creditCard.id,
      amount: 450,
      description: 'Credit Card Payment',
      date: daysFromNow(5),
    },
  })

  // Savings transfer with settlement lag
  await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: checkingAccount.id,
      toAccountId: savingsAccount.id,
      amount: 500,
      description: 'Monthly Savings Transfer',
      date: daysFromNow(8),
      settlementDays: 3, // Takes 3 days to settle
    },
  })

  console.log('✅ Created upcoming transactions')

  // Get transaction count
  const transactionCount = await prisma.transaction.count({
    where: { userId: user.id },
  })

  const accountCount = await prisma.cashFlowAccount.count({
    where: { userId: user.id },
  })

  console.log('\n🎉 Seeding complete!')
  console.log(`📊 Created ${accountCount} accounts (3 tracked, ${accountCount - 3} external)`)
  console.log(`💰 Created ${transactionCount} transactions (3 recurring, ${transactionCount - 3} one-time)`)
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
