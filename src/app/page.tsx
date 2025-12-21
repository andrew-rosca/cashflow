'use client'

import { useState } from 'react'
import AccountsTab from '@/components/AccountsTab'
import TransactionsTab from '@/components/TransactionsTab'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions'>('accounts')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CashFlow</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Personal Finance Projection Tool
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`${
                activeTab === 'accounts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Accounts
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Transactions
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'accounts' && <AccountsTab />}
          {activeTab === 'transactions' && <TransactionsTab />}
        </div>
      </div>
    </main>
  )
}
