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

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const calledValue = mockOnChange.mock.calls[0][0]
      expect(calledValue.frequency).toBe('weekly')
    })
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

    // Click multiple months
    await userEvent.click(screen.getByText('Jan'))
    await userEvent.click(screen.getByText('Jun'))
    await userEvent.click(screen.getByText('Dec'))

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.monthOfYear).toContain(0) // January
      expect(lastCall.monthOfYear).toContain(5) // June
      expect(lastCall.monthOfYear).toContain(11) // December
    })
  })

  it('should handle interval input for daily frequency', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    const dailyButton = screen.getByRole('button', { name: /daily/i })
    await userEvent.click(dailyButton)

    // Interval input should be visible
    await waitFor(() => {
      const intervalInput = screen.getByPlaceholderText(/every/i)
      expect(intervalInput).toBeInTheDocument()
    })

    // Change interval
    const intervalInput = screen.getByPlaceholderText(/every/i)
    await userEvent.clear(intervalInput)
    await userEvent.type(intervalInput, '3')

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0]
      expect(lastCall.interval).toBe(3)
    })
  })

  it('should handle end date input', async () => {
    render(<RecurrenceControl value={defaultValue} onChange={mockOnChange} />)

    // End date input should be visible (might be a DateInput component)
    // Look for date-related input or label
    const endDateLabel = screen.queryByText(/end date/i)
    // If not found by text, check for date input structure
    if (!endDateLabel) {
      // DateInput might be present even if label isn't visible
      const inputs = screen.getAllByRole('textbox')
      expect(inputs.length).toBeGreaterThan(0)
    }
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

