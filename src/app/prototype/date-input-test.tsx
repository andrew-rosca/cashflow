'use client'

import { useState } from 'react'
import DateInput from '@/components/DateInput'
import { LogicalDate, today } from '@/lib/logical-date'

export default function DateInputTest() {
  const [date1, setDate1] = useState(today())
  const [date2, setDate2] = useState(LogicalDate.from(2025, 6, 15))
  const [date3, setDate3] = useState(LogicalDate.from(2024, 12, 31))

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Date Input Component Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Test the new date input component with various scenarios.
          </p>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Test 1: Today's Date
            </h2>
            <div className="space-y-2">
              <DateInput
                value={date1}
                onChange={setDate1}
                className="w-48"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current value: {date1.toString()}
              </p>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Test 2: June 15, 2025
            </h2>
            <div className="space-y-2">
              <DateInput
                value={date2}
                onChange={setDate2}
                className="w-48"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current value: {date2.toString()}
              </p>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Test 3: December 31, 2024
            </h2>
            <div className="space-y-2">
              <DateInput
                value={date3}
                onChange={setDate3}
                className="w-48"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current value: {date3.toString()}
              </p>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Instructions
            </h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>Click on the date input to open the calendar</li>
              <li>Day field is pre-selected - just type a new number</li>
              <li>Tab or right-arrow to move to month field</li>
              <li>Type month number (1-12) or 3-letter name (Jan, Feb, etc.)</li>
              <li>Tab or right-arrow to move to year field</li>
              <li>Type 4-digit year</li>
              <li>Click "Close Calendar" to hide calendar but keep input active</li>
              <li>Click outside to close everything</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}


