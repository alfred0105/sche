import { useState } from 'react';
import { format } from 'date-fns';

function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (e) {
            console.error(e);
            return initialValue;
        }
    });

    const setValue = value => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
}

const defaultExpenseCats = [
    { id: 'food', label: '식비', icon: 'Utensils' },
    { id: 'transit', label: '교통비', icon: 'Train' },
    { id: 'cafe', label: '카페', icon: 'Coffee' },
    { id: 'shopping', label: '쇼핑', icon: 'ShoppingBag' },
    { id: 'invest_loss', label: '투자 손실', icon: 'TrendingDown' },
];

const defaultIncomeCats = [
    { id: 'salary', label: '급여', icon: 'Briefcase' },
    { id: 'allowance', label: '용돈', icon: 'PieChart' },
    { id: 'bonus', label: '보너스', icon: 'Target' },
    { id: 'interest', label: '이자 수익', icon: 'TrendingUp' },
    { id: 'invest_profit', label: '투자 수익', icon: 'PieChart' },
];

const defaultScheduleCats = [
    { id: 'lecture', label: '강의/수업', icon: 'BookOpen' },
    { id: 'assignment', label: '과제/팀플', icon: 'Briefcase' },
    { id: 'exam', label: '시험/평가', icon: 'Target' },
    { id: 'study', label: '개인 공부', icon: 'Coffee' },
    { id: 'appointment', label: '약속/동아리', icon: 'Utensils' },
];


const defaultAccounts = [
    { id: 'cash', name: '현금', type: 'cash', default: true },
    { id: 'bank1', name: '국민은행 예금', type: 'bank' },
    { id: 'bank2', name: '신한은행 입출금', type: 'bank' },
    { id: 'saving1', name: '청년도약계좌', type: 'savings' },
    { id: 'stock1', name: '토스증권', type: 'investment' }
];

const defaultInitialBalances = { cash: 50000, bank1: 5000000, bank2: 1200000, saving1: 3000000, stock1: 2500000 };

const defaultTransactions = [
    { id: 1, type: 'expense', date: format(new Date(), 'yyyy-MM-dd'), time: '08:30 AM', title: '스타벅스', amount: 4500, category: '카페', memo: '출근길 커피', accountId: 'bank2' },
    { id: 2, type: 'income', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00 AM', title: '용돈', amount: 150000, category: '용돈', memo: '', accountId: 'bank2' },
    { id: 3, type: 'expense', date: format(new Date(), 'yyyy-MM-dd'), time: '12:40 PM', title: '점심 식사', amount: 12000, category: '식비', memo: '돈까스', accountId: 'bank2' },
];

const defaultSchedules = [
    { id: 4, date: format(new Date(), 'yyyy-MM-dd'), time: '09:00 AM', category: '업무', title: '팀 미팅', completed: false, memo: '주간 업무 보고' },
];

const defaultGoals = [
    { id: 5, type: 'short', title: '오늘까지 내야 하는 과제', progress: 0, target: 100, deadline: format(new Date(), 'yyyy-MM-dd') },
    { id: 6, type: 'mid', title: '이번 학기 학점 4.0', progress: 20, target: 100, deadline: '2026-06-30' },
    { id: 7, type: 'long', title: '천만원 모으기 프로젝트', progress: 45, target: 100, targetAmount: 10000000, currentAmount: 4500000, deadline: '2026-12-31' },
];

const defaultProfile = {
    name: '사용자',
    theme: 'light',
    accent: 'indigo'
};

export function useAppData() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const [expenseCategories, setExpenseCategories] = useLocalStorage('expenseCategories', defaultExpenseCats);
    const [incomeCategories, setIncomeCategories] = useLocalStorage('incomeCategories', defaultIncomeCats);
    const [scheduleCategories, setScheduleCategories] = useLocalStorage('scheduleCategories', defaultScheduleCats);

    const addCategory = (type, newCategory) => {
        if (type === 'expense') setExpenseCategories(p => [...p, newCategory]);
        else if (type === 'income') setIncomeCategories(p => [...p, newCategory]);
        else setScheduleCategories(p => [...p, newCategory]);
    };

    const deleteCategory = (type, id) => {
        if (type === 'expense') setExpenseCategories(p => p.filter(c => c.id !== id));
        else if (type === 'income') setIncomeCategories(p => p.filter(c => c.id !== id));
        else setScheduleCategories(p => p.filter(c => c.id !== id));
    };

    const [accounts, setAccounts] = useLocalStorage('accounts', defaultAccounts);

    const addAccount = (newAccount) => setAccounts(p => [...p, newAccount]);
    const updateAccount = (id, updatedAccount) => setAccounts(p => p.map(a => a.id === id ? { ...a, ...updatedAccount } : a));
    const deleteAccount = (id) => setAccounts(p => p.filter(a => a.id !== id));

    const [initialBalances] = useLocalStorage('initialBalances', defaultInitialBalances);

    const [transactions, setTransactions] = useLocalStorage('transactions', defaultTransactions);
    const [schedules, setSchedules] = useLocalStorage('schedules', defaultSchedules);
    const [goals, setGoals] = useLocalStorage('goals', defaultGoals);
    const [userProfile, setUserProfile] = useLocalStorage('userProfile', defaultProfile);

    const getCalculatedBalances = () => {
        let balances = { ...initialBalances };
        transactions.forEach(t => {
            if (!balances[t.accountId]) balances[t.accountId] = 0;
            if (t.type === 'income') balances[t.accountId] += t.amount;
            else if (t.type === 'expense') balances[t.accountId] -= t.amount;
        });
        return balances;
    };

    const totalAssets = Object.values(getCalculatedBalances()).reduce((a, b) => a + b, 0);
    const filterDateStr = format(currentDate, 'yyyy-MM-dd');

    return {
        currentDate, setCurrentDate, filterDateStr,
        expenseCategories, incomeCategories, scheduleCategories, addCategory, deleteCategory,
        accounts, addAccount, updateAccount, deleteAccount, getCalculatedBalances, totalAssets,
        transactions, setTransactions,
        schedules, setSchedules,
        goals, setGoals,
        userProfile, setUserProfile
    };
}
