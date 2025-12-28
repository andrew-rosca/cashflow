#!/bin/bash

set -e

echo "🔄 Resetting database to blank state (user + account)"
echo "======================================================"

# Reuse the reset logic from reset-user.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/reset-user.sh"

# Create a default account
echo "💰 Creating default account..."
if npx tsx -e "
import { PrismaClient } from '@prisma/client';
import { today } from './src/lib/logical-date';

const prisma = new PrismaClient();

async function main() {
  const todayDate = today();
  const account = await prisma.cashFlowAccount.create({
    data: {
      userId: 'user-1',
      name: 'Main Account',
      initialBalance: 0,
      balanceAsOf: todayDate.toString(),
    },
  });
  console.log('✅ Created account:', account.name, '(ID:', account.id + ')');
}

main()
  .catch((e) => {
    console.error('❌ Error creating account:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.\$disconnect();
  });
"; then
    echo "✅ Account created successfully"
else
    echo "❌ Account creation failed"
    exit 1
fi

echo ""
echo "✅ Database reset complete!"
echo "   Database now contains:"
echo "   - user-1 (demo@cashflow.app)"
echo "   - Main Account (with \$0 balance)"
echo "   - No transactions"
echo ""

