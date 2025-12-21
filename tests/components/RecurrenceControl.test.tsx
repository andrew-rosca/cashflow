import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurrenceControl from '@/components/RecurrenceControl'

// @vitest-environment jsdom

describe('RecurrenceControl Component', () => {
  const mockOnChange = vi.fn()
  const defaultValue = { frequency: 'monthly' as const }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('should render with default monthly frequency', () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    // Monthly should be selected by default
    const monthlyButton = screen.getByRole('button', { name: /monthly/i })
    expect(monthlyButton).toHaveClass('bg-blue-600') // Selected state
  })

  it('should allow changing frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const weeklyButton = screen.getByRole('button', { name: /weekly/i })
    await userEvent.click(weeklyButton)

    // onChange is called via useEffect, so wait for it
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      // Check the last call (most recent)
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.frequency).toBe('weekly')
    }, { timeout: 2000 })
  })

  it('should show day of week buttons for weekly frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const weeklyButton = screen.getByRole('button', { name: /weekly/i })
    await userEvent.click(weeklyButton)

    // Day of week buttons should be visible
    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Tue')).toBeInTheDocument()
      expect(screen.getByText('Wed')).toBeInTheDocument()
    })
  })

  it('should allow multi-select for day of week', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const weeklyButton = screen.getByRole('button', { name: /weekly/i })
    await userEvent.click(weeklyButton)

    // Click multiple days
    await userEvent.click(screen.getByText('Mon'))
    await userEvent.click(screen.getByText('Wed'))
    await userEvent.click(screen.getByText('Fri'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.dayOfWeek).toContain(1) // Monday
      expect(lastCall.dayOfWeek).toContain(3) // Wednesday
      expect(lastCall.dayOfWeek).toContain(5) // Friday
    })
  })

  it('should show day of month buttons for monthly frequency', () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    // Monthly is default, so day of month buttons should be visible
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('should allow multi-select for day of month', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    // Click multiple days
    await userEvent.click(screen.getByText('1'))
    await userEvent.click(screen.getByText('15'))
    await userEvent.click(screen.getByText('28'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.dayOfMonth).toContain(1)
      expect(lastCall.dayOfMonth).toContain(15)
      expect(lastCall.dayOfMonth).toContain(28)
    })
  })

  it('should show month buttons for yearly frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const yearlyButton = screen.getByRole('button', { name: /yearly/i })
    await userEvent.click(yearlyButton)

    // Month buttons should be visible
    await waitFor(() => {
      expect(screen.getByText('Jan')).toBeInTheDocument()
      expect(screen.getByText('Jun')).toBeInTheDocument()
      expect(screen.getByText('Dec')).toBeInTheDocument()
    })
  })

  it('should allow multi-select for months in yearly frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const yearlyButton = screen.getByRole('button', { name: /yearly/i })
    await userEvent.click(yearlyButton)

    // Wait for yearly UI to appear
    await waitFor(() => {
      expect(screen.getByText('Jan')).toBeInTheDocument()
    })

    // Click multiple months
    await userEvent.click(screen.getByText('Jan'))
    await userEvent.click(screen.getByText('Jun'))
    await userEvent.click(screen.getByText('Dec'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      // Component uses 'month' not 'monthOfYear', and it's an array or single value
      const monthValue = lastCall.month
      const monthArray = Array.isArray(monthValue) ? monthValue : [monthValue]
      expect(monthArray).toContain('Jan')
      expect(monthArray).toContain('Jun')
      expect(monthArray).toContain('Dec')
    }, { timeout: 2000 })
  })

  it('should handle interval input for daily frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const dailyButton = screen.getByRole('button', { name: /daily/i })
    await userEvent.click(dailyButton)

    // Interval input should be visible (it's a number input with label "Every")
    await waitFor(() => {
      const intervalLabel = screen.getByText('Every')
      expect(intervalLabel).toBeInTheDocument()
    })

    // Find the number input - it's an input with type="number"
    await waitFor(() => {
      const numberInputs = document.querySelectorAll('input[type="number"]')
      expect(numberInputs.length).toBeGreaterThan(0)
    })
    
    const intervalInput = document.querySelector('input[type="number"]') as HTMLInputElement
    expect(intervalInput).toBeInTheDocument()
    expect(intervalInput.value).toBe('1') // Default value
    
    // Change the value - focus, select all, then type
    await userEvent.click(intervalInput)
    // Use keyboard to select all (Ctrl+A / Cmd+A) then type
    await userEvent.keyboard('{Control>}a{/Control}3')
    
    // Verify the input value changed to 3
    await waitFor(() => {
      expect(intervalInput.value).toBe('3')
    })
    
    // The onChange should be called (via useEffect when interval state changes)
    // Verify onChange was called (it gets called on initial render and when interval changes)
    expect(mockOnChange).toHaveBeenCalled()
  })

  it('should handle end date input', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    // End date section should be visible
    const endDateElements = screen.getAllByText(/end date/i)
    expect(endDateElements.length).toBeGreaterThan(0)

    // Initially, there's a "Set end date" button, not a DateInput
    const setEndDateButton = screen.getByText(/set end date/i)
    expect(setEndDateButton).toBeInTheDocument()

    // Click to set an end date, which will show the DateInput
    await userEvent.click(setEndDateButton)

    // Now DateInput should be visible with text inputs
    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox')
      // DateInput has day, month, year inputs
      expect(inputs.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('should initialize with provided value', () => {
    const initialValue = {
      frequency: 'weekly',
      interval: 2,
      dayOfWeek: [1, 3], // Monday, Wednesday
      endDate: '2025-12-31',
    }

    render(<RecurrenceControl value={initialValue} onChange={mockOnChange} />)

    // Weekly should be selected
    const weeklyButton = screen.getByRole('button', { name: /weekly/i })
    expect(weeklyButton).toHaveClass('bg-blue-600')

    // Monday and Wednesday should be selected
    const monButton = screen.getByText('Mon')
    const wedButton = screen.getByText('Wed')
    expect(monButton).toHaveClass('bg-blue-600')
    expect(wedButton).toHaveClass('bg-blue-600')
  })
})

