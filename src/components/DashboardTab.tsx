'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, addDays } from 'date-fns'

interface Account {
  id: string
  name: string
  type: string
  initialBalance?: number
}

interface ProjectionDataPoint {
  date: string
  balance: number
}

export default function DashboardTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')
  const [projectionData, setProjectionData] = useState<ProjectionDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState(60) // days

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts?type=tracked')
      if (!response.ok) throw new Error('Failed to fetch accounts')
      const data = await response.json()
      setAccounts(data)

      // Set first account as default if available
      if (data.length > 0 && selectedAccountId === 'all') {
        setSelectedAccountId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchProjections = async () => {
    if (!selectedAccountId || selectedAccountId === 'all') return

    setLoading(true)
    try {
      const today = new Date()
      const endDate = addDays(today, dateRange)

      const params = new URLSearchParams({
        accountId: selectedAccountId,
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      })

      const response = await fetch(`/api/projections?${params}`)
      if (!response.ok) throw new Error('Failed to fetch projections')

      const data = await response.json()
      setProjectionData(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching projections:', error)
      setProjectionData([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch tracked accounts
  useEffect(() => {
    fetchAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch projections when account or date range changes
  useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'all') {
      fetchProjections()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, dateRange])

  // Find danger zones (balance <= 0)
  const dangerDates = projectionData
    .filter(point => point.balance <= 0)
    .map(point => point.date)

  const minBalance = Math.min(...projectionData.map(p => p.balance), 0)
  const maxBalance = Math.max(...projectionData.map(p => p.balance), 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const isDanger = data.balance <= 0

      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {format(new Date(data.date), 'MMM dd, yyyy')}
          </p>
          <p className={`text-sm font-bold ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            ${data.balance.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Balance Projection</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              View your projected account balance over time
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Account selector */}
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Select Account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            {/* Date range selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>6 Months</option>
              <option value={365}>1 Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projection Graph */}
      {selectedAccountId === 'all' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Please select an account to view projections
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Loading projections...</p>
        </div>
      ) : projectionData.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No projection data available. Add some transactions to see your balance projection.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  className="text-gray-600 dark:text-gray-400"
                  domain={[Math.floor(minBalance * 1.1), Math.ceil(maxBalance * 1.1)]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Zero line */}
                <ReferenceLine
                  y={0}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: 'Zero Balance', fill: '#ef4444', fontSize: 12 }}
                />

                {/* Balance line - changes color based on positive/negative */}
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Balance"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Danger zone warning */}
          {dangerDates.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Warning: Low Balance Detected
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>
                      Your balance will drop to or below zero on {dangerDates.length} day(s) in this projection period.
                      First occurrence: {format(new Date(dangerDates[0]), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upcoming 30 Days
        </h3>

        {projectionData.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No data to display
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectionData.slice(0, 30).filter((_, index) => index % 3 === 0).map((point) => {
              const isDanger = point.balance <= 0
              return (
                <div
                  key={point.date}
                  className={`p-3 rounded-lg border ${
                    isDanger
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(point.date), 'MMM dd, yyyy')}
                  </div>
                  <div className={`text-lg font-bold ${
                    isDanger
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    ${point.balance.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
