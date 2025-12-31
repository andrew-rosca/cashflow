import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  })

  if (users.length === 0) {
    console.log('No users found in database.')
    console.log('Sign in to the app first to create a user account.')
    return
  }

  console.log('📋 Users in database:\n')
  users.forEach((user, index) => {
    console.log(`${index + 1}. ID: ${user.id}`)
    console.log(`   Email: ${user.email || 'N/A'}`)
    console.log(`   Name: ${user.name || 'N/A'}`)
    console.log(`   Created: ${user.createdAt.toLocaleDateString()}`)
    console.log('')
  })

  console.log('💡 To seed data for a user, run:')
  console.log(`   USER_ID="${users[0].id}" npm run db:seed:user`)
  console.log('')
  console.log('   Or use the seed script directly:')
  console.log(`   USER_ID="${users[0].id}" tsx scripts/seed-for-current-user.ts`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

