import { describe, it, expect } from 'vitest'
import { LogicalDate, logicalDate, requireLogicalDate } from '@/lib/logical-date'

describe('LogicalDate', () => {
  describe('fromString', () => {
    it('should create LogicalDate from YYYY-MM-DD string', () => {
      const date = LogicalDate.fromString('2025-01-15')
      expect(date.year).toBe(2025)
      expect(date.month).toBe(1)
      expect(date.day).toBe(15)
    })

    it('should create LogicalDate from ISO string with time', () => {
      const date = LogicalDate.fromString('2025-01-15T10:30:00Z')
      expect(date.year).toBe(2025)
      expect(date.month).toBe(1)
      expect(date.day).toBe(15)
    })

    it('should reject Date.toString() format', () => {
      expect(() => {
        LogicalDate.fromString('Mon Jan 15 2025 10:30:00 GMT-0800')
      }).toThrow('Invalid date string format')
    })

    it('should handle edge cases like year boundaries', () => {
      const dec31 = LogicalDate.fromString('2024-12-31')
      expect(dec31.year).toBe(2024)
      expect(dec31.month).toBe(12)
      expect(dec31.day).toBe(31)

      const jan1 = LogicalDate.fromString('2025-01-01')
      expect(jan1.year).toBe(2025)
      expect(jan1.month).toBe(1)
      expect(jan1.day).toBe(1)
    })
  })

  describe('from', () => {
    it('should create LogicalDate from year, month, day', () => {
      const date = LogicalDate.from(2025, 1, 15)
      expect(date.year).toBe(2025)
      expect(date.month).toBe(1)
      expect(date.day).toBe(15)
    })

    it('should handle month 12 (December)', () => {
      const date = LogicalDate.from(2025, 12, 31)
      expect(date.month).toBe(12)
      expect(date.day).toBe(31)
    })

    it('should handle leap year February 29', () => {
      const date = LogicalDate.from(2024, 2, 29)
      expect(date.year).toBe(2024)
      expect(date.month).toBe(2)
      expect(date.day).toBe(29)
    })
  })

  describe('parse', () => {
    it('should parse string input', () => {
      const date = LogicalDate.parse('2025-01-15')
      expect(date).toBeInstanceOf(LogicalDate)
      expect(date?.year).toBe(2025)
    })

    it('should return LogicalDate as-is', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.parse(date1)
      expect(date2).toBe(date1)
    })

    it('should return undefined for undefined input', () => {
      expect(LogicalDate.parse(undefined)).toBeUndefined()
    })

    it('should reject Date objects', () => {
      expect(() => {
        LogicalDate.parse(new Date() as any)
      }).toThrow('LogicalDate.parse does not accept Date objects')
    })
  })

  describe('properties', () => {
    it('should return correct year, month, day', () => {
      const date = LogicalDate.fromString('2025-03-15')
      expect(date.year).toBe(2025)
      expect(date.month).toBe(3)
      expect(date.day).toBe(15)
    })

    it('should return correct dayOfWeek (1=Monday, 7=Sunday)', () => {
      // Jan 15, 2025 is a Wednesday (day 3)
      const date = LogicalDate.fromString('2025-01-15')
      expect(date.dayOfWeek).toBe(3)
    })

    it('should return correct daysInMonth', () => {
      const jan = LogicalDate.fromString('2025-01-15')
      expect(jan.daysInMonth).toBe(31)

      const feb = LogicalDate.fromString('2025-02-15')
      expect(feb.daysInMonth).toBe(28)

      const febLeap = LogicalDate.fromString('2024-02-15')
      expect(febLeap.daysInMonth).toBe(29)
    })
  })

  describe('toString', () => {
    it('should return YYYY-MM-DD format', () => {
      const date = LogicalDate.fromString('2025-01-15')
      expect(date.toString()).toBe('2025-01-15')
    })

    it('should pad single digit months and days', () => {
      const date = LogicalDate.fromString('2025-01-05')
      expect(date.toString()).toBe('2025-01-05')
    })

    it('should match toISOString', () => {
      const date = LogicalDate.fromString('2025-01-15')
      expect(date.toString()).toBe(date.toISOString())
    })
  })

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const nextDay = date.addDays(1)
      expect(nextDay.toString()).toBe('2025-01-16')
    })

    it('should handle month boundaries', () => {
      const date = LogicalDate.fromString('2025-01-31')
      const nextDay = date.addDays(1)
      expect(nextDay.toString()).toBe('2025-02-01')
    })

    it('should handle year boundaries', () => {
      const date = LogicalDate.fromString('2024-12-31')
      const nextDay = date.addDays(1)
      expect(nextDay.toString()).toBe('2025-01-01')
    })

    it('should add multiple days', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const future = date.addDays(10)
      expect(future.toString()).toBe('2025-01-25')
    })
  })

  describe('subtractDays', () => {
    it('should subtract days', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const previous = date.subtractDays(1)
      expect(previous.toString()).toBe('2025-01-14')
    })

    it('should handle month boundaries backwards', () => {
      const date = LogicalDate.fromString('2025-02-01')
      const previous = date.subtractDays(1)
      expect(previous.toString()).toBe('2025-01-31')
    })

    it('should handle year boundaries backwards', () => {
      const date = LogicalDate.fromString('2025-01-01')
      const previous = date.subtractDays(1)
      expect(previous.toString()).toBe('2024-12-31')
    })
  })

  describe('addMonths', () => {
    it('should add months', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const future = date.addMonths(1)
      expect(future.toString()).toBe('2025-02-15')
    })

    it('should handle year rollover', () => {
      const date = LogicalDate.fromString('2024-12-15')
      const future = date.addMonths(1)
      expect(future.toString()).toBe('2025-01-15')
    })

    it('should handle months with fewer days (e.g., Jan 31 -> Feb 28)', () => {
      const date = LogicalDate.fromString('2025-01-31')
      const future = date.addMonths(1)
      // Feb 2025 has 28 days, so Jan 31 + 1 month = Feb 28
      expect(future.toString()).toBe('2025-02-28')
    })

    it('should handle leap years', () => {
      const date = LogicalDate.fromString('2024-01-31')
      const future = date.addMonths(1)
      // Feb 2024 has 29 days (leap year)
      expect(future.toString()).toBe('2024-02-29')
    })
  })

  describe('subtractMonths', () => {
    it('should subtract months', () => {
      const date = LogicalDate.fromString('2025-02-15')
      const previous = date.subtractMonths(1)
      expect(previous.toString()).toBe('2025-01-15')
    })

    it('should handle year rollover backwards', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const previous = date.subtractMonths(1)
      expect(previous.toString()).toBe('2024-12-15')
    })
  })

  describe('addYears', () => {
    it('should add years', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const future = date.addYears(1)
      expect(future.toString()).toBe('2026-01-15')
    })

    it('should handle leap year edge case (Feb 29)', () => {
      const date = LogicalDate.fromString('2024-02-29')
      const future = date.addYears(1)
      // 2025 is not a leap year, so Feb 29 -> Feb 28
      expect(future.toString()).toBe('2025-02-28')
    })
  })

  describe('subtractYears', () => {
    it('should subtract years', () => {
      const date = LogicalDate.fromString('2025-01-15')
      const previous = date.subtractYears(1)
      expect(previous.toString()).toBe('2024-01-15')
    })
  })

  describe('compare', () => {
    it('should return -1 when this date is before other', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.compare(date2)).toBe(-1)
    })

    it('should return 0 when dates are equal', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.compare(date2)).toBe(0)
    })

    it('should return 1 when this date is after other', () => {
      const date1 = LogicalDate.fromString('2025-01-16')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.compare(date2)).toBe(1)
    })
  })

  describe('equals', () => {
    it('should return true for equal dates', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.equals(date2)).toBe(true)
    })

    it('should return false for different dates', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.equals(date2)).toBe(false)
    })
  })

  describe('isBefore', () => {
    it('should return true when date is before other', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.isBefore(date2)).toBe(true)
    })

    it('should return false when date is after other', () => {
      const date1 = LogicalDate.fromString('2025-01-16')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isBefore(date2)).toBe(false)
    })

    it('should return false when dates are equal', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isBefore(date2)).toBe(false)
    })
  })

  describe('isAfter', () => {
    it('should return true when date is after other', () => {
      const date1 = LogicalDate.fromString('2025-01-16')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isAfter(date2)).toBe(true)
    })

    it('should return false when date is before other', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.isAfter(date2)).toBe(false)
    })

    it('should return false when dates are equal', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isAfter(date2)).toBe(false)
    })
  })

  describe('isOnOrBefore', () => {
    it('should return true when date is before other', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.isOnOrBefore(date2)).toBe(true)
    })

    it('should return true when dates are equal', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isOnOrBefore(date2)).toBe(true)
    })

    it('should return false when date is after other', () => {
      const date1 = LogicalDate.fromString('2025-01-16')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isOnOrBefore(date2)).toBe(false)
    })
  })

  describe('isOnOrAfter', () => {
    it('should return true when date is after other', () => {
      const date1 = LogicalDate.fromString('2025-01-16')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isOnOrAfter(date2)).toBe(true)
    })

    it('should return true when dates are equal', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.isOnOrAfter(date2)).toBe(true)
    })

    it('should return false when date is before other', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-16')
      expect(date1.isOnOrAfter(date2)).toBe(false)
    })
  })

  describe('differenceInDays', () => {
    it('should return positive difference when other is later', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-20')
      expect(date1.differenceInDays(date2)).toBe(5)
    })

    it('should return negative difference when other is earlier', () => {
      const date1 = LogicalDate.fromString('2025-01-20')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.differenceInDays(date2)).toBe(-5)
    })

    it('should return 0 for same date', () => {
      const date1 = LogicalDate.fromString('2025-01-15')
      const date2 = LogicalDate.fromString('2025-01-15')
      expect(date1.differenceInDays(date2)).toBe(0)
    })

    it('should handle year boundaries', () => {
      const date1 = LogicalDate.fromString('2024-12-31')
      const date2 = LogicalDate.fromString('2025-01-01')
      expect(date1.differenceInDays(date2)).toBe(1)
    })
  })

  describe('helper functions', () => {
    describe('logicalDate', () => {
      it('should parse string input', () => {
        const date = logicalDate('2025-01-15')
        expect(date).toBeInstanceOf(LogicalDate)
        expect(date?.toString()).toBe('2025-01-15')
      })

      it('should return LogicalDate as-is', () => {
        const date1 = LogicalDate.fromString('2025-01-15')
        const date2 = logicalDate(date1)
        expect(date2).toBe(date1)
      })

      it('should return undefined for undefined', () => {
        expect(logicalDate(undefined)).toBeUndefined()
      })
    })

    describe('requireLogicalDate', () => {
      it('should return LogicalDate for valid input', () => {
        const date = requireLogicalDate('2025-01-15')
        expect(date).toBeInstanceOf(LogicalDate)
        expect(date.toString()).toBe('2025-01-15')
      })

      it('should throw for undefined input', () => {
        expect(() => {
          requireLogicalDate(undefined)
        }).toThrow('Expected a valid date but got undefined')
      })
    })
  })
})

