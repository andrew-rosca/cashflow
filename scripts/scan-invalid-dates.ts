import { PrismaClient } from '@prisma/client'
import { LogicalDate } from '../src/lib/logical-date'

const prisma = new PrismaClient()

function validateDate(label: string, value: unknown) {
  if (value === null || value === undefined) return null
  const s = String(value)
  try {
    // This will throw (often a RangeError) if invalid for Temporal.PlainDate
    LogicalDate.fromString(s)
    return null
  } catch (e: any) {
    return { label, value: s, error: String(e?.message ?? e) }
  }
}

async function main() {
  const problems: Array<{ label: string; value: string; error: string }> = []

  const accounts = await prisma.cashFlowAccount.findMany()
  for (const a of accounts) {
    const p = validateDate(
      `Account.balanceAsOf (accountId=${a.id}, name=${a.name})`,
      a.balanceAsOf
    )
    if (p) problems.push(p)
  }

  const txs = await prisma.transaction.findMany({ include: { recurrence: true } })
  for (const t of txs) {
    const p1 = validateDate(
      `Transaction.date (txId=${t.id}, desc=${t.description ?? ''})`,
      t.date
    )
    if (p1) problems.push(p1)

    if (t.recurrence?.endDate != null) {
      const p2 = validateDate(
        `Recurrence.endDate (recId=${t.recurrence.id}, txId=${t.id})`,
        t.recurrence.endDate
      )
      if (p2) problems.push(p2)
    }
  }

  console.log(`Scanned ${accounts.length} accounts and ${txs.length} transactions.`)
  if (problems.length === 0) {
    console.log('No invalid date strings found in DB fields.')
    return
  }

  console.log(`FOUND ${problems.length} invalid date string(s):`)
  for (const p of problems) {
    console.log(`- ${p.label}: "${p.value}" -> ${p.error}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


