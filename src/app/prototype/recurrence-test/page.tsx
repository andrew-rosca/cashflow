'use client'

import { useState } from 'react'
import RecurrenceControl from '@/components/RecurrenceControl'

export default function RecurrenceTestPage() {
  const [recurrence, setRecurrence] = useState<any>({
    frequency: 'monthly',
    interval: 1,
    dayOfWeek: null,
    dayOfMonth: null,
    month: null,
    endDate: null,
  })

  const [log, setLog] = useState<string[]>([])

  const handleRecurrenceChange = (newRecurrence: any) => {
    setRecurrence(newRecurrence)
    setLog((prev) => [...prev, `Recurrence changed: ${JSON.stringify(newRecurrence, null, 2)}`])
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recurrence Control Test</h1>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recurrence Settings:
          </label>
          <RecurrenceControl
            value={recurrence}
            onChange={handleRecurrenceChange}
          />
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md max-h-96 overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Current Recurrence State</h2>
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(recurrence, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md max-h-96 overflow-y-auto mt-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Event Log</h2>
          {log.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No events yet.</p>
          ) : (
            <ul className="space-y-1">
              {log.map((entry, index) => (
                <li key={index} className="text-xs text-gray-700 dark:text-gray-300">
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

