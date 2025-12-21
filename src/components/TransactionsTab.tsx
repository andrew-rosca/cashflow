'use client'

import { useState, useEffect } from 'react'

interface Account {
  id: string
  name: string
  type: string
}

interface Transaction {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  settlementDays?: number
  description?: string
  recurrence?: {
    frequency: string
    dayOfWeek?: number
    dayOfMonth?: number
    interval?: number
    endDate?: string
    occurrences?: number
  }
}

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'onetime' | 'recurring'>('onetime')
  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: '',
    settlementDays: '',
    description: '',
    isRecurring: false,
    frequency: 'monthly',
    dayOfWeek: '',
    dayOfMonth: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [txRes, accRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/accounts'),
      ])
      const txData = await txRes.json()
      const accData = await accRes.json()
      setTransactions(txData)
      setAccounts(accData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        fromAccountId: formData.fromAccountId,
        toAccountId: formData.toAccountId,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        description: formData.description || undefined,
        settlementDays: formData.settlementDays ? parseInt(formData.settlementDays) : undefined,
      }

      if (formData.isRecurring) {
        payload.recurrence = {
          frequency: formData.frequency,
        }
        if (formData.frequency === 'weekly' && formData.dayOfWeek) {
          payload.recurrence.dayOfWeek = parseInt(formData.dayOfWeek)
        }
        if (formData.frequency === 'monthly' && formData.dayOfMonth) {
          payload.recurrence.dayOfMonth = parseInt(formData.dayOfMonth)
        }
      }

      if (editingId) {
        await fetch(`/api/transactions/${editingId}`, {
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

      resetForm()
      loadData()
    } catch (error) {
      console.error('Failed to save transaction:', error)
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id)
    setFormData({
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      amount: transaction.amount.toString(),
      date: new Date(transaction.date).toISOString().split('T')[0],
      settlementDays: transaction.settlementDays?.toString() || '',
      description: transaction.description || '',
      isRecurring: !!transaction.recurrence,
      frequency: transaction.recurrence?.frequency || 'monthly',
      dayOfWeek: transaction.recurrence?.dayOfWeek?.toString() || '',
      dayOfMonth: transaction.recurrence?.dayOfMonth?.toString() || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      loadData()
    } catch (error) {
      console.error('Failed to delete transaction:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      date: '',
      settlementDays: '',
      description: '',
      isRecurring: false,
      frequency: 'monthly',
      dayOfWeek: '',
      dayOfMonth: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const getAccountName = (id: string) => {
    return accounts.find(a => a.id === id)?.name || 'Unknown'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString()
  }

  const oneTimeTransactions = transactions.filter(t => !t.recurrence)
  const recurringTransactions = transactions.filter(t => t.recurrence)

  const displayedTransactions = viewMode === 'onetime' ? oneTimeTransactions : recurringTransactions

  if (loading) {
    return <div className="text-center py-8">Loading transactions...</div>
  }

  return (
    <div className="space-y-6">
      {/* View Mode Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setViewMode('onetime')}
            className={`${
              viewMode === 'onetime'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            One-time ({oneTimeTransactions.length})
          </button>
          <button
            onClick={() => setViewMode('recurring')}
            className={`${
              viewMode === 'recurring'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Recurring ({recurringTransactions.length})
          </button>
        </nav>
      </div>

      {/* Add Transaction Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Transaction
        </button>
      )}

      {/* Transaction Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
            {editingId ? 'Edit Transaction' : 'New Transaction'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Account
                </label>
                <select
                  value={formData.fromAccountId}
                  onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Account
                </label>
                <select
                  value={formData.toAccountId}
                  onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="What is this transaction for?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Settlement Days (optional)
              </label>
              <input
                type="number"
                min="0"
                value={formData.settlementDays}
                onChange={(e) => setFormData({ ...formData, settlementDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0 for instant, 3 for ACH, etc."
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recurring Transaction
                </span>
              </label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                {formData.frequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of Week (0=Sunday, 6=Saturday)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., 1 for Monday"
                    />
                  </div>
                )}

                {formData.frequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of Month (1-31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dayOfMonth}
                      onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., 15 for 15th of each month"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transaction List */}
      <div>
        {displayedTransactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No {viewMode === 'onetime' ? 'one-time' : 'recurring'} transactions yet.
          </p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {displayedTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {viewMode === 'onetime' ? formatDate(tx.date) : tx.recurrence?.frequency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getAccountName(tx.fromAccountId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getAccountName(tx.toAccountId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      ${tx.amount.toFixed(2)}
                      {tx.settlementDays && tx.settlementDays > 0 && (
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                          ({tx.settlementDays}d)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {tx.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(tx)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
