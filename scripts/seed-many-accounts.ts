import { PrismaClient } from '@prisma/client'
import { today } from '../src/lib/logical-date'

const prisma = new PrismaClient()

/**
 * Seed many accounts for testing balance panel expansion
 * 
 * Usage: 
 * 1. Sign in to the app first
 * 2. Get your user ID from the database or session
 * 3. Run: COUNT=20 USER_ID="your-user-id" tsx scripts/seed-many-accounts.ts
 * 
 * Or run without USER_ID to seed for user-1 (demo user)
 * Or run without COUNT to create 20 accounts (default)
 */

async function main() {
  const userId = process.env.USER_ID || 'user-1'
  const count = parseInt(process.env.COUNT || '20', 10)
  
  if (isNaN(count) || count < 1) {
    console.error('❌ COUNT must be a positive number')
    process.exit(1)
  }
  
  console.log(`🌱 Seeding ${count} accounts for user: ${userId}`)

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    console.error(`❌ User with ID "${userId}" not found.`)
    console.error('   Please sign in first, or use an existing user ID.')
    console.error('   To find your user ID, check the User table in the database.')
    console.error('   Run: tsx scripts/list-users.ts to see all users')
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.email || user.name || userId}`)

  // Get today's date as LogicalDate and convert to string
  const todayDate = today()
  const todayString = todayDate.toString()

  // Create accounts
  console.log(`\n📝 Creating ${count} accounts...`)
  const accounts = []
  
  for (let i = 1; i <= count; i++) {
    // Generate a random balance between -1000 and 10000
    const randomBalance = Math.floor(Math.random() * 11000) - 1000
    
    const account = await prisma.cashFlowAccount.create({
      data: {
        userId: user.id,
        name: `Account ${i}`,
        initialBalance: randomBalance,
        balanceAsOf: todayString,
      },
    })
    
    accounts.push(account)
    
    // Show progress every 10 accounts
    if (i % 10 === 0 || i === count) {
      console.log(`   ✅ Created ${i}/${count} accounts...`)
    }
  }

  console.log(`\n🎉 Successfully created ${count} accounts!`)
  console.log(`\n📊 Account summary:`)
  console.log(`   - Total accounts: ${accounts.length}`)
  console.log(`   - Balance range: $${Math.min(...accounts.map(a => a.initialBalance))} to $${Math.max(...accounts.map(a => a.initialBalance))}`)
  console.log(`\n✨ You can now view the app with many accounts at http://localhost:3000`)
  console.log(`   The balance panel should expand to accommodate all ${count} account columns.`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding accounts:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

