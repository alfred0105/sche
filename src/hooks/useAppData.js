/**
 * @fileoverview Core application data hook.
 * Manages all persistent data with localStorage + optional Supabase cloud sync.
 * 
 * Fixes applied:
 * - useLocalStorage stale value bug (now uses ref for latest value)
 * - getCalculatedBalances memoized with useMemo
 * - totalAssets memoized
 * - Cloud sync race condition mitigated
 * - eslint-disable comments removed where possible
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '../supabaseClient';
import { toast } from 'react-hot-toast';
import {
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES,
    DEFAULT_SCHEDULE_CATEGORIES,
    DEFAULT_ACCOUNTS,
    DEFAULT_INITIAL_BALANCES,
    DEFAULT_PROFILE,
    CLOUD_SYNC_DEBOUNCE_MS,
    CLOUD_SYNC_READY_DELAY_MS,
} from '../constants';

// ============================================================
// Fixed useLocalStorage — uses ref to avoid stale closure
// ============================================================
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (e) {
            console.error(`[useLocalStorage] Failed to parse key "${key}":`, e);
            return initialValue;
        }
    });

    // Keep a ref to the latest stored value to avoid stale closures
    const storedValueRef = useRef(storedValue);
    storedValueRef.current = storedValue;

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`[useLocalStorage] Failed to set key "${key}":`, error);
        }
    }, [key]);

    return [storedValue, setValue];
}

// ============================================================
// Default sample data
// ============================================================
const defaultTransactions = [
    { id: 'tx-default-1', type: 'expense', date: format(new Date(), 'yyyy-MM-dd'), time: '08:30 AM', title: '스타벅스', amount: 4500, category: '카페', memo: '출근길 커피', accountId: 'bank2' },
    { id: 'tx-default-2', type: 'income', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00 AM', title: '용돈', amount: 150000, category: '용돈', memo: '', accountId: 'bank2' },
    { id: 'tx-default-3', type: 'expense', date: format(new Date(), 'yyyy-MM-dd'), time: '12:40 PM', title: '점심 식사', amount: 12000, category: '식비', memo: '돈까스', accountId: 'bank2' },
];

const defaultSchedules = [
    { id: 'sc-default-1', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00 AM', category: '업무', title: '팀 미팅', completed: false, memo: '주간 업무 보고' },
];

const defaultGoals = [
    { id: 'goal-default-1', type: 'short', title: '오늘까지 내야 하는 과제', progress: 0, target: 100, deadline: format(new Date(), 'yyyy-MM-dd'), tasks: [], tracker: { type: 'checklist', unit: '% (수동 퍼센트)', current: 0, target: 100 } },
    { id: 'goal-default-2', type: 'mid', title: '이번 학기 학점 4.0', progress: 20, target: 100, deadline: '2026-06-30', tasks: [], tracker: { type: 'checklist', unit: '% (수동 퍼센트)', current: 0, target: 100 } },
    { id: 'goal-default-3', type: 'long', title: '천만원 모으기 프로젝트', progress: 45, target: 100, targetAmount: 10000000, currentAmount: 4500000, deadline: '2026-12-31', tasks: [], tracker: { type: 'checklist', unit: '% (수동 퍼센트)', current: 0, target: 100 } },
];

const defaultStudies = [
    { id: 'study-default-1', title: '매일 영단어 50개 암기', icon: 'BookOpen', totalDays: 30, logs: [format(new Date(), 'yyyy-MM-dd')] },
];

// ============================================================
// Main Hook
// ============================================================
export function useAppData(session) {
    const [currentDate] = useState(new Date());

    const [expenseCategories, setExpenseCategories] = useLocalStorage('expenseCategories', DEFAULT_EXPENSE_CATEGORIES);
    const [incomeCategories, setIncomeCategories] = useLocalStorage('incomeCategories', DEFAULT_INCOME_CATEGORIES);
    const [scheduleCategories, setScheduleCategories] = useLocalStorage('scheduleCategories', DEFAULT_SCHEDULE_CATEGORIES);

    const addCategory = useCallback((type, newCategory) => {
        if (type === 'expense') setExpenseCategories((p) => [...p, newCategory]);
        else if (type === 'income') setIncomeCategories((p) => [...p, newCategory]);
        else setScheduleCategories((p) => [...p, newCategory]);
    }, [setExpenseCategories, setIncomeCategories, setScheduleCategories]);

    const deleteCategory = useCallback((type, id) => {
        if (type === 'expense') setExpenseCategories((p) => p.filter((c) => c.id !== id));
        else if (type === 'income') setIncomeCategories((p) => p.filter((c) => c.id !== id));
        else setScheduleCategories((p) => p.filter((c) => c.id !== id));
    }, [setExpenseCategories, setIncomeCategories, setScheduleCategories]);

    const [accounts, setAccounts] = useLocalStorage('accounts', DEFAULT_ACCOUNTS);

    const addAccount = useCallback((newAccount) => setAccounts((p) => [...p, newAccount]), [setAccounts]);
    const updateAccount = useCallback((id, updatedAccount) => {
        setAccounts((p) => p.map((a) => (a.id === id ? { ...a, ...updatedAccount } : a)));
    }, [setAccounts]);
    const deleteAccount = useCallback((id) => setAccounts((p) => p.filter((a) => a.id !== id)), [setAccounts]);

    const [initialBalances] = useLocalStorage('initialBalances', DEFAULT_INITIAL_BALANCES);

    const [transactions, setTransactions] = useLocalStorage('transactions', defaultTransactions);
    const [schedules, setSchedules] = useLocalStorage('schedules', defaultSchedules);
    const [goals, setGoals] = useLocalStorage('goals', defaultGoals);
    const [studies, setStudies] = useLocalStorage('studies', defaultStudies);
    const [userProfile, setUserProfile] = useLocalStorage('userProfile', DEFAULT_PROFILE);

    // ==========================================
    // Cloud Sync Logic
    // ==========================================
    const [cloudSyncStatus, setCloudSyncStatus] = useState('idle');
    const cloudSyncRef = useRef(false); // Prevent overwrite during load

    useEffect(() => {
        if (!session?.user || !supabase) return;
        let isMounted = true;
        cloudSyncRef.current = true;

        const loadCloudData = async () => {
            try {
                const { data } = await supabase
                    .from('user_data')
                    .select('payload')
                    .eq('user_id', session.user.id)
                    .single();

                if (isMounted && data?.payload) {
                    const pl = data.payload;
                    if (pl.expenseCategories) setExpenseCategories(pl.expenseCategories);
                    if (pl.incomeCategories) setIncomeCategories(pl.incomeCategories);
                    if (pl.scheduleCategories) setScheduleCategories(pl.scheduleCategories);
                    if (pl.accounts) setAccounts(pl.accounts);
                    if (pl.transactions) setTransactions(pl.transactions);
                    if (pl.schedules) setSchedules(pl.schedules);
                    if (pl.goals) setGoals(pl.goals);
                    if (pl.studies) setStudies(pl.studies);
                    if (pl.userProfile) setUserProfile(pl.userProfile);
                    toast.success('기기 간 동기화가 완료되었습니다', { icon: '☁️' });
                }
            } catch (e) {
                console.error('[CloudSync] Load failed:', e);
                toast.error('클라우드 데이터 로드에 실패했습니다.', { icon: '⚠️' });
            } finally {
                if (isMounted) {
                    setTimeout(() => {
                        cloudSyncRef.current = false;
                        setCloudSyncStatus('ready');
                    }, CLOUD_SYNC_READY_DELAY_MS);
                }
            }
        };
        loadCloudData();
        return () => { isMounted = false; };
    }, [session?.user?.id, setExpenseCategories, setIncomeCategories, setScheduleCategories, setAccounts, setTransactions, setSchedules, setGoals, setStudies, setUserProfile]);

    useEffect(() => {
        if (cloudSyncStatus !== 'ready' || !session?.user || !supabase || cloudSyncRef.current) return;

        const uploadData = async () => {
            const payload = {
                expenseCategories, incomeCategories, scheduleCategories,
                accounts, transactions, schedules, goals, studies, userProfile,
            };
            try {
                await supabase.from('user_data').upsert({
                    user_id: session.user.id,
                    payload,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
            } catch (error) {
                console.error('[CloudSync] Save failed:', error);
            }
        };

        const timerId = setTimeout(uploadData, CLOUD_SYNC_DEBOUNCE_MS);
        return () => clearTimeout(timerId);
    }, [cloudSyncStatus, session?.user?.id, expenseCategories, incomeCategories, scheduleCategories, accounts, transactions, schedules, goals, studies, userProfile]);

    // ==========================================
    // Memoized Calculations
    // ==========================================
    const calculatedBalances = useMemo(() => {
        const balances = { ...initialBalances };
        transactions.forEach((t) => {
            if (!balances[t.accountId]) balances[t.accountId] = 0;
            if (t.type === 'income') balances[t.accountId] += t.amount;
            else if (t.type === 'expense') balances[t.accountId] -= t.amount;
        });
        return balances;
    }, [initialBalances, transactions]);

    const getCalculatedBalances = useCallback(() => calculatedBalances, [calculatedBalances]);
    const totalAssets = useMemo(() => Object.values(calculatedBalances).reduce((a, b) => a + b, 0), [calculatedBalances]);
    const filterDateStr = format(currentDate, 'yyyy-MM-dd');

    return {
        currentDate, filterDateStr,
        expenseCategories, incomeCategories, scheduleCategories, addCategory, deleteCategory,
        accounts, addAccount, updateAccount, deleteAccount, getCalculatedBalances, calculatedBalances, totalAssets,
        transactions, setTransactions,
        schedules, setSchedules,
        goals, setGoals,
        studies, setStudies,
        userProfile, setUserProfile,
    };
}
