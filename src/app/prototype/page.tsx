'use client'

import { useState } from 'react'

// Dummy data types
interface Account {
  id: string
  name: string
  balance: number
  balanceAsOf: string
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  account: string
  isRecurring: boolean
}

const initialAccounts: Account[] = [
  { id: '1', name: 'Checking', balance: 2500.00, balanceAsOf: '2025-01-15' },
  { id: '2', name: 'Savings', balance: 15000.00, balanceAsOf: '2025-01-10' },
  { id: '3', name: 'Credit Card', balance: -850.00, balanceAsOf: '2025-01-12' },
]

const initialTransactions: Transaction[] = [
  { id: '1', date: '2025-01-20', description: 'Salary', amount: 5000, account: 'Checking', isRecurring: true },
  { id: '2', date: '2025-01-22', description: 'Rent', amount: -1500, account: 'Checking', isRecurring: true },
  { id: '3', date: '2025-01-25', description: 'Groceries', amount: -120, account: 'Checking', isRecurring: false },
  { id: '4', date: '2025-02-01', description: 'Electric Bill', amount: -85, account: 'Checking', isRecurring: true },
  { id: '5', date: '2025-02-05', description: 'Coffee', amount: -4.50, account: 'Checking', isRecurring: false },
]

const dummyProjectionDates = [
  '2025-01-15',
  '2025-01-20',
  '2025-01-22',
  '2025-01-25',
  '2025-02-01',
  '2025-02-05',
  '2025-02-10',
  '2025-02-15',
  '2025-02-20',
]

export default function PrototypePage() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  
  // Dialog states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [isRecurringTransaction, setIsRecurringTransaction] = useState(false)

  const handleCellClick = (cellId: string, currentValue: string) => {
    setEditingCell(cellId)
    setEditValue(currentValue)
  }

  const handleCellBlur = () => {
    if (editingCell) {
      // Parse the cell id to determine what to update
      const parts = editingCell.split('-')
      
      if (parts[0] === 'account' && parts[1] === 'date') {
        // Update account balanceAsOf
        const accountId = parts[2]
        setAccounts(accounts.map(a => 
          a.id === accountId ? { ...a, balanceAsOf: editValue } : a
        ))
      } else if (parts[0] === 'account' && parts[1] === 'balance') {
        // Update account balance
        const accountId = parts[2]
        setAccounts(accounts.map(a => 
          a.id === accountId ? { ...a, balance: parseFloat(editValue) || 0 } : a
        ))
      } else if (parts[0] === 'tx' && parts[1] === 'date') {
        // Update transaction date
        const txId = parts[2]
        setTransactions(transactions.map(tx => 
          tx.id === txId ? { ...tx, date: editValue } : tx
        ))
      } else if (parts[0] === 'tx' && parts[1] === 'amount') {
        // Update transaction amount
        const txId = parts[2]
        setTransactions(transactions.map(tx => 
          tx.id === txId ? { ...tx, amount: parseFloat(editValue) || 0 } : tx
        ))
      } else if (parts[0] === 'tx' && parts[1] === 'notes') {
        // Update transaction description
        const txId = parts[2]
        setTransactions(transactions.map(tx => 
          tx.id === txId ? { ...tx, description: editValue } : tx
        ))
      }
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

  const formatNumber = (amount: number) => {
    return amount.toFixed(2)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Calculate projected balances (simplified - just showing structure)
  const calculateProjectedBalance = (accountId: string, date: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return 0
    // This is dummy logic - just for visualization
    const baseBalance = account.balance
    const randomVariation = Math.random() * 1000 - 500
    return baseBalance + randomVariation
  }

  const openAccountDialog = (accountId: string) => {
    setSelectedAccountId(accountId)
    setAccountDialogOpen(true)
  }

  const closeAccountDialog = () => {
    setAccountDialogOpen(false)
    setSelectedAccountId(null)
  }

  const handleAccountNameChange = (newName: string) => {
    if (selectedAccountId) {
      setAccounts(accounts.map(a => 
        a.id === selectedAccountId ? { ...a, name: newName } : a
      ))
    }
    closeAccountDialog()
  }

  const handleAccountDelete = () => {
    if (selectedAccountId) {
      setAccounts(accounts.filter(a => a.id !== selectedAccountId))
    }
    closeAccountDialog()
  }

  const handleAddAccount = () => {
    const newAccount: Account = {
      id: Date.now().toString(),
      name: 'New Account',
      balance: 0,
      balanceAsOf: new Date().toISOString().split('T')[0]
    }
    setAccounts([...accounts, newAccount])
  }

  const openTransactionDialog = (transactionId?: string) => {
    if (transactionId) {
      const tx = transactions.find(t => t.id === transactionId)
      if (tx) {
        setSelectedTransactionId(transactionId)
        setIsRecurringTransaction(tx.isRecurring)
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
  }

  const handleAddTransaction = (data: Partial<Transaction>) => {
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: data.date || new Date().toISOString().split('T')[0],
      description: data.description || '',
      amount: data.amount || 0,
      account: data.account || 'Checking',
      isRecurring: data.isRecurring || false
    }
    setTransactions([...transactions, newTransaction])
    closeTransactionDialog()
  }

  const handleUpdateTransaction = (data: Partial<Transaction>) => {
    if (selectedTransactionId) {
      setTransactions(transactions.map(tx => 
        tx.id === selectedTransactionId ? { ...tx, ...data } : tx
      ))
    }
    closeTransactionDialog()
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-[auto_1fr] gap-8">
          {/* Left sidebar - Account balances and transactions */}
          <div className="space-y-6 w-80">
            {/* Starting account balances */}
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
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 py-1 px-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <span 
                      className="text-xs text-gray-400 dark:text-gray-500 min-w-[80px] cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => openAccountDialog(account.id)}
                    >
                      {account.name}
                    </span>
                    {editingCell === `account-date-${account.id}` ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 w-20"
                      />
                    ) : (
                      <span 
                        className="text-xs text-gray-500 dark:text-gray-400 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                        onClick={() => handleCellClick(`account-date-${account.id}`, account.balanceAsOf)}
                      >
                        {formatDate(account.balanceAsOf)}
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
                        className={`text-sm font-mono ml-auto cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${account.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}
                        onClick={() => handleCellClick(`account-balance-${account.id}`, account.balance.toString())}
                      >
                        {formatNumber(account.balance)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming transactions */}
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
                {transactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-2 py-1 px-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    {tx.isRecurring ? (
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
                          {tx.description}
                        </span>
                        <span 
                          className={`text-sm font-mono cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}
                          onClick={() => openTransactionDialog(tx.id)}
                        >
                          {formatNumber(tx.amount)}
                        </span>
                      </>
                    ) : (
                      <>
                        {editingCell === `tx-date-${tx.id}` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 w-20"
                          />
                        ) : (
                          <span 
                            className="text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded"
                            onClick={() => handleCellClick(`tx-date-${tx.id}`, tx.date)}
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
                            onClick={() => handleCellClick(`tx-notes-${tx.id}`, tx.description)}
                          >
                            {tx.description}
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
                            className={`text-sm font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 px-1 rounded ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}
                            onClick={() => handleCellClick(`tx-amount-${tx.id}`, tx.amount.toString())}
                          >
                            {formatNumber(tx.amount)}
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
                  {dummyProjectionDates.map((date, idx) => (
                    <tr
                      key={date}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        idx % 5 === 0 ? 'bg-gray-25 dark:bg-gray-900/50' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-400 font-medium">
                        {formatDate(date)}
                      </td>
                      {accounts.map(account => {
                        const balance = calculateProjectedBalance(account.id, date)
                        return (
                          <td
                            key={account.id}
                            className="py-2 px-4 text-right font-mono cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <span className={balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}>
                              {formatNumber(balance)}
                            </span>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Edit Account
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    defaultValue={accounts.find(a => a.id === selectedAccountId)?.name}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAccountNameChange(e.currentTarget.value)
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={closeAccountDialog}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAccountDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Dialog */}
        {transactionDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {selectedTransactionId ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const data = {
                    date: formData.get('date') as string,
                    description: formData.get('description') as string,
                    amount: parseFloat(formData.get('amount') as string),
                    account: formData.get('account') as string,
                    isRecurring: formData.get('isRecurring') === 'on'
                  }
                  if (selectedTransactionId) {
                    handleUpdateTransaction(data)
                  } else {
                    handleAddTransaction(data)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={selectedTransactionId ? transactions.find(t => t.id === selectedTransactionId)?.date : ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    defaultValue={selectedTransactionId ? transactions.find(t => t.id === selectedTransactionId)?.amount : ''}
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
                    defaultValue={selectedTransactionId ? transactions.find(t => t.id === selectedTransactionId)?.description : ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account
                  </label>
                  <select
                    name="account"
                    defaultValue={selectedTransactionId ? transactions.find(t => t.id === selectedTransactionId)?.account : 'Checking'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {accounts.map(account => (
                      <option key={account.id} value={account.name}>
                        {account.name}
                      </option>
                    ))}
                  </select>
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Date (optional)
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
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
