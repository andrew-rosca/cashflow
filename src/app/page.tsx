'use client'

import { useState, useEffect } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import DateInput from '@/components/DateInput'

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
  
  // Dialog states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [isRecurringTransaction, setIsRecurringTransaction] = useState(false)
  const [transactionDate, setTransactionDate] = useState<Date>(new Date())
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null)

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
          `/api/projections?accountId=${account.id}&startDate=${format(today, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`
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
    // If it's a date, convert to Date object for DateInput
    if (cellId.includes('date')) {
      const dateValue = typeof currentValue === 'string' 
        ? new Date(currentValue + 'T00:00:00')
        : currentValue
      setEditValue(dateValue.toISOString().split('T')[0]) // Store as YYYY-MM-DD for compatibility
    } else {
      setEditValue(currentValue.toString())
    }
  }

  // Handler for date changes from DateInput component
  const handleDateChange = (date: Date) => {
    if (!editingCell) return
    const dateStr = format(date, 'yyyy-MM-dd')
    setEditValue(dateStr)
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const parts = editingCell.split('-')
    
    try {
      if (parts[0] === 'account' && parts[1] === 'date') {
        const accountId = parts[2]
        // Use date string directly (YYYY-MM-DD) to avoid timezone issues
        // Create date at local midnight to avoid timezone shifts
        const dateStr = editValue // Already in YYYY-MM-DD format from date input
        const localDate = new Date(dateStr + 'T00:00:00')
        await fetch(`/api/accounts/${accountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balanceAsOf: localDate.toISOString() }),
        })
        loadAccounts()
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
        loadTransactions()
      } else if (parts[0] === 'tx' && parts[1] === 'amount') {
        const txId = parts[2]
        const tx = transactions.find(t => t.id === txId)
        if (tx) {
          // Always store as positive amount in API
          const newAmount = Math.abs(parseFloat(editValue) || 0)
          await fetch(`/api/transactions/${txId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: newAmount }),
          })
          loadTransactions()
        }
      } else if (parts[0] === 'tx' && parts[1] === 'notes') {
        const txId = parts[2]
        await fetch(`/api/transactions/${txId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: editValue }),
        })
        loadTransactions()
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
      }
    } else {
      setSelectedTransactionId(null)
      setIsRecurringTransaction(false)
    }
    setTransactionDialogOpen(true)
  }

  const closeTransactionDialog = () => {
    setTransactionDialogOpen(false)
    setSelectedTransactionId(null)
    setIsRecurringTransaction(false)
    setTransactionDate(new Date())
    setRecurrenceEndDate(null)
  }

  const handleTransactionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    // Use transactionDate state (already a Date object)
    const payload: any = {
      fromAccountId: formData.get('fromAccountId') as string,
      toAccountId: formData.get('toAccountId') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: transactionDate.toISOString(),
      description: (formData.get('description') as string) || undefined,
    }

    if (formData.get('isRecurring') === 'on') {
      payload.recurrence = {
        frequency: formData.get('frequency') as string,
      }
      if (recurrenceEndDate) {
        payload.recurrence.endDate = recurrenceEndDate.toISOString()
      }
      if (formData.get('dayOfWeek')) {
        payload.recurrence.dayOfWeek = parseInt(formData.get('dayOfWeek') as string)
      }
      if (formData.get('dayOfMonth')) {
        payload.recurrence.dayOfMonth = parseInt(formData.get('dayOfMonth') as string)
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
      loadTransactions()
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
    // Parse date as local date to avoid timezone shifts
    let date: Date
    if (typeof dateStr === 'string') {
      // If it's an ISO string, extract just the date part and parse as local
      const dateOnly = dateStr.split('T')[0]
      date = new Date(dateOnly + 'T00:00:00')
    } else {
      date = dateStr
    }
    return format(date, 'MMM d')
  }
  
  // Helper to get date string in YYYY-MM-DD format from a date
  const getDateString = (date: Date | string): string => {
    if (typeof date === 'string') {
      // Extract date part from ISO string
      return date.split('T')[0]
    }
    // Format as YYYY-MM-DD in local timezone
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
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
    
    // If both are tracked accounts, it's a transfer - show as negative from source
    if (fromAccount && toAccount) {
      return -tx.amount
    }
    // If from tracked account, it's an outflow (negative)
    if (fromAccount) {
      return -tx.amount
    }
    // If to tracked account, it's an inflow (positive)
    if (toAccount) {
      return tx.amount
    }
    // Default to positive
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
      const previousDate = allDates[i - 1]
      
      // Check if any account's balance changed between these dates
      const hasChange = accounts.some(account => {
        const currentBalance = getProjectedBalance(account.id, currentDate)
        const previousBalance = getProjectedBalance(account.id, previousDate)
        
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
                  // Parse balanceAsOf as local date to avoid timezone issues
                  const balanceAsOf = account.balanceAsOf 
                    ? (() => {
                        if (typeof account.balanceAsOf === 'string') {
                          const dateOnly = account.balanceAsOf.split('T')[0]
                          return new Date(dateOnly + 'T00:00:00')
                        }
                        return account.balanceAsOf
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
                          value={editValue ? new Date(editValue + 'T00:00:00') : balanceAsOf}
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
                            onClick={() => handleCellClick(`tx-amount-${tx.id}`, Math.abs(getTransactionAmount(tx)).toString())}
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {selectedTransactionId ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From Account
                  </label>
                  <select
                    name="fromAccountId"
                    required
                    defaultValue={selectedTransaction?.fromAccountId || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select account...</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To Account
                  </label>
                  <select
                    name="toAccountId"
                    required
                    defaultValue={selectedTransaction?.toAccountId || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select account...</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
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
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency
                      </label>
                      <select
                        name="frequency"
                        defaultValue={selectedTransaction?.recurrence?.frequency || 'monthly'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    {isRecurringTransaction && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Day of Week (0=Sunday, 6=Saturday)
                        </label>
                        <input
                          type="number"
                          name="dayOfWeek"
                          min="0"
                          max="6"
                          defaultValue={selectedTransaction?.recurrence?.dayOfWeek || ''}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                    {isRecurringTransaction && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Day of Month (1-31)
                        </label>
                        <input
                          type="number"
                          name="dayOfMonth"
                          min="1"
                          max="31"
                          defaultValue={selectedTransaction?.recurrence?.dayOfMonth || ''}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Date (optional)
                      </label>
                      {recurrenceEndDate ? (
                        <>
                          <DateInput
                            value={recurrenceEndDate}
                            onChange={(date) => setRecurrenceEndDate(date)}
                            className="w-full"
                          />
                          <button
                            type="button"
                            onClick={() => setRecurrenceEndDate(null)}
                            className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Clear end date
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRecurrenceEndDate(new Date())}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                        >
                          Set end date
                        </button>
                      )}
                    </div>
                  </div>
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
