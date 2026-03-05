/**
 * @fileoverview Unit tests for utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
    generateId,
    formatScheduleTimeString,
    toDateString,
    isKoreanHoliday,
    getNextRecurringDate,
    sanitizeRecurringCount,
    timeToMinutes,
} from '../utils/helpers';

describe('generateId', () => {
    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        expect(ids.size).toBe(100);
    });

    it('produces string output', () => {
        expect(typeof generateId()).toBe('string');
    });
});

describe('formatScheduleTimeString', () => {
    it('converts 24h to 12h AM format', () => {
        expect(formatScheduleTimeString('09:30')).toBe('09:30 AM');
    });

    it('converts 24h to 12h PM format', () => {
        expect(formatScheduleTimeString('14:30')).toBe('02:30 PM');
    });

    it('handles noon correctly', () => {
        expect(formatScheduleTimeString('12:00')).toBe('12:00 PM');
    });

    it('handles midnight correctly', () => {
        expect(formatScheduleTimeString('00:00')).toBe('12:00 AM');
    });

    it('returns empty string for empty input', () => {
        expect(formatScheduleTimeString('')).toBe('');
        expect(formatScheduleTimeString(null)).toBe('');
        expect(formatScheduleTimeString(undefined)).toBe('');
    });
});

describe('toDateString', () => {
    it('formats date as yyyy-MM-dd', () => {
        const date = new Date(2026, 2, 5); // March 5, 2026
        expect(toDateString(date)).toBe('2026-03-05');
    });

    it('pads single digit month and day', () => {
        const date = new Date(2026, 0, 9); // Jan 9, 2026
        expect(toDateString(date)).toBe('2026-01-09');
    });
});

describe('isKoreanHoliday', () => {
    it('detects fixed holidays by month-day', () => {
        expect(isKoreanHoliday('2026-01-01')).toBe(true); // New Year
        expect(isKoreanHoliday('2026-03-01')).toBe(true); // Independence Day
        expect(isKoreanHoliday('2026-12-25')).toBe(true); // Christmas
    });

    it('detects floating holidays by full date', () => {
        expect(isKoreanHoliday('2026-02-16')).toBe(true); // Lunar New Year
    });

    it('returns false for regular dates', () => {
        expect(isKoreanHoliday('2026-03-05')).toBe(false);
        expect(isKoreanHoliday('2026-07-15')).toBe(false);
    });
});

describe('getNextRecurringDate', () => {
    it('adds 1 day for daily', () => {
        const d = new Date(2026, 0, 1);
        const next = getNextRecurringDate(d, 'daily');
        expect(next.getDate()).toBe(2);
    });

    it('adds 1 week for weekly', () => {
        const d = new Date(2026, 0, 1);
        const next = getNextRecurringDate(d, 'weekly');
        expect(next.getDate()).toBe(8);
    });

    it('adds 1 month for monthly', () => {
        const d = new Date(2026, 0, 15);
        const next = getNextRecurringDate(d, 'monthly');
        expect(next.getMonth()).toBe(1); // February
    });

    it('adds 2 weeks for biweekly', () => {
        const d = new Date(2026, 0, 1);
        const next = getNextRecurringDate(d, 'biweekly');
        expect(next.getDate()).toBe(15);
    });
});

describe('sanitizeRecurringCount', () => {
    it('returns parsed count for valid input', () => {
        expect(sanitizeRecurringCount(10)).toBe(10);
        expect(sanitizeRecurringCount('52')).toBe(52);
    });

    it('returns default for invalid input', () => {
        expect(sanitizeRecurringCount(0)).toBe(12);
        expect(sanitizeRecurringCount(-5)).toBe(12);
        expect(sanitizeRecurringCount('abc')).toBe(12);
        expect(sanitizeRecurringCount(null)).toBe(12);
    });

    it('returns default for values exceeding MAX', () => {
        expect(sanitizeRecurringCount(999)).toBe(12);
    });
});

describe('timeToMinutes', () => {
    it('converts AM time correctly', () => {
        expect(timeToMinutes('09:30 AM')).toBe(570);
    });

    it('converts PM time correctly', () => {
        expect(timeToMinutes('02:30 PM')).toBe(870);
    });

    it('handles noon correctly', () => {
        expect(timeToMinutes('12:00 PM')).toBe(720);
    });

    it('handles midnight correctly', () => {
        expect(timeToMinutes('12:00 AM')).toBe(0);
    });

    it('returns 0 for invalid input', () => {
        expect(timeToMinutes('')).toBe(0);
        expect(timeToMinutes(null)).toBe(0);
        expect(timeToMinutes(undefined)).toBe(0);
    });
});
