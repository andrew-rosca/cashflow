'use client'

import React, { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import DateInput from '@/components/DateInput'
import Tooltip from '@/components/Tooltip'
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
    dayOfWeek?: number | number[]
    dayOfMonth?: number | number[]
    interval?: number
    endDate?: string
    occurrences?: number
  }
}

interface ProjectionData {
  accountId: string
  date: string // Calendar date string (YYYY-MM-DD)
  balance: number
  previousBalance?: number // Balance on the previous day (if available)
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projections, setProjections] = useState<ProjectionData[]>([])
  const redirectingToLoginRef = useRef(false)
  const redirectToLogin = () => {
    if (redirectingToLoginRef.current) return
    if (typeof window === 'undefined') return
    redirectingToLoginRef.current = true
    const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }
  
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
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  
  // Number formatting preference (stored in user account)
  const [formatNumbersWithoutDecimals, setFormatNumbersWithoutDecimals] = useState(false)
  
  // Expanded rows state (track by date string)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Load accounts and user settings first
  useEffect(() => {
    loadAccounts()
    loadUserSettings()
  }, [])

  // Load transactions after accounts are loaded (so we can use earliest balanceAsOf date)
  useEffect(() => {
    if (accounts.length > 0) {
      loadTransactions()
    }
  }, [accounts])

  // Auto-load transactions when raw input dialog opens
  useEffect(() => {
    if (rawInputDialogOpen) {
      setRawInputError(null)
      setRawInputLoading(true)
      fetch('/api/transactions/bulk')
        .then(response => {
          if (response.status === 401) {
            redirectToLogin()
            throw new Error('Unauthorized')
          }
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
      if (response.status === 401) {
        redirectToLogin()
        return
      }
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

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings')
      if (response.status === 401) {
        redirectToLogin()
        return
      }
      if (!response.ok) {
        // If unauthorized or not found, use default settings (don't log error)
        if (response.status === 404) {
          setFormatNumbersWithoutDecimals(false)
          return
        }
        console.error('Failed to load user settings:', response.status, response.statusText)
        return
      }
      const data = await response.json()
      setFormatNumbersWithoutDecimals(data.formatNumbersWithoutDecimals ?? false)
    } catch (error) {
      // On error, use default settings (don't log - might be expected in some cases)
      setFormatNumbersWithoutDecimals(false)
    }
  }

  const loadTransactions = async () => {
    try {
      // Use UTC-based today for logical comparisons with server dates
      const today = LogicalDate.today()
      // Load transactions from the earliest account balance date to 365 days in the future
      // This ensures we include all transactions that affect projections
      const earliestBalanceAsOf = accounts.length > 0
        ? accounts.reduce((minDate, account) => {
            const accountBalanceDate = LogicalDate.fromString(
              typeof account.balanceAsOf === 'string' 
                ? account.balanceAsOf.split('T')[0]
                : account.balanceAsOf.toString().split('T')[0]
            )
            return minDate.compare(accountBalanceDate) < 0 ? minDate : accountBalanceDate
          }, today)
        : today
      const futureDate = today.addDays(365)
      const startDate = earliestBalanceAsOf.compare(today) < 0 ? earliestBalanceAsOf : today
      const response = await fetch(
        `/api/transactions?startDate=${startDate.toString()}&endDate=${futureDate.toString()}`
      )
      if (response.status === 401) {
        redirectToLogin()
        return
      }
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
      // Use UTC-based today for logical comparisons with server dates
      const today = LogicalDate.today()
      const endDate = today.addDays(90)
      
      if (accounts.length === 0) {
        setProjections([])
        return
      }

      // Use the earliest balanceAsOf date among all accounts as the start date
      // This ensures we include all transactions that affect the accounts
      const balanceAsOfToDateString = (balanceAsOf: string | Date): string => {
        if (typeof balanceAsOf === 'string') {
          // API returns balanceAsOf as string (YYYY-MM-DD or ISO)
          return balanceAsOf.split('T')[0]
        }
        // Date instance
        return balanceAsOf.toISOString().slice(0, 10)
      }

      const earliestBalanceAsOf = accounts.reduce((earliest, account) => {
        const balanceAsOf = LogicalDate.fromString(balanceAsOfToDateString(account.balanceAsOf))
        return earliest.compare(balanceAsOf) > 0 ? balanceAsOf : earliest
      }, LogicalDate.fromString(balanceAsOfToDateString(accounts[0].balanceAsOf)))
      
      // Start from 1 day before the earliest balanceAsOf to enable comparison for arrows
      const startDate = earliestBalanceAsOf.addDays(-1)

      // Get projections for all accounts
      const allProjections: ProjectionData[] = []
      for (const account of accounts) {
        const response = await fetch(
          `/api/projections?accountId=${account.id}&startDate=${startDate.toString()}&endDate=${endDate.toString()}&_t=${Date.now()}`,
          {
            cache: 'no-store',
          }
        )
        if (response.status === 401) {
          redirectToLogin()
          return
        }
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
        // Clear the ref after using it
        delete dateValueRef.current[editingCell]
        const response = await fetch(`/api/accounts/${accountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ balanceAsOf: dateStr }),
        })
        if (!response.ok) {
          console.error('Failed to save date:', response.status, response.statusText)
          return
        }
        await response.json()
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
        // Store exactly what the user entered - no transformation needed
        const amount = parseFloat(editValue) || 0
        await fetch(`/api/transactions/${txId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        })
        await loadTransactions()
        // Reload projections after transaction amount is updated
        if (accounts.length > 0) {
          await loadProjections()
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
      try {
        const lastAccountId = typeof localStorage !== 'undefined' ? localStorage.getItem('lastUsedAccountId') : null
        if (lastAccountId && accounts.find(a => a.id === lastAccountId)) {
          setTransactionAccountId(lastAccountId)
        } else if (accounts.length === 1) {
          setTransactionAccountId(accounts[0].id)
        } else {
          setTransactionAccountId('')
        }
      } catch (e) {
        // localStorage might not be available (e.g., in test environment)
        if (accounts.length === 1) {
          setTransactionAccountId(accounts[0].id)
        } else {
          setTransactionAccountId('')
        }
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
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lastUsedAccountId', transactionAccountId)
        }
      } catch (e) {
        // localStorage might not be available (e.g., in test environment)
      }
    }
    
    // Use transactionDate state - convert to calendar date string (YYYY-MM-DD)
    // Get the form amount - for new transactions, this is what the user entered
    // For editing, this is the displayed amount (which may have been transformed by getTransactionAmount)
    let formAmount = parseFloat(formData.get('amount') as string)
    
    if (isNaN(formAmount)) {
      formAmount = 0
    }
    
    // Store exactly what the user entered - no transformation needed
    // The amount is displayed as stored, so we just use the form value directly
    const storageAmount = formAmount
    
    const payload: any = {
      fromAccountId: transactionAccountId,
      toAccountId: transactionAccountId, // For now, use same account (transfers will be added later)
      amount: storageAmount,
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
    const rounded = formatNumbersWithoutDecimals ? Math.round(amount) : amount
    const formatted = formatNumbersWithoutDecimals 
      ? rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return formatted
  }
  
  const handleFormatPreferenceChange = async (value: boolean) => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formatNumbersWithoutDecimals: value }),
      })
      if (!response.ok) {
        console.error('Failed to update user settings:', response.status, response.statusText)
        return
      }
      const data = await response.json()
      setFormatNumbersWithoutDecimals(data.formatNumbersWithoutDecimals)
    } catch (error) {
      console.error('Error updating user settings:', error)
    }
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
  // Display the amount exactly as stored - preserve user's intent
  // Helper to format dayOfMonth for display
  const formatDayOfMonth = (dayOfMonth: number | number[] | undefined): string => {
    if (!dayOfMonth) return ''
    if (Array.isArray(dayOfMonth)) {
      if (dayOfMonth.length === 0) return ''
      if (dayOfMonth.length === 1) return dayOfMonth[0].toString()
      return dayOfMonth.join(', ')
    }
    return dayOfMonth.toString()
  }

  // Helper to get first day of month (for calculations that need a single day)
  const getFirstDayOfMonth = (dayOfMonth: number | number[] | string | undefined): number | undefined => {
    if (!dayOfMonth) return undefined
    
    // Handle string (legacy format or API returning string)
    if (typeof dayOfMonth === 'string') {
      const num = parseInt(dayOfMonth, 10)
      if (isNaN(num) || !isFinite(num)) return undefined
      return num
    }
    
    if (Array.isArray(dayOfMonth)) {
      if (dayOfMonth.length === 0) return undefined
      const first = dayOfMonth[0]
      // Handle string in array
      if (typeof first === 'string') {
        const num = parseInt(first, 10)
        if (isNaN(num) || !isFinite(num)) return undefined
        return num
      }
      if (typeof first !== 'number' || isNaN(first) || !isFinite(first)) return undefined
      return first
    }
    if (typeof dayOfMonth !== 'number' || isNaN(dayOfMonth) || !isFinite(dayOfMonth)) return undefined
    return dayOfMonth
  }

  // Helper to format dayOfWeek for display
  const formatDayOfWeek = (dayOfWeek: number | number[] | undefined): string => {
    if (!dayOfWeek) return ''
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    if (Array.isArray(dayOfWeek)) {
      if (dayOfWeek.length === 0) return ''
      if (dayOfWeek.length === 1) return DAY_NAMES[dayOfWeek[0]] || dayOfWeek[0].toString()
      return dayOfWeek.map(d => DAY_NAMES[d] || d.toString()).join(', ')
    }
    return DAY_NAMES[dayOfWeek] || dayOfWeek.toString()
  }

  // Helper to get first day of week (for calculations that need a single day)
  const getFirstDayOfWeek = (dayOfWeek: number | number[] | string | undefined): number | undefined => {
    if (!dayOfWeek) return undefined
    
    // Handle string (legacy format or API returning string)
    if (typeof dayOfWeek === 'string') {
      const num = parseInt(dayOfWeek, 10)
      if (isNaN(num) || !isFinite(num)) return undefined
      return num
    }
    
    if (Array.isArray(dayOfWeek)) {
      if (dayOfWeek.length === 0) return undefined
      const first = dayOfWeek[0]
      // Handle string in array
      if (typeof first === 'string') {
        const num = parseInt(first, 10)
        if (isNaN(num) || !isFinite(num)) return undefined
        return num
      }
      if (typeof first !== 'number' || isNaN(first) || !isFinite(first)) return undefined
      return first
    }
    if (typeof dayOfWeek !== 'number' || isNaN(dayOfWeek) || !isFinite(dayOfWeek)) return undefined
    return dayOfWeek
  }

  // Format tooltip text for transaction icon
  const getTransactionTooltip = (tx: Transaction): string => {
    // Get account name - use fromAccount (primary account for the transaction)
    const account = accounts.find(a => a.id === tx.fromAccountId)
    const accountName = account?.name || 'Unknown Account'
    
    if (tx.recurrence) {
      const { frequency, interval = 1, dayOfWeek, dayOfMonth } = tx.recurrence
      let pattern = ''
      
      switch (frequency) {
        case 'daily':
          pattern = interval === 1 ? 'daily' : `every ${interval} days`
          break
        case 'weekly':
          if (dayOfWeek) {
            const dayStr = formatDayOfWeek(dayOfWeek)
            pattern = interval === 1 ? `weekly on ${dayStr}` : `every ${interval} weeks on ${dayStr}`
          } else {
            pattern = interval === 1 ? 'weekly' : `every ${interval} weeks`
          }
          break
        case 'monthly':
          if (dayOfMonth) {
            const dayStr = formatDayOfMonth(dayOfMonth)
            pattern = interval === 1 ? `monthly on day ${dayStr}` : `every ${interval} months on day ${dayStr}`
          } else {
            pattern = interval === 1 ? 'monthly' : `every ${interval} months`
          }
          break
        case 'yearly':
          pattern = interval === 1 ? 'yearly' : `every ${interval} years`
          break
      }
      
      return `${accountName}, ${pattern}`
    } else {
      return `${accountName}, one-time`
    }
  }

  const getTransactionAmount = (tx: Transaction): number => {
    // Display the amount as stored - no transformation
    // The sign reflects the user's intent when they entered the transaction
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

  // Get the previous balance for an account from projection data
  const getPreviousBalance = (accountId: string, date: LogicalDate): number | null => {
    const dateStr = date instanceof LogicalDate ? date.toString() : date
    const projection = projections.find(
      p => {
        // API returns date as string (YYYY-MM-DD)
        return p.accountId === accountId && p.date === dateStr
      }
    )
    return projection?.previousBalance ?? null
  }

  // Get all unique dates from projections
  const getAllProjectionDates = (): LogicalDate[] => {
    const dateSet = new Set<string>()
    projections.forEach(p => {
      // API returns date as string (YYYY-MM-DD)
      dateSet.add(p.date)
    })
    // Convert to LogicalDate objects and sort
    // Defensive: if any projection date is malformed (e.g. YYYY-00-DD), Temporal will throw.
    const dates: LogicalDate[] = []
    Array.from(dateSet).forEach((d) => {
      try {
        dates.push(LogicalDate.fromString(d))
      } catch (e) {
        console.error('Invalid projection date returned from API:', d, e)
      }
    })
    return dates.sort((a, b) => a.compare(b))
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

  // Toggle row expansion
  const toggleRowExpansion = (date: LogicalDate) => {
    const dateStr = date.toString()
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) {
        next.delete(dateStr)
      } else {
        next.add(dateStr)
      }
      return next
    })
  }

  // Check if a date matches a recurring transaction occurrence
  const isRecurringOccurrenceOnDate = (tx: Transaction, targetDate: LogicalDate): boolean => {
    if (!tx.recurrence) return false

    const { frequency, interval = 1, dayOfWeek, dayOfMonth, endDate } = tx.recurrence
    let startDate = LogicalDate.fromString(tx.date)
    
    // For weekly recurrences with dayOfWeek, adjust the start date to the correct day of week
    if (frequency === 'weekly' && dayOfWeek !== undefined && dayOfWeek !== null) {
      const firstDay = getFirstDayOfWeek(dayOfWeek)
      if (firstDay !== undefined) {
        const startDayOfWeek = startDate.dayOfWeek
        if (startDayOfWeek !== firstDay) {
          // Find the next occurrence of the target day of week
          let daysToAdd = firstDay - startDayOfWeek
          if (daysToAdd < 0) {
            daysToAdd += 7
          }
          startDate = startDate.addDays(daysToAdd)
        }
      }
    }
    
    // Check if target date is before start date
    if (targetDate.compare(startDate) < 0) return false
    
    // Check if target date is after end date
    if (endDate) {
      const endDateObj = LogicalDate.fromString(endDate)
      if (targetDate.compare(endDateObj) > 0) return false
    }

    // Check if target date matches the start date
    if (targetDate.toString() === startDate.toString()) return true

    // Calculate occurrences to see if target date matches
    let currentDate = startDate
    let iterations = 0
    const maxIterations = 10000

    while (currentDate.compare(targetDate) <= 0 && iterations < maxIterations) {
      iterations++
      
      if (currentDate.toString() === targetDate.toString()) {
        return true
      }

      // Calculate next occurrence
      switch (frequency) {
        case 'daily':
          currentDate = currentDate.addDays(interval)
          break
        case 'weekly':
          // Add the interval weeks
          currentDate = currentDate.addDays(7 * interval)
          // If dayOfWeek is specified, adjust to that day of week
          if (dayOfWeek !== undefined && dayOfWeek !== null) {
            const firstDay = getFirstDayOfWeek(dayOfWeek)
            if (firstDay !== undefined) {
              const currentDayOfWeek = currentDate.dayOfWeek
              let daysToAdd = firstDay - currentDayOfWeek
              // If the target day is earlier in the week, add 7 days to wrap around
              if (daysToAdd < 0) {
                daysToAdd += 7
              }
              // If daysToAdd is 0, we're already on the correct day
              if (daysToAdd > 0) {
                currentDate = currentDate.addDays(daysToAdd)
              }
            }
            // For multiple days, check if target date matches any day in the array
            const daysToCheck = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]
            if (daysToCheck.includes(targetDate.dayOfWeek) && 
                currentDate.year === targetDate.year && 
                currentDate.month === targetDate.month &&
                Math.abs(currentDate.day - targetDate.day) < 7) {
              return true
            }
          }
          break
        case 'monthly':
          currentDate = currentDate.addMonths(interval)
          if (dayOfMonth !== undefined && dayOfMonth !== null) {
            const daysInMonth = currentDate.daysInMonth
            const firstDay = getFirstDayOfMonth(dayOfMonth)
            if (firstDay !== undefined) {
              const targetDay = Math.min(firstDay, daysInMonth)
              // Validate targetDay before creating date
              if (!isNaN(targetDay) && isFinite(targetDay) && targetDay >= 1 && targetDay <= daysInMonth) {
                currentDate = LogicalDate.from(currentDate.year, currentDate.month, targetDay)
              }
            }
            // For multiple days, check if target date matches any day in the array
            const daysToCheck = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]
            if (currentDate.year === targetDate.year && currentDate.month === targetDate.month) {
              const targetDay = Math.min(targetDate.day, daysInMonth)
              if (daysToCheck.some(day => {
                const dayNum = typeof day === 'string' ? parseInt(day, 10) : day
                if (isNaN(dayNum) || !isFinite(dayNum)) return false
                return Math.min(dayNum, daysInMonth) === targetDay
              })) {
                return true
              }
            }
          }
          break
        case 'yearly':
          currentDate = currentDate.addYears(interval)
          break
      }

      // Check if we've exceeded the end date
      if (endDate) {
        const endDateObj = LogicalDate.fromString(endDate)
        if (currentDate.compare(endDateObj) > 0) break
      }

      // If we've passed the target date, no match
      if (currentDate.compare(targetDate) > 0) break
    }

    return false
  }

  // Get transactions affecting an account on a specific date
  const getTransactionsForAccountOnDate = (accountId: string, date: LogicalDate): Array<{ transaction: Transaction; amount: number }> => {
    const result: Array<{ transaction: Transaction; amount: number }> = []
    const dateStr = date.toString()

    for (const tx of transactions) {
      const txDate = LogicalDate.fromString(tx.date)
      const settlementDays = tx.settlementDays || 0
      const creditDate = txDate.addDays(settlementDays)

      // For recurring transactions, check if this date matches an occurrence
      const isOccurrenceOnDate = tx.recurrence ? isRecurringOccurrenceOnDate(tx, date) : false
      const matchesBaseDate = txDate.toString() === dateStr

      // Check if this transaction affects the account on this date
      if (tx.fromAccountId === tx.toAccountId) {
        // Same account transaction - affects on transaction date (or occurrence date for recurring)
        if ((matchesBaseDate || isOccurrenceOnDate) && (tx.fromAccountId === accountId || tx.toAccountId === accountId)) {
          result.push({ transaction: tx, amount: tx.amount })
        }
      } else {
        // Different accounts - debit on tx.date, credit on creditDate
        // For recurring, we need to calculate the occurrence dates
        if (tx.recurrence) {
          // For recurring transactions, check if this date matches a debit or credit occurrence
          if (tx.fromAccountId === accountId && isOccurrenceOnDate) {
            // Debit (negative) - occurs on the occurrence date
            const debitAmount = tx.amount < 0 ? tx.amount : -tx.amount
            result.push({ transaction: tx, amount: debitAmount })
          }
          if (tx.toAccountId === accountId) {
            // Credit occurs on occurrence date + settlement days
            const creditOccurrenceDate = date.addDays(-settlementDays)
            if (isRecurringOccurrenceOnDate(tx, creditOccurrenceDate)) {
              // Credit (positive)
              const creditAmount = tx.amount < 0 ? -tx.amount : tx.amount
              result.push({ transaction: tx, amount: creditAmount })
            }
          }
        } else {
          // One-time transaction
          if (tx.fromAccountId === accountId && matchesBaseDate) {
            // Debit (negative)
            const debitAmount = tx.amount < 0 ? tx.amount : -tx.amount
            result.push({ transaction: tx, amount: debitAmount })
          }
          if (tx.toAccountId === accountId && creditDate.toString() === dateStr) {
            // Credit (positive)
            const creditAmount = tx.amount < 0 ? -tx.amount : tx.amount
            result.push({ transaction: tx, amount: creditAmount })
          }
        }
      }
    }

    return result
  }

  // Helper function to calculate next occurrence date for recurring transactions
  const getNextOccurrenceDate = (tx: Transaction): LogicalDate => {
    if (!tx.recurrence) return LogicalDate.fromString(tx.date)
    
    // Use UTC-based today for logical comparisons with server dates
    const today = LogicalDate.today()
    const { frequency, interval = 1, dayOfWeek, dayOfMonth, endDate } = tx.recurrence
    let currentDate = LogicalDate.fromString(tx.date)
    
    // For weekly recurrences with dayOfWeek, adjust the start date to the correct day of week
    if (frequency === 'weekly' && dayOfWeek !== undefined && dayOfWeek !== null) {
      const firstDay = getFirstDayOfWeek(dayOfWeek)
      if (firstDay !== undefined) {
        const startDayOfWeek = currentDate.dayOfWeek
        if (startDayOfWeek !== firstDay) {
          // Find the next occurrence of the target day of week
          let daysToAdd = firstDay - startDayOfWeek
          if (daysToAdd < 0) {
            daysToAdd += 7
          }
          currentDate = currentDate.addDays(daysToAdd)
        }
      }
    }
    
    
    // For monthly recurring with dayOfMonth, we need special handling:
    // The dayOfMonth should be used for all occurrences, not the base date's day
    if (frequency === 'monthly' && dayOfMonth !== undefined && dayOfMonth !== null) {
      // Get the first day for next occurrence calculation
      const firstDay = getFirstDayOfMonth(dayOfMonth)
      if (firstDay === undefined) {
        return LogicalDate.fromString(tx.date)
      }
      
      // First, check if the dayOfMonth in the base month is still in the future
      const baseYear = currentDate.year
      const baseMonth = currentDate.month
      const daysInBaseMonth = LogicalDate.from(baseYear, baseMonth, 1).daysInMonth
      const targetDayInBaseMonth = Math.min(firstDay, daysInBaseMonth)
      // Validate targetDay before creating date
      if (isNaN(targetDayInBaseMonth) || !isFinite(targetDayInBaseMonth) || targetDayInBaseMonth < 1 || targetDayInBaseMonth > daysInBaseMonth) {
        return LogicalDate.fromString(tx.date)
      }
      let occurrenceDate = LogicalDate.from(baseYear, baseMonth, targetDayInBaseMonth)
      
      // If the occurrence in the base month is today or in the future, use it
      if (occurrenceDate.compare(today) >= 0) {
        // Check end date
        if (endDate) {
          const endDateObj = LogicalDate.fromString(endDate)
          if (occurrenceDate.compare(endDateObj) > 0) {
            return LogicalDate.fromString(tx.date)
          }
        }
        return occurrenceDate
      }
      
      // Otherwise, find the next month where dayOfMonth is in the future
      currentDate = currentDate.addMonths(interval)
      let iterations = 0
      const maxIterations = 10000
      
      while (iterations < maxIterations) {
        const daysInMonth = currentDate.daysInMonth
        const targetDay = Math.min(firstDay, daysInMonth)
        // Validate targetDay before creating date
        if (isNaN(targetDay) || !isFinite(targetDay) || targetDay < 1 || targetDay > daysInMonth) {
          break
        }
        occurrenceDate = LogicalDate.from(currentDate.year, currentDate.month, targetDay)
        
        // Check if this occurrence is today or in the future
        if (occurrenceDate.compare(today) >= 0) {
          // Check end date
          if (endDate) {
            const endDateObj = LogicalDate.fromString(endDate)
            if (occurrenceDate.compare(endDateObj) > 0) {
              return LogicalDate.fromString(tx.date)
            }
          }
          return occurrenceDate
        }
        
        // Advance to next month
        currentDate = currentDate.addMonths(interval)
        iterations++
      }
      
      // Fallback
      return LogicalDate.fromString(tx.date)
    }
    
    // If the start date is today or in the future, that's the next occurrence
    if (currentDate.compare(today) >= 0) {
      return currentDate
    }
    
    // Find the next occurrence after today
    let iterations = 0
    const maxIterations = 10000 // Safety check to prevent infinite loops
    
    while (currentDate.compare(today) < 0 && iterations < maxIterations) {
      iterations++
      
      switch (frequency) {
        case 'daily':
          currentDate = currentDate.addDays(interval)
          break
        case 'weekly':
          currentDate = currentDate.addDays(7 * interval)
          // If dayOfWeek is specified, adjust to that day of week
          if (dayOfWeek !== undefined && dayOfWeek !== null) {
            const firstDay = getFirstDayOfWeek(dayOfWeek)
            if (firstDay !== undefined) {
              const currentDayOfWeek = currentDate.dayOfWeek
              let daysToAdd = firstDay - currentDayOfWeek
              if (daysToAdd < 0) {
                daysToAdd += 7
              }
              if (daysToAdd > 0) {
                currentDate = currentDate.addDays(daysToAdd)
              }
            }
          }
          break
        case 'monthly':
          currentDate = currentDate.addMonths(interval)
          if (dayOfMonth !== undefined && dayOfMonth !== null) {
            // Set to specific day of month, handling month-end edge cases
            const daysInMonth = currentDate.daysInMonth
            const firstDay = getFirstDayOfMonth(dayOfMonth)
            if (firstDay !== undefined) {
              const targetDay = Math.min(firstDay, daysInMonth)
              // Validate targetDay before creating date
              if (!isNaN(targetDay) && isFinite(targetDay) && targetDay >= 1 && targetDay <= daysInMonth) {
                currentDate = LogicalDate.from(currentDate.year, currentDate.month, targetDay)
              }
            }
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
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 w-full">
              <div className="flex items-center justify-between mb-3 min-w-0">
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
                      className="grid grid-cols-[minmax(80px,1fr)_max-content_max-content] items-center gap-x-2 gap-y-1 py-1 px-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors w-full"
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
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-shrink-0 whitespace-nowrap"
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
                          className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 text-right w-24"
                        />
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <span 
                            className="text-sm font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded text-right text-gray-900 dark:text-gray-100"
                            onClick={() => handleCellClick(`account-balance-${account.id}`, account.initialBalance.toString())}
                          >
                            {formatNumber(account.initialBalance)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Upcoming Transactions */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 w-full">
              <div className="flex items-center justify-between mb-3 min-w-0">
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
                        <Tooltip content={accounts.length > 0 ? getTransactionTooltip(tx) : ''}>
                          <svg 
                            className="w-3.5 h-3.5 text-blue-500 cursor-pointer hover:text-blue-600 flex-shrink-0" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                            onClick={() => openTransactionDialog(tx.id)}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </Tooltip>
                        <span 
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded whitespace-nowrap flex-shrink-0"
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          {formatDate(tx.date)}
                        </span>
                        {editingCell === `tx-notes-${tx.id}` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 flex-1 min-w-0 h-5 leading-5"
                          />
                        ) : (
                          <span 
                            className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-1 min-w-0 truncate h-5 leading-5 inline-block"
                            onClick={() => handleCellClick(`tx-notes-${tx.id}`, tx.description || '')}
                          >
                            {tx.description || <span className="text-gray-400 dark:text-gray-600">—</span>}
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
                            className="text-sm font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded text-gray-900 dark:text-gray-100"
                            onClick={() => handleCellClick(`tx-amount-${tx.id}`, getTransactionAmount(tx).toString())}
                          >
                            {formatNumber(getTransactionAmount(tx))}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Tooltip content={accounts.length > 0 ? getTransactionTooltip(tx) : ''}>
                          <svg 
                            className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                            onClick={() => openTransactionDialog(tx.id)}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </Tooltip>
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
                            className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 flex-1 min-w-0 h-5 leading-5"
                          />
                        ) : (
                          <span 
                            className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded flex-1 min-w-0 truncate h-5 leading-5 inline-block"
                            onClick={() => handleCellClick(`tx-notes-${tx.id}`, tx.description || '')}
                          >
                            {tx.description || <span className="text-gray-400 dark:text-gray-600">—</span>}
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
                            className="text-sm font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded text-gray-900 dark:text-gray-100"
                            onClick={() => handleCellClick(`tx-amount-${tx.id}`, getTransactionAmount(tx).toString())}
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

            {/* Settings and Help icons */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setSettingsDialogOpen(true)}
                className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <a
                href="mailto:cashflow@brasslogic.money"
                className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2"
                title="Help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right side - Projection table */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden justify-self-start w-fit max-w-full min-w-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="text-left py-2 px-4 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs whitespace-nowrap min-w-[200px]">
                      Date
                    </th>
                    {accounts.map(account => (
                      <th
                        key={account.id}
                        className="text-right py-2 px-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap"
                      >
                        {account.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectionDates.map((date, idx) => {
                    const dateStr = date.toString()
                    const isExpanded = expandedRows.has(dateStr)
                    // Check if any account has a negative balance on this date
                    const hasNegativeBalance = accounts.some(account => {
                      const balance = getProjectedBalance(account.id, date)
                      return balance !== null && balance < 0
                    })
                    return (
                      <React.Fragment key={dateStr}>
                        <tr
                          className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${
                            hasNegativeBalance 
                              ? 'bg-orange-100/60 dark:bg-orange-900/30' 
                              : idx % 5 === 0 
                                ? 'bg-gray-50 dark:bg-gray-900/50' 
                                : ''
                          }`}
                          onClick={() => toggleRowExpansion(date)}
                        >
                          <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap min-w-[200px]">
                            {formatDate(date)}
                          </td>
                          {accounts.map(account => {
                            const balance = getProjectedBalance(account.id, date)
                            const projection = projections.find(
                              p => p.accountId === account.id && p.date === dateStr
                            )
                            const previousBalance = projection?.previousBalance
                            
                            return (
                              <td
                                key={account.id}
                                className="py-2 px-4 text-right font-mono whitespace-nowrap"
                              >
                                {balance !== null ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-gray-900 dark:text-gray-100">
                                      {formatNumber(balance)}
                                    </span>
                                    <span 
                                      className={`inline-flex items-center text-sm ${
                                        previousBalance !== undefined && previousBalance !== null && balance !== previousBalance
                                          ? (balance > previousBalance ? 'text-green-600/80 dark:text-green-400/80' : 'text-red-600/80 dark:text-red-400/80')
                                          : 'text-transparent'
                                      }`}
                                      title={previousBalance !== undefined && previousBalance !== null && balance !== previousBalance 
                                        ? (balance > previousBalance ? `Increased from ${formatNumber(previousBalance)}` : `Decreased from ${formatNumber(previousBalance)}`)
                                        : ''}
                                    >
                                      {previousBalance !== undefined && previousBalance !== null && balance !== previousBalance 
                                        ? (balance > previousBalance ? '↑' : '↓')
                                        : '↑' // Invisible placeholder for alignment
                                      }
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-600">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                        {isExpanded && (
                          <>
                            {accounts.map(account => {
                              const accountTransactions = getTransactionsForAccountOnDate(account.id, date)
                              if (accountTransactions.length === 0) return null
                              
                              return accountTransactions.map(({ transaction, amount }) => (
                                <tr 
                                  key={`${account.id}-${transaction.id}`} 
                                  className={`border-b border-gray-100 dark:border-gray-800 ${
                                    hasNegativeBalance 
                                      ? 'bg-orange-100/50 dark:bg-orange-900/40' 
                                      : 'bg-gray-50/40 dark:bg-gray-800/30'
                                  }`} 
                                  data-expanded-row="true"
                                >
                                  <td className="py-2 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[200px]">
                                    <div className="flex items-center gap-1 pl-6 text-xs">
                                      {transaction.recurrence ? (
                                        <Tooltip content={accounts.length > 0 ? getTransactionTooltip(transaction) : ''}>
                                          <svg 
                                            className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip content={accounts.length > 0 ? getTransactionTooltip(transaction) : ''}>
                                          <svg 
                                            className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </Tooltip>
                                      )}
                                      <span className="text-gray-500 dark:text-gray-400">
                                        {transaction.description || <span className="text-gray-400 dark:text-gray-500">—</span>}
                                      </span>
                                    </div>
                                  </td>
                                  {accounts.map(acc => (
                                    <td
                                      key={acc.id}
                                      className="py-2 px-4 text-right font-mono whitespace-nowrap text-xs"
                                    >
                                      {acc.id === account.id ? (
                                        <span className="text-gray-500 dark:text-gray-400">
                                          {formatNumber(amount)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 dark:text-gray-600">—</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            })}
                          </>
                        )}
                      </React.Fragment>
                    )
                  })}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeTransactionDialog}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col max-h-[90vh] w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
              <div className="overflow-y-auto px-6 py-4 flex-1">
                <form id="transaction-form" onSubmit={handleTransactionSubmit} className="space-y-4">
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
                    defaultValue={selectedTransaction ? getTransactionAmount(selectedTransaction) : ''}
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
                </form>
              </div>
              <div className="flex gap-2 p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeTransactionDialog}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="transaction-form"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {selectedTransactionId ? 'Save' : 'Add'}
                </button>
              </div>
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

        {/* Settings Dialog */}
        {settingsDialogOpen && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSettingsDialogOpen(false)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Settings
                </h3>
                <button
                  type="button"
                  onClick={() => setSettingsDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Number Formatting Option */}
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                      Format numbers without decimals
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Round values and use comma separators
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFormatPreferenceChange(!formatNumbersWithoutDecimals)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      formatNumbersWithoutDecimals ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                    role="switch"
                    aria-checked={formatNumbersWithoutDecimals}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formatNumbersWithoutDecimals ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    await signOut({ callbackUrl: '/login' })
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
