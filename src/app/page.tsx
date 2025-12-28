'use client'

import { useState, useEffect, useRef } from 'react'
import DateInput from '@/components/DateInput'
import RecurrenceControl from '@/components/RecurrenceControl'
import { LogicalDate, today } from '@/lib/logical-date'

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
  date: string // Calendar date string (YYYY-MM-DD)
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
  
  // Helper to get today's date (client-side only - uses browser's local date)
  const getToday = (): LogicalDate => {
    return today() // Use the today() function from LogicalDate (the only place Date is used)
  }

  // Dialog states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [isRecurringTransaction, setIsRecurringTransaction] = useState(false)
  const [transactionDate, setTransactionDate] = useState<LogicalDate>(getToday())
  const [transactionAccountId, setTransactionAccountId] = useState<string>('')
  const [recurrence, setRecurrence] = useState<any>({
    frequency: 'monthly',
    interval: 1,
    dayOfWeek: null,
    dayOfMonth: null,
    month: null,
    endDate: null,
  })
  const [rawInputDialogOpen, setRawInputDialogOpen] = useState(false)
  const [rawInputTsv, setRawInputTsv] = useState<string>('')
  const [rawInputLoading, setRawInputLoading] = useState(false)
  const [rawInputError, setRawInputError] = useState<string | null>(null)

  // Load data
  useEffect(() => {
    loadAccounts()
    loadTransactions()
  }, [])

  // Auto-load transactions when raw input dialog opens
  useEffect(() => {
    if (rawInputDialogOpen) {
      setRawInputError(null)
      setRawInputLoading(true)
      fetch('/api/transactions/bulk')
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to export transactions')
          }
          return response.text()
        })
        .then(tsv => {
          setRawInputTsv(tsv)
          setRawInputLoading(false)
        })
        .catch(error => {
          setRawInputError(error instanceof Error ? error.message : 'Failed to load transactions')
          setRawInputLoading(false)
        })
    }
  }, [rawInputDialogOpen])

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
      const today = getToday()
      const futureDate = today.addDays(365)
      const response = await fetch(
        `/api/transactions?startDate=${today.toString()}&endDate=${futureDate.toString()}`
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
      const today = getToday()
      const endDate = today.addDays(90)
      
      if (accounts.length === 0) {
        setProjections([])
        return
      }

      // Get projections for all accounts
      const allProjections: ProjectionData[] = []
      for (const account of accounts) {
        const response = await fetch(
          `/api/projections?accountId=${account.id}&startDate=${today.toString()}&endDate=${endDate.toString()}&_t=${Date.now()}`,
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
  const handleCellClick = (cellId: string, currentValue: string | LogicalDate) => {
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
  const handleDateChange = (date: LogicalDate) => {
    if (!editingCell) return
    // DateInput now returns LogicalDate directly
    const dateStr = date.toString() // YYYY-MM-DD format
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
        // balanceAsOf should always be a string (YYYY-MM-DD) from the API
        const returnedDateStr = typeof updated.balanceAsOf === 'string' 
          ? updated.balanceAsOf.split('T')[0] 
          : updated.balanceAsOf.toString()
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
        // editValue is stored as YYYY-MM-DD, send directly as string
        const dateStr = editValue // YYYY-MM-DD format
        await fetch(`/api/transactions/${txId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr }),
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
          balanceAsOf: getToday().toString(),
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
        // Set dates from transaction (now a calendar date string)
        const txDate = LogicalDate.fromString(tx.date)
        setTransactionDate(txDate)
        // Set recurrence from transaction
        if (tx.recurrence) {
          setRecurrence({
            frequency: tx.recurrence.frequency || 'monthly',
            interval: tx.recurrence.interval || 1,
            dayOfWeek: tx.recurrence.dayOfWeek ?? null,
            dayOfMonth: tx.recurrence.dayOfMonth ?? null,
            month: (tx.recurrence as any).month ?? null,
            endDate: tx.recurrence.endDate || null,
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
      setTransactionDate(getToday())
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
    setTransactionDate(getToday())
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
    
    // Use transactionDate state - convert to calendar date string (YYYY-MM-DD)
    const payload: any = {
      fromAccountId: transactionAccountId,
      toAccountId: transactionAccountId, // For now, use same account (transfers will be added later)
      amount: parseFloat(formData.get('amount') as string),
      date: getDateString(transactionDate), // Send as calendar date string (YYYY-MM-DD)
      description: (formData.get('description') as string) || undefined,
    }

    if (formData.get('isRecurring') === 'on') {
      payload.recurrence = { 
        ...recurrence,
        // Convert endDate to calendar date string if it exists
        endDate: recurrence.endDate ? getDateString(recurrence.endDate) : null
      }
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

  const formatDate = (dateStr: string | LogicalDate) => {
    // Parse date string to LogicalDate
    const date = typeof dateStr === 'string' ? LogicalDate.fromString(dateStr) : dateStr
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.month - 1]
    return `${monthName} ${date.day}`
  }
  
  // Helper to get date string in YYYY-MM-DD format
  const getDateString = (date: string | LogicalDate): string => {
    if (typeof date === 'string') {
      // Extract date part from ISO string
      return date.split('T')[0]
    }
    // LogicalDate
    return date.toString()
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
  const getProjectedBalance = (accountId: string, date: LogicalDate | string): number | null => {
    const dateStr = date instanceof LogicalDate ? date.toString() : date
    const projection = projections.find(
      p => {
        // API returns date as string (YYYY-MM-DD)
        return p.accountId === accountId && p.date === dateStr
      }
    )
    return projection ? projection.balance : null
  }

  // Get all unique dates from projections
  const getAllProjectionDates = (): LogicalDate[] => {
    const dateSet = new Set<string>()
    projections.forEach(p => {
      // API returns date as string (YYYY-MM-DD)
      dateSet.add(p.date)
    })
    // Convert to LogicalDate objects and sort
    return Array.from(dateSet)
      .map(d => LogicalDate.fromString(d))
      .sort((a, b) => a.compare(b))
  }

  // Filter dates to only show rows where balance changes
  const getDatesWithBalanceChanges = (): LogicalDate[] => {
    const allDates = getAllProjectionDates()
    if (allDates.length === 0) return []

    const datesWithChanges: LogicalDate[] = [allDates[0]] // Always include first date

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

  // Helper function to calculate next occurrence date for recurring transactions
  const getNextOccurrenceDate = (tx: Transaction): LogicalDate => {
    if (!tx.recurrence) return LogicalDate.fromString(tx.date)
    
    const today = getToday()
    const { frequency, interval = 1, dayOfWeek, dayOfMonth, endDate } = tx.recurrence
    let currentDate = LogicalDate.fromString(tx.date)
    
    // If the start date is in the future, that's the next occurrence
    if (currentDate.compare(today) > 0) {
      return currentDate
    }
    
    // Find the next occurrence after today
    let iterations = 0
    const maxIterations = 10000 // Safety check to prevent infinite loops
    
    while (currentDate.compare(today) <= 0 && iterations < maxIterations) {
      iterations++
      
      switch (frequency) {
        case 'daily':
          currentDate = currentDate.addDays(interval)
          break
        case 'weekly':
          currentDate = currentDate.addDays(7 * interval)
          // Note: dayOfWeek is not currently used in weekly recurrences
          // Weekly recurrences just repeat every N weeks from the start date
          break
        case 'monthly':
          currentDate = currentDate.addMonths(interval)
          if (dayOfMonth !== undefined && dayOfMonth !== null) {
            // Set to specific day of month, handling month-end edge cases
            const daysInMonth = currentDate.daysInMonth
            const targetDay = Math.min(dayOfMonth, daysInMonth)
            currentDate = LogicalDate.from(currentDate.year, currentDate.month, targetDay)
          }
          break
        case 'yearly':
          currentDate = currentDate.addYears(interval)
          break
      }
      
      // Check if we've exceeded the end date
      if (endDate) {
        const endDateObj = LogicalDate.fromString(endDate)
        if (currentDate.compare(endDateObj) > 0) {
          // No more occurrences, return the original date
          return LogicalDate.fromString(tx.date)
        }
      }
    }
    
    // If we hit max iterations, return the original date as fallback
    if (iterations >= maxIterations) {
      return LogicalDate.fromString(tx.date)
    }
    
    return currentDate
  }

  // Separate one-time and recurring transactions
  const oneTimeTransactions = transactions.filter(t => !t.recurrence)
  const recurringTransactions = transactions.filter(t => t.recurrence).map(tx => ({
    ...tx,
    // Override the date with the next occurrence date for display
    date: getNextOccurrenceDate(tx).toString(),
  }))

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
                        // API returns balanceAsOf as string (YYYY-MM-DD)
                        const dateStr = typeof account.balanceAsOf === 'string' 
                          ? account.balanceAsOf.split('T')[0] 
                          : account.balanceAsOf.toString().split('T')[0]
                        return LogicalDate.fromString(dateStr)
                      })()
                    : getToday()
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
                  .sort((a, b) => {
                    const dateA = LogicalDate.fromString(a.date)
                    const dateB = LogicalDate.fromString(b.date)
                    return dateA.compare(dateB)
                  })
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
                          value={editValue ? LogicalDate.fromString(editValue) : LogicalDate.fromString(tx.date)}
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
                      key={date.toString()}
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
                <div className="flex items-center gap-3">
                  {!selectedTransactionId && (
                    <button
                      type="button"
                      onClick={() => {
                        setTransactionDialogOpen(false)
                        setRawInputDialogOpen(true)
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                      title="Raw input (TSV)"
                    >
                      raw input
                    </button>
                  )}
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

        {/* Raw Input Dialog */}
        {rawInputDialogOpen && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setRawInputDialogOpen(false)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-6xl h-[calc(100vh-3rem)] shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Raw Transaction Input (TSV)
                </h3>
                <button
                  type="button"
                  onClick={() => setRawInputDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {rawInputError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex-shrink-0">
                  <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">{rawInputError}</p>
                </div>
              )}

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                  Transaction Data (TSV Format)
                </label>
                <textarea
                  value={rawInputTsv}
                  onChange={(e) => {
                    setRawInputTsv(e.target.value)
                    setRawInputError(null)
                  }}
                  rows={30}
                  className="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none overflow-auto"
                  placeholder="Paste or edit TSV transaction data here..."
                  spellCheck={false}
                />
              </div>

              <div className="flex gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 justify-center">
                <button
                  type="button"
                  onClick={() => setRawInputDialogOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!rawInputTsv.trim()) {
                      setRawInputError('TSV data cannot be empty')
                      return
                    }
                    
                    setRawInputError(null)
                    setRawInputLoading(true)
                    try {
                      const response = await fetch('/api/transactions/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/tab-separated-values' },
                        body: rawInputTsv,
                      })
                      
                      if (!response.ok) {
                        const errorData = await response.json()
                        if (errorData.errors && Array.isArray(errorData.errors)) {
                          setRawInputError(`Validation errors:\n${errorData.errors.join('\n')}`)
                        } else {
                          setRawInputError(errorData.error || 'Failed to import transactions')
                        }
                        return
                      }
                      
                      const result = await response.json()
                      // Reload transactions and projections
                      await loadTransactions()
                      await loadProjections()
                      // Close dialog on success
                      setRawInputDialogOpen(false)
                      setRawInputTsv('')
                    } catch (error) {
                      setRawInputError(error instanceof Error ? error.message : 'Failed to import transactions')
                    } finally {
                      setRawInputLoading(false)
                    }
                  }}
                  disabled={rawInputLoading || !rawInputTsv.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rawInputLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
