/**
 * @fileoverview Recurring item generator — shared between transactions & schedules.
 * Eliminates the massive code duplication in App.jsx.
 */
import { format, parseISO, addDays } from 'date-fns';
import { generateId, formatScheduleTimeString, getNextRecurringDate, isDateMatchForRecurring, isKoreanHoliday } from './helpers';

/**
 * @typedef {Object} RecurringConfig
 * @property {string} formDate - Start date 'yyyy-MM-dd'
 * @property {string} recurringType
 * @property {number} count
 * @property {boolean} excludeHolidays
 * @property {Array} customRecurringDays
 */

/**
 * Generate recurring transactions (expense/income).
 * @param {RecurringConfig} config
 * @param {Object} txData - { type, title, amount, category, memo, accountId }
 * @returns {Array} Array of transaction objects
 */
export function generateRecurringTransactions(config, txData) {
    const { formDate, recurringType, count, excludeHolidays, customRecurringDays } = config;
    const items = [];
    let currentD = parseISO(formDate);
    let added = 0;
    const groupId = count > 1 ? generateId() : undefined;

    while (added < count) {
        const dayOfWeek = currentD.getDay();
        const ymd = format(currentD, 'yyyy-MM-dd');

        if (recurringType === 'custom_weekly') {
            for (const c of customRecurringDays) {
                const diff = parseInt(c.val) - dayOfWeek;
                const targetDay = addDays(currentD, diff);
                const targetYmd = format(targetDay, 'yyyy-MM-dd');
                if (excludeHolidays && isKoreanHoliday(targetYmd)) continue;
                items.push({
                    id: generateId(),
                    ...txData,
                    date: targetYmd,
                    time: `${c.time}:00`,
                    ...(groupId && { groupId }),
                });
            }
            added++;
        } else if (recurringType === 'custom_monthly') {
            for (const c of customRecurringDays) {
                const targetDay = new Date(currentD);
                const lastDay = new Date(targetDay.getFullYear(), targetDay.getMonth() + 1, 0).getDate();
                targetDay.setDate(Math.min(parseInt(c.val), lastDay));
                const targetYmd = format(targetDay, 'yyyy-MM-dd');
                if (excludeHolidays && isKoreanHoliday(targetYmd)) continue;
                items.push({
                    id: generateId(),
                    ...txData,
                    date: targetYmd,
                    time: `${c.time}:00`,
                    ...(groupId && { groupId }),
                });
            }
            added++;
        } else {
            if (isDateMatchForRecurring(currentD, recurringType, excludeHolidays)) {
                items.push({
                    id: generateId(),
                    ...txData,
                    date: ymd,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    ...(groupId && { groupId }),
                });
                added++;
            }
        }

        currentD = getNextRecurringDate(currentD, recurringType);
    }
    return items;
}

/**
 * Generate recurring schedules.
 * @param {RecurringConfig} config
 * @param {Object} scData - { title, category, memo, location, scheduleTime, scheduleEndTime }
 * @param {Array} customRecurringDays
 * @returns {Array} Array of schedule objects
 */
export function generateRecurringSchedules(config, scData) {
    const { formDate, recurringType, count, excludeHolidays, customRecurringDays } = config;
    const items = [];
    let currentD = parseISO(formDate);
    let added = 0;
    const groupId = count > 1 ? generateId() : undefined;

    while (added < count) {
        const dayOfWeek = currentD.getDay();
        const ymd = format(currentD, 'yyyy-MM-dd');

        if (recurringType === 'custom_weekly') {
            for (const c of customRecurringDays) {
                const diff = parseInt(c.val) - dayOfWeek;
                const targetDay = addDays(currentD, diff);
                const targetYmd = format(targetDay, 'yyyy-MM-dd');
                if (excludeHolidays && isKoreanHoliday(targetYmd)) continue;
                items.push({
                    id: generateId(),
                    ...scData,
                    date: targetYmd,
                    time: formatScheduleTimeString(c.time),
                    endTime: formatScheduleTimeString(c.endTime),
                    completed: false,
                    ...(groupId && { groupId }),
                });
            }
            added++;
        } else if (recurringType === 'custom_monthly') {
            for (const c of customRecurringDays) {
                const targetDay = new Date(currentD);
                const lastDay = new Date(targetDay.getFullYear(), targetDay.getMonth() + 1, 0).getDate();
                targetDay.setDate(Math.min(parseInt(c.val), lastDay));
                const targetYmd = format(targetDay, 'yyyy-MM-dd');
                if (excludeHolidays && isKoreanHoliday(targetYmd)) continue;
                items.push({
                    id: generateId(),
                    ...scData,
                    date: targetYmd,
                    time: formatScheduleTimeString(c.time),
                    endTime: formatScheduleTimeString(c.endTime),
                    completed: false,
                    ...(groupId && { groupId }),
                });
            }
            added++;
        } else {
            if (isDateMatchForRecurring(currentD, recurringType, excludeHolidays)) {
                items.push({
                    id: generateId(),
                    ...scData,
                    date: ymd,
                    time: formatScheduleTimeString(scData.scheduleTime),
                    endTime: formatScheduleTimeString(scData.scheduleEndTime),
                    completed: false,
                    ...(groupId && { groupId }),
                });
                added++;
            }
        }

        currentD = getNextRecurringDate(currentD, recurringType);
    }
    return items;
}
