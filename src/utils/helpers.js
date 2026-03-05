/**
 * @fileoverview Shared utility functions for the application.
 */
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { ALL_KR_HOLIDAYS, MAX_RECURRING_COUNT, DEFAULT_RECURRING_COUNT } from '../constants';

/**
 * Generate a unique ID using crypto API with fallback.
 * @returns {string} A unique string identifier
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format a 24h time string to AM/PM format.
 * @param {string} time24 - Time in "HH:mm" format
 * @returns {string} Time in "hh:mm AM/PM" format
 */
export function formatScheduleTimeString(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const numH = parseInt(h, 10);
    const ampm = numH >= 12 ? 'PM' : 'AM';
    let dispH = numH % 12;
    if (dispH === 0) dispH = 12;
    return `${dispH.toString().padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Format a Date to 'yyyy-MM-dd' string safely without timezone issues.
 * @param {Date} date
 * @returns {string}
 */
export function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Check if a date falls on a Korean holiday.
 * @param {string} ymd - Date in 'yyyy-MM-dd' format
 * @returns {boolean}
 */
export function isKoreanHoliday(ymd) {
    const md = ymd.substring(5); // 'MM-dd'
    return ALL_KR_HOLIDAYS.includes(md) || ALL_KR_HOLIDAYS.includes(ymd);
}

/**
 * Calculate the next date based on recurring type.
 * @param {Date} currentDate 
 * @param {string} recurringType 
 * @returns {Date}
 */
export function getNextRecurringDate(currentDate, recurringType) {
    switch (recurringType) {
        case 'monthly':
        case 'custom_monthly':
            return addMonths(currentDate, 1);
        case 'yearly':
            return addYears(currentDate, 1);
        case 'biweekly':
            return addWeeks(currentDate, 2);
        case 'weekly':
        case 'custom_weekly':
            return addWeeks(currentDate, 1);
        default:
            return addDays(currentDate, 1);
    }
}

/**
 * Check if a date matches the recurring filter (weekdays/weekends/holidays).
 * @param {Date} date 
 * @param {string} recurringType 
 * @param {boolean} excludeHolidays 
 * @returns {boolean}
 */
export function isDateMatchForRecurring(date, recurringType, excludeHolidays) {
    const dayOfWeek = date.getDay();
    const ymd = format(date, 'yyyy-MM-dd');

    if (recurringType === 'weekdays' && (dayOfWeek === 0 || dayOfWeek === 6)) return false;
    if (recurringType === 'weekends' && (dayOfWeek > 0 && dayOfWeek < 6)) return false;
    if (excludeHolidays && isKoreanHoliday(ymd)) return false;

    return true;
}

/**
 * Sanitize recurring count with bounds.
 * @param {number|string} count
 * @returns {number}
 */
export function sanitizeRecurringCount(count) {
    const parsed = Number(count);
    if (!parsed || parsed <= 0 || parsed > MAX_RECURRING_COUNT) return DEFAULT_RECURRING_COUNT;
    return parsed;
}

/**
 * Convert a time string (e.g., "09:30 AM") to minutes for sorting.
 * @param {string} timeStr
 * @returns {number}
 */
export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(' ');
    if (!time || !period) return 0;
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}
