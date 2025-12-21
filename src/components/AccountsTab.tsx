'use client'

import { useState, useEffect } from 'react'

interface Account {
  id: string
  name: string
  initialBalance: number
  balanceAsOf: Date
}

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; initialBalance?: string; balanceAsOf?: string }>({})
  const [formData, setFormData] = useState({
    name: '',
    initialBalance: '',
    balanceAsOf: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { name?: string; initialBalance?: string; balanceAsOf?: string } = {}

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Account name must be at least 2 characters'
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Account name must be less than 100 characters'
    }

    // Validate initial balance
    if (!formData.initialBalance) {
      newErrors.initialBalance = 'Initial balance is required'
    } else {
      const balance = parseFloat(formData.initialBalance)
      if (isNaN(balance)) {
        newErrors.initialBalance = 'Initial balance must be a valid number'
      }
    }

    // Validate balance as of date
    if (!formData.balanceAsOf) {
      newErrors.balanceAsOf = 'Balance as of date is required'
    } else {
      const date = new Date(formData.balanceAsOf)
      if (isNaN(date.getTime())) {
        newErrors.balanceAsOf = 'Invalid date format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!validateForm()) {
      return
    }

    try {
      const payload: any = {
        name: formData.name.trim(),
        initialBalance: parseFloat(formData.initialBalance),
        balanceAsOf: new Date(formData.balanceAsOf).toISOString(),
      }

      const response = editingId
        ? await fetch(`/api/accounts/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save account' }))
        throw new Error(errorData.message || 'Failed to save account')
      }

      resetForm()
      loadAccounts()
    } catch (error) {
      console.error('Failed to save account:', error)
      setErrors({ name: error instanceof Error ? error.message : 'Failed to save account' })
    }
  }

  const handleEdit = (account: Account) => {
    setEditingId(account.id)
    setFormData({
      name: account.name,
      initialBalance: account.initialBalance?.toString() || '',
      balanceAsOf: new Date(account.balanceAsOf).toISOString().split('T')[0],
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', initialBalance: '', balanceAsOf: new Date().toISOString().split('T')[0] })
    setErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="text-center py-8">Loading accounts...</div>
  }

  return (
    <div className="space-y-6">
      {/* Add Account Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add Account
        </button>
      )}

      {/* Account Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
            {editingId ? 'Edit Account' : 'New Account'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  if (errors.name) setErrors({ ...errors, name: undefined })
                }}
                className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.name
                    ? 'border-red-500 dark:border-red-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.initialBalance}
                onChange={(e) => {
                  setFormData({ ...formData, initialBalance: e.target.value })
                  if (errors.initialBalance) setErrors({ ...errors, initialBalance: undefined })
                }}
                className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.initialBalance
                    ? 'border-red-500 dark:border-red-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
                required
              />
              {errors.initialBalance && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.initialBalance}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Balance As Of
              </label>
              <input
                type="date"
                value={formData.balanceAsOf}
                onChange={(e) => {
                  setFormData({ ...formData, balanceAsOf: e.target.value })
                  if (errors.balanceAsOf) setErrors({ ...errors, balanceAsOf: undefined })
                }}
                className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.balanceAsOf
                    ? 'border-red-500 dark:border-red-400'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                required
              />
              {errors.balanceAsOf && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.balanceAsOf}</p>
              )}
            </div>

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

      {/* Accounts List */}
      <div>
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Accounts</h3>
        {accounts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No accounts yet.</p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance As Of</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{account.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      ${account.initialBalance?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(account.balanceAsOf).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(account)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
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
