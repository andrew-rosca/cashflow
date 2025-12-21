'use client'

import { useState, useEffect, useRef } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import DateInput from '@/components/DateInput'
import RecurrenceControl from '@/components/RecurrenceControl'

interface Account {
  id: string
  name: string
  initialBalance: number
  balanceAsOf: Date | string
  externalId?: string
}

interface Transaction {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  description?: string
  settlementDays?: number
  recurrence?: {
    frequency: string
    dayOfWeek?: number
    dayOfMonth?: number
    interval?: number
    endDate?: string
    occurrences?: number
  }
}

interface ProjectionData {
  accountId: string
  date: Date | string
  balance: number
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projections, setProjections] = useState<ProjectionData[]>([])
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const dateValueRef = useRef<Record<string, string>>({})
  
  // Dialog states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [isRecurringTransaction, setIsRecurringTransaction] = useState(false)
  const [transactionDate, setTransactionDate] = useState<Date>(new Date())
  const [transactionAccountId, setTransactionAccountId] = useState<string>('')
  const [recurrence, setRecurrence] = useState<any>({
    frequency: 'monthly',
    interval: 1,
    dayOfWeek: null,
    dayOfMonth: null,
    month: null,
    endDate: null,
  })

  // Load data
  useEffect(() => {
    loadAccounts()
    loadTransactions()
  }, [])

  useEffect(() => {
    if (accounts.length > 0) {
      loadProjections()
    }
  }, [accounts, transactions])

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      if (!response.ok) {
        console.error('Failed to load accounts:', response.status, response.statusText)
        return
      }
      const data = await response.json()
      // Filter out income/expense accounts - these are not tracked accounts
      // They're used for categorization but shouldn't appear in the balance list
      const trackedAccounts = data.filter((acc: Account) => {
        const name = acc.name.toLowerCase()
        return name !== 'income' && name !== 'expenses' && name !== 'expense'
      })
      setAccounts(trackedAccounts)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    }
  }

  const loadTransactions = async () => {
    try {
      const today = new Date()
      const futureDate = addDays(today, 365)
      const response = await fetch(
        `/api/transactions?startDate=${format(today, 'yyyy-MM-dd')}&endDate=${format(futureDate, 'yyyy-MM-dd')}`
      )
      if (!response.ok) {
        console.error('Failed to load transactions:', response.status, response.statusText)
        return
      }
      const data = await response.json()
      setTransactions(data)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    }
  }

  const loadProjections = async () => {
    try {
      const today = new Date()
      const endDate = addDays(today, 90)
      
      if (accounts.length === 0) {
        setProjections([])
        return
      }

      // Get projections for all accounts
      const allProjections: ProjectionData[] = []
      for (const account of accounts) {
        const response = await fetch(
          `/api/projections?accountId=${account.id}&startDate=${format(today, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}&_t=${Date.now()}`,
          {
            cache: 'no-store',
          }
        )
        if (!response.ok) {
          console.error(`Failed to load projections for account ${account.id}:`, response.status, response.statusText)
          continue
        }
        const data = await response.json()
        allProjections.push(...data)
      }
      
      setProjections(allProjections)
    } catch (error) {
      console.error('Failed to load projections:', error)
    }
  }

  // Inline editing handlers
  const handleCellClick = (cellId: string, currentValue: string | Date) => {
    setEditingCell(cellId)
    // If it's a date, use the date string directly to avoid timezone issues
    if (cellId.includes('date')) {
      // Use getDateString to ensure we have YYYY-MM-DD format
      setEditValue(getDateString(currentValue))
    } else {
      setEditValue(currentValue.toString())
    }
  }

  // Handler for date changes from DateInput component
  const handleDateChange = (date: Date) => {
    if (!editingCell) return
    // Extract UTC date components to avoid timezone shifts
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    console.log('handleDateChange - date:', date.toISOString(), '-> formatted:', dateStr, 'UTC year:', year)
    setEditValue(dateStr)
    // Store the date string in a ref so handleCellBlur can access it immediately
    if (!dateValueRef.current) {
      dateValueRef.current = {}
    }
    dateValueRef.current[editingCell] = dateStr
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const parts = editingCell.split('-')
    
    try {
      if (parts[0] === 'account' && parts[1] === 'date') {
        const accountId = parts[2]
        // Use the date from the ref if available (from handleDateChange), otherwise use editValue
        // This ensures we get the most recent value even if state hasn't updated yet
        const dateStr = dateValueRef.current[editingCell] || editValue
        console.log('[CLIENT] Saving date:', dateStr, 'for account:', accountId, 'from ref:', !!dateValueRef.current[editingCell])
        // Clear the ref after using it
        delete dateValueRef.current[editingCell]
        const response = await fetch(`/api/accounts/${accountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balanceAsOf: dateStr }),
        })
        if (!response.ok) {
          console.error('[CLIENT] Failed to save date:', response.status, response.statusText)
          return
        }
        const updated = await response.json()
        const returnedDateStr = typeof updated.balanceAsOf === 'string' 
          ? updated.balanceAsOf.split('T')[0] 
          : updated.balanceAsOf.toISOString().split('T')[0]
        console.log('[CLIENT] Saved account date - returned:', updated.balanceAsOf, '-> extracted:', returnedDateStr, 'expected:', dateStr)
        // Reload accounts to get the updated data
        await loadAccounts()
      } else if (parts[0] === 'account' && parts[1] === 'balance') {
        const accountId = parts[2]
        await fetch(`/api/accounts/${accountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initialBalance: parseFloat(editValue) || 0 }),
        })
        loadAccounts()
      } else if (parts[0] === 'tx' && parts[1] === 'date') {
        const txId = parts[2]
        // editValue is stored as YYYY-MM-DD, convert to Date
        const dateStr = editValue // YYYY-MM-DD format
        const localDate = new Date(dateStr + 'T00:00:00')
        await fetch(`/api/transactions/${txId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: localDate.toISOString() }),
        })
        await loadTransactions()
        // Reload projections after transaction date is updated
        if (accounts.length > 0) {
          await loadProjections()
        }
      } else if (parts[0] === 'tx' && parts[1] === 'amount') {
        const txId = parts[2]
        const tx = transactions.find(t => t.id === txId)
        if (tx) {
          // Preserve the sign that the user entered
          const newAmount = parseFloat(editValue) || 0
          await fetch(`/api/transactions/${txId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: newAmount }),
          })
          await loadTransactions()
          // Reload projections after transaction amount is updated
          if (accounts.length > 0) {
            await loadProjections()
          }
        }
      } else if (parts[0] === 'tx' && parts[1] === 'notes') {
        const txId = parts[2]
        await fetch(`/api/transactions/${txId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: editValue }),
        })
        await loadTransactions()
        // Note: Description changes don't affect projections, but we reload for consistency
        if (accounts.length > 0) {
          await loadProjections()
        }
      }
    } catch (error) {
      console.error('Failed to update:', error)
    }

    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }

  // Account management
  const openAccountDialog = (accountId: string) => {
    setSelectedAccountId(accountId)
    setAccountDialogOpen(true)
  }

  const closeAccountDialog = () => {
    setAccountDialogOpen(false)
    setSelectedAccountId(null)
  }

  const handleAccountNameChange = async (newName: string) => {
    if (selectedAccountId && newName.trim()) {
      try {
        await fetch(`/api/accounts/${selectedAccountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() }),
        })
        loadAccounts()
        closeAccountDialog()
      } catch (error) {
        console.error('Failed to update account name:', error)
      }
    }
  }

  const handleAccountDelete = async () => {
    if (selectedAccountId) {
      try {
        await fetch(`/api/accounts/${selectedAccountId}`, { method: 'DELETE' })
        loadAccounts()
      } catch (error) {
        console.error('Failed to delete account:', error)
      }
    }
    closeAccountDialog()
  }

  const handleTransactionDelete = async () => {
    if (selectedTransactionId) {
      try {
        await fetch(`/api/transactions/${selectedTransactionId}`, { method: 'DELETE' })
        await loadTransactions()
        // Explicitly reload projections after transactions are updated
        if (accounts.length > 0) {
          await loadProjections()
        }
        closeTransactionDialog()
      } catch (error) {
        console.error('Failed to delete transaction:', error)
      }
    }
  }

  const handleAddAccount = async () => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Account',
          initialBalance: 0,
          balanceAsOf: new Date().toISOString().split('T')[0] + 'T00:00:00',
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create account' }))
        throw new Error(error.message || 'Failed to create account')
      }
      await loadAccounts()
    } catch (error) {
      console.error('Failed to create account:', error)
      alert('Failed to create account. Please try again.')
    }
  }

  // Transaction management
  const openTransactionDialog = (transactionId?: string) => {
    if (transactionId) {
      const tx = transactions.find(t => t.id === transactionId)
      if (tx) {
        setSelectedTransactionId(transactionId)
        setIsRecurringTransaction(!!tx.recurrence)
        setTransactionAccountId(tx.fromAccountId)
        // Set dates from transaction
        const txDate = typeof tx.date === 'string' 
          ? new Date(tx.date.split('T')[0] + 'T00:00:00')
          : tx.date
        setTransactionDate(txDate)
        // Set recurrence from transaction
        if (tx.recurrence) {
          setRecurrence({
            frequency: tx.recurrence.frequency || 'monthly',
            interval: tx.recurrence.interval || 1,
            dayOfWeek: tx.recurrence.dayOfWeek ?? null,
            dayOfMonth: tx.recurrence.dayOfMonth ?? null,
            month: tx.recurrence.month ?? null,
            endDate: tx.recurrence.endDate ? (typeof tx.recurrence.endDate === 'string' ? tx.recurrence.endDate : tx.recurrence.endDate.split('T')[0]) : null,
          })
        } else {
          setRecurrence({
            frequency: 'monthly',
            interval: 1,
            dayOfWeek: null,
            dayOfMonth: null,
            month: null,
            endDate: null,
          })
        }
      }
    } else {
      setSelectedTransactionId(null)
      setIsRecurringTransaction(false)
      setTransactionDate(new Date())
      // Set account from localStorage or default to first account
      const lastAccountId = localStorage.getItem('lastUsedAccountId')
      if (lastAccountId && accounts.find(a => a.id === lastAccountId)) {
        setTransactionAccountId(lastAccountId)
      } else if (accounts.length === 1) {
        setTransactionAccountId(accounts[0].id)
      } else {
        setTransactionAccountId('')
      }
      setRecurrence({
        frequency: 'monthly',
        interval: 1,
        dayOfWeek: null,
        dayOfMonth: null,
        month: null,
        endDate: null,
      })
    }
    setTransactionDialogOpen(true)
  }

  const closeTransactionDialog = () => {
    setTransactionDialogOpen(false)
    setSelectedTransactionId(null)
    setIsRecurringTransaction(false)
    setTransactionDate(new Date())
    setTransactionAccountId('')
    setRecurrence({
      frequency: 'monthly',
      interval: 1,
      dayOfWeek: null,
      dayOfMonth: null,
      month: null,
      endDate: null,
    })
  }

  const handleTransactionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    // Save most recently used account to localStorage
    if (transactionAccountId) {
      localStorage.setItem('lastUsedAccountId', transactionAccountId)
    }
    
    // Use transactionDate state (already a Date object)
    const payload: any = {
      fromAccountId: transactionAccountId,
      toAccountId: transactionAccountId, // For now, use same account (transfers will be added later)
      amount: parseFloat(formData.get('amount') as string),
      date: transactionDate.toISOString(),
      description: (formData.get('description') as string) || undefined,
    }

    if (formData.get('isRecurring') === 'on') {
      payload.recurrence = { ...recurrence }
    }

    try {
      if (selectedTransactionId) {
        await fetch(`/api/transactions/${selectedTransactionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      await loadTransactions()
      // Explicitly reload projections after transactions are updated
      if (accounts.length > 0) {
        await loadProjections()
      }
      closeTransactionDialog()
    } catch (error) {
      console.error('Failed to save transaction:', error)
    }
  }

  // Format helpers
  const formatNumber = (amount: number) => {
    return amount.toFixed(2)
  }

  const formatDate = (dateStr: string | Date) => {
    // Parse date as UTC to avoid timezone shifts
    let date: Date
    if (typeof dateStr === 'string') {
      // If it's an ISO string, extract just the date part and parse as UTC
      const dateOnly = dateStr.split('T')[0]
      const [year, month, day] = dateOnly.split('-').map(Number)
      date = new Date(Date.UTC(year, month - 1, day))
    } else {
      date = dateStr
    }
    // Format using UTC components to avoid timezone shifts
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
    return `${monthName} ${date.getUTCDate()}`
  }
  
  // Helper to get date string in YYYY-MM-DD format from a date
  const getDateString = (date: Date | string): string => {
    if (typeof date === 'string') {
      // Extract date part from ISO string
      return date.split('T')[0]
    }
    // Format as YYYY-MM-DD using UTC to avoid timezone shifts
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get account name helper
  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || 'Unknown'
  }

  // Calculate transaction amount for display
  // For simplicity, show amount as positive (inflow) or negative (outflow) based on direction
  const getTransactionAmount = (tx: Transaction): number => {
    // If transaction is from a tracked account, it's an outflow (negative)
    const fromAccount = accounts.find(a => a.id === tx.fromAccountId)
    const toAccount = accounts.find(a => a.id === tx.toAccountId)
    
    // If both are tracked accounts and they're different, it's a transfer - show as negative from source
    if (fromAccount && toAccount && tx.fromAccountId !== tx.toAccountId) {
      return -tx.amount
    }
    // If from tracked account (and not a transfer), it's an outflow (negative)
    // But preserve the sign if amount is already negative (user entered negative expense)
    if (fromAccount) {
      // If amount is already negative, it's an expense - preserve the sign
      // If amount is positive, negate it to show as outflow
      return tx.amount < 0 ? tx.amount : -tx.amount
    }
    // If to tracked account, it's an inflow (positive)
    if (toAccount) {
      return tx.amount
    }
    // Default: preserve the sign of the amount (user's intent)
    return tx.amount
  }

  // Get projected balance for account on date
  const getProjectedBalance = (accountId: string, date: Date): number | null => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const projection = projections.find(
      p => p.accountId === accountId && format(new Date(p.date), 'yyyy-MM-dd') === dateStr
    )
    return projection ? projection.balance : null
  }

  // Get all unique dates from projections
  const getAllProjectionDates = (): Date[] => {
    const dateSet = new Set<string>()
    projections.forEach(p => {
      const dateStr = format(new Date(p.date), 'yyyy-MM-dd')
      dateSet.add(dateStr)
    })
    return Array.from(dateSet)
      .map(d => parseISO(d))
      .sort((a, b) => a.getTime() - b.getTime())
  }

  // Filter dates to only show rows where balance changes
  const getDatesWithBalanceChanges = (): Date[] => {
    const allDates = getAllProjectionDates()
    if (allDates.length === 0) return []

    const datesWithChanges: Date[] = [allDates[0]] // Always include first date

    for (let i = 1; i < allDates.length; i++) {
      const currentDate = allDates[i]
      // Compare with the last date that was actually included in datesWithChanges
      const lastIncludedDate = datesWithChanges[datesWithChanges.length - 1]
      
      // Check if any account's balance changed between these dates
      const hasChange = accounts.some(account => {
        const currentBalance = getProjectedBalance(account.id, currentDate)
        const previousBalance = getProjectedBalance(account.id, lastIncludedDate)
        
        // If either is null, we can't compare, so include the date
        if (currentBalance === null || previousBalance === null) {
          return currentBalance !== previousBalance
        }
        
        // Include if balance changed
        return currentBalance !== previousBalance
      })

      if (hasChange) {
        datesWithChanges.push(currentDate)
      }
    }

    return datesWithChanges
  }

  const projectionDates = getDatesWithBalanceChanges()

  // Separate one-time and recurring transactions
  const oneTimeTransactions = transactions.filter(t => !t.recurrence)
  const recurringTransactions = transactions.filter(t => t.recurrence)

  // Get selected transaction for dialog
  const selectedTransaction = selectedTransactionId 
    ? transactions.find(t => t.id === selectedTransactionId)
    : null

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-[auto_1fr] gap-8">
          {/* Left sidebar - Account balances and transactions */}
          <div className="space-y-6 w-80">
            {/* Current Balances */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Current Balances
                </h2>
                <button 
                  onClick={handleAddAccount}
                  className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500 flex items-center justify-center text-xs transition-colors"
                >
                  +
                </button>
              </div>
              <div className="space-y-1">
                {accounts.map(account => {
                  // Parse balanceAsOf as UTC date to avoid timezone issues
                  const balanceAsOf = account.balanceAsOf 
                    ? (() => {
                        let dateOnly: string
                        if (typeof account.balanceAsOf === 'string') {
                          dateOnly = account.balanceAsOf.split('T')[0]
                        } else {
                          dateOnly = account.balanceAsOf.toISOString().split('T')[0]
                        }
                        // Parse as UTC to avoid timezone conversion issues
                        const [year, month, day] = dateOnly.split('-').map(Number)
                        const parsed = new Date(Date.UTC(year, month - 1, day))
                        console.log('Account date from API:', account.balanceAsOf, '-> extracted:', dateOnly, '-> parsed year (UTC):', parsed.getUTCFullYear())
                        return parsed
                      })()
                    : new Date()
                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-2 py-1 px-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors min-w-0"
                    >
                      <span 
                        className="text-xs text-gray-400 dark:text-gray-500 min-w-[80px] flex-shrink-0 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                        onClick={() => openAccountDialog(account.id)}
                      >
                        {account.name}
                      </span>
                      {editingCell === `account-date-${account.id}` ? (
                        <DateInput
                          value={editValue ? editValue : getDateString(balanceAsOf)}
                          onChange={handleDateChange}
                          onBlur={handleCellBlur}
                          className="w-40 flex-shrink-0"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="text-xs text-gray-500 dark:text-gray-400 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-shrink-0 whitespace-nowrap"
                          onClick={() => handleCellClick(`account-date-${account.id}`, getDateString(balanceAsOf))}
                        >
                          {formatDate(balanceAsOf)}
                        </span>
                      )}
                      {editingCell === `account-balance-${account.id}` ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyPress}
                          autoFocus
                          className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 ml-auto text-right w-24"
                        />
                      ) : (
                        <span 
                          className={`text-sm font-mono ml-auto cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${
                            account.initialBalance < 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                          onClick={() => handleCellClick(`account-balance-${account.id}`, account.initialBalance.toString())}
                        >
                          {formatNumber(account.initialBalance)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Upcoming Transactions */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Upcoming Transactions
                </h2>
                <button 
                  onClick={() => openTransactionDialog()}
                  className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500 flex items-center justify-center text-xs transition-colors"
                >
                  +
                </button>
              </div>
              <div className="space-y-1">
                {[...oneTimeTransactions, ...recurringTransactions]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 20)
                  .map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-2 py-1 px-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    {tx.recurrence ? (
                      <>
                        <svg 
                          className="w-3.5 h-3.5 text-blue-500 cursor-pointer hover:text-blue-600 flex-shrink-0" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span 
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          {formatDate(tx.date)}
                        </span>
                        <span 
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-1 truncate"
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          {tx.description || 'Transaction'}
                        </span>
                        <span 
                          className={`text-sm font-mono cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${
                            getTransactionAmount(tx) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                          }`}
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          {formatNumber(getTransactionAmount(tx))}
                        </span>
                      </>
                    ) : (
                      <>
                        {editingCell === `tx-date-${tx.id}` ? (
                          <DateInput
                            value={editValue ? new Date(editValue + 'T00:00:00') : tx.date}
                            onChange={handleDateChange}
                            onBlur={handleCellBlur}
                            className="w-40 flex-shrink-0"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                            onClick={() => handleCellClick(`tx-date-${tx.id}`, getDateString(tx.date))}
                          >
                            {formatDate(tx.date)}
                          </span>
                        )}
                        {editingCell === `tx-notes-${tx.id}` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 flex-1"
                          />
                        ) : (
                          <span 
                            className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-1 truncate"
                            onClick={() => handleCellClick(`tx-notes-${tx.id}`, tx.description || '')}
                          >
                            {tx.description || 'Transaction'}
                          </span>
                        )}
                        {editingCell === `tx-amount-${tx.id}` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 text-right w-20"
                          />
                        ) : (
                          <span 
                            className={`text-sm font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${
                              getTransactionAmount(tx) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                            }`}
                            onClick={() => handleCellClick(`tx-amount-${tx.id}`, tx.amount.toString())}
                          >
                            {formatNumber(getTransactionAmount(tx))}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Projection table */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="text-left py-2 px-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">
                      Date
                    </th>
                    {accounts.map(account => (
                      <th
                        key={account.id}
                        className="text-right py-2 px-4 font-medium text-gray-900 dark:text-gray-100"
                      >
                        {account.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectionDates.map((date, idx) => (
                    <tr
                      key={date.toISOString()}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        idx % 5 === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-medium">
                        {formatDate(date)}
                      </td>
                      {accounts.map(account => {
                        const balance = getProjectedBalance(account.id, date)
                        return (
                          <td
                            key={account.id}
                            className="py-2 px-4 text-right font-mono"
                          >
                            {balance !== null ? (
                              <span className={balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}>
                                {formatNumber(balance)}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Account Dialog */}
        {accountDialogOpen && selectedAccountId && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={closeAccountDialog}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Edit Account
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const name = formData.get('name') as string
                  handleAccountNameChange(name)
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={accounts.find(a => a.id === selectedAccountId)?.name}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4 items-center">
                  <button
                    type="button"
                    onClick={closeAccountDialog}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={handleAccountDelete}
                    className="px-3 py-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete account"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transaction Dialog */}
        {transactionDialogOpen && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={closeTransactionDialog}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {selectedTransactionId ? 'Edit Transaction' : 'Add Transaction'}
                </h3>
                {selectedTransactionId && (
                  <button
                    type="button"
                    onClick={handleTransactionDelete}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete transaction"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map(account => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setTransactionAccountId(account.id)}
                        className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                          transactionAccountId === account.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {account.name}
                      </button>
                    ))}
                  </div>
                  <input
                    type="hidden"
                    name="fromAccountId"
                    value={transactionAccountId}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <DateInput
                    value={transactionDate}
                    onChange={setTransactionDate}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    required
                    defaultValue={selectedTransaction?.amount || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={selectedTransaction?.description || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    name="isRecurring"
                    checked={isRecurringTransaction}
                    onChange={(e) => setIsRecurringTransaction(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="isRecurring" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Make this recurring
                  </label>
                </div>
                {isRecurringTransaction && (
                  <RecurrenceControl
                    value={recurrence}
                    onChange={setRecurrence}
                  />
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={closeTransactionDialog}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {selectedTransactionId ? 'Save' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
