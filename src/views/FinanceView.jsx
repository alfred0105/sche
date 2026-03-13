/**
 * @fileoverview FinanceView — refactored with ConfirmModal, useMemo, accessibility, PropTypes.
 * Added: financial health score (#24), 6-month expense chart (#25), finance diary (#34)
 * Added: anomaly detection (#17), savings goal progress (#19), net worth chart (#21),
 *         spending pattern (#26), portfolio donut (#29), subscription management (#33)
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import BankImportModal from '../components/BankImportModal';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, subDays, getDaysInMonth, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend } from 'recharts';
import { toast } from 'react-hot-toast';
import { PIE_COLORS, ASSET_CHART_DAYS } from '../constants';
import { generateId } from '../utils/helpers';

const SUBSCRIPTIONS_KEY = 'subscriptions';
const DEBTS_KEY = 'ollarounder_debts';

function loadSubscriptions() {
    try {
        return JSON.parse(localStorage.getItem(SUBSCRIPTIONS_KEY) || '[]');
    } catch {
        return [];
    }
}

function loadDebts() {
    try {
        return JSON.parse(localStorage.getItem(DEBTS_KEY) || '[]');
    } catch {
        return [];
    }
}

const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const ASSET_TYPE_LABELS = { cash: '현금', bank: '입출금', savings: '저축', investment: '투자' };

export default function FinanceView({ transactions, setTransactions, getCalculatedBalances, accounts, currentDate, budgets, setBudgets, expenseCategories, initialBalances, setInitialBalances, financeDiary, setFinanceDiary, goals }) {
    const { Wallet, TrendingUp, TrendingDown, PieChart: PieChartIcon, Trash2, RefreshCw, CheckCircle2, ChevronDown, DollarSign, Landmark, BarChart3, Target, Heart, X, Plus, Upload, Pencil, Search, Filter, ArrowUpDown, Copy } = IconMap;

    const [showBankImport, setShowBankImport] = useState(false);

    const [filterType, setFilterType] = useState('daily');
    const [activeSubTab, setActiveSubTab] = useState('list');
    const [expandedAccId, setExpandedAccId] = useState(null);

    // ConfirmModal states
    const [deleteConfirmState, setDeleteConfirmState] = useState({ open: false, txId: null, hasGroup: false });
    const [quickUpdateState, setQuickUpdateState] = useState({ open: false, accId: null, type: '' });
    const [budgetModal, setBudgetModal] = useState({ open: false, categoryId: null, categoryLabel: '', currentBudget: 0 });
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [initBalanceModal, setInitBalanceModal] = useState({ open: false, accId: null, accName: '', currentInit: 0 });

    // 거래 수정 modal
    const [editTxModal, setEditTxModal] = useState({ open: false, tx: null });
    const [editTxForm, setEditTxForm] = useState({});

    const openEditTx = useCallback((tx) => {
        setEditTxForm({
            title: tx.title || '',
            amount: String(tx.amount || ''),
            date: tx.date || '',
            type: tx.type || 'expense',
            category: tx.category || '',
            account: tx.account || '',
            memo: tx.memo || '',
            taxDeductible: tx.taxDeductible || false,
        });
        setEditTxModal({ open: true, tx });
    }, []);

    const saveEditTx = useCallback(() => {
        if (!editTxForm.title?.trim()) return toast.error('항목명을 입력하세요.');
        const amt = Number(editTxForm.amount);
        if (!amt || amt <= 0) return toast.error('올바른 금액을 입력하세요.');
        setTransactions(prev => prev.map(t =>
            t.id === editTxModal.tx.id
                ? { ...t, ...editTxForm, amount: amt }
                : t
        ));
        setEditTxModal({ open: false, tx: null });
        toast.success('거래 내역이 수정되었습니다!', { icon: '✏️' });
    }, [editTxForm, editTxModal.tx, setTransactions]);

    // #17 Anomaly detection banner
    const [anomalyDismissed, setAnomalyDismissed] = useState(false);

    // Transaction list pagination
    const [txVisibleCount, setTxVisibleCount] = useState(20);
    useEffect(() => { setTxVisibleCount(20); }, [filterType]);

    // #18 Filter + sort + #19 Search
    const [txSearch, setTxSearch] = useState('');
    const [txCategoryFilter, setTxCategoryFilter] = useState('all');
    const [txSortOrder, setTxSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'

    // #33 Subscriptions state
    const [subscriptions, setSubscriptions] = useState(loadSubscriptions);
    const [showAddSub, setShowAddSub] = useState(false);
    const [newSub, setNewSub] = useState({ name: '', amount: '', cycle: 'monthly', nextDate: '', category: '구독' });

    // #22 Debt management state
    const [debts, setDebts] = useState(loadDebts);
    const [showAddDebt, setShowAddDebt] = useState(false);
    const [newDebt, setNewDebt] = useState({ name: '', principal: '', interestRate: '', monthlyPayment: '', dueDate: '', memo: '' });

    const saveDebts = (updated) => {
        localStorage.setItem(DEBTS_KEY, JSON.stringify(updated));
        setDebts(updated);
    };
    const handleAddDebt = () => {
        if (!newDebt.name.trim() || !newDebt.principal) return toast.error('이름과 원금을 입력해주세요.');
        saveDebts([...debts, { ...newDebt, id: generateId(), principal: Number(newDebt.principal), interestRate: Number(newDebt.interestRate) || 0, monthlyPayment: Number(newDebt.monthlyPayment) || 0 }]);
        setNewDebt({ name: '', principal: '', interestRate: '', monthlyPayment: '', dueDate: '', memo: '' });
        setShowAddDebt(false);
        toast.success('부채 항목이 추가되었습니다.');
    };
    const handleDeleteDebt = (id) => {
        saveDebts(debts.filter(d => d.id !== id));
        toast('부채 항목을 삭제했습니다.', { icon: '🗑️' });
    };

    const filteredTxs = useMemo(() => {
        const q = txSearch.trim().toLowerCase();
        let result = transactions.filter((t) => {
            const tDate = parseISO(t.date);
            const dateOk = (() => {
                if (filterType === 'daily') return isSameDay(tDate, currentDate);
                if (filterType === 'weekly') return isSameWeek(tDate, currentDate);
                if (filterType === 'monthly') return isSameMonth(tDate, currentDate);
                return true;
            })();
            if (!dateOk) return false;
            if (txCategoryFilter !== 'all' && t.category !== txCategoryFilter) return false;
            if (q) {
                return (t.title || '').toLowerCase().includes(q)
                    || (t.category || '').toLowerCase().includes(q)
                    || (t.memo || '').toLowerCase().includes(q)
                    || String(t.amount).includes(q);
            }
            return true;
        });
        result = [...result].sort((a, b) => {
            if (txSortOrder === 'amount_desc') return b.amount - a.amount;
            if (txSortOrder === 'amount_asc') return a.amount - b.amount;
            if (txSortOrder === 'oldest') return a.date.localeCompare(b.date);
            // newest (default)
            return b.date.localeCompare(a.date) || (typeof a.id === 'string' && typeof b.id === 'string' ? b.id.localeCompare(a.id) : 0);
        });
        return result;
    }, [transactions, filterType, currentDate, txSearch, txCategoryFilter, txSortOrder]);

    const totalIncome = useMemo(() => filteredTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filteredTxs]);
    const totalExpense = useMemo(() => filteredTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filteredTxs]);
    const currentMonthExpense = useMemo(() => transactions.filter((t) => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate)).reduce((s, t) => s + t.amount, 0), [transactions, currentDate]);
    const currentMonthIncome = useMemo(() => transactions.filter((t) => t.type === 'income' && isSameMonth(parseISO(t.date), currentDate)).reduce((s, t) => s + t.amount, 0), [transactions, currentDate]);

    const prevMonthExpense = useMemo(() => {
        const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        return transactions.filter((t) => t.type === 'expense' && isSameMonth(parseISO(t.date), prevMonth)).reduce((s, t) => s + t.amount, 0);
    }, [transactions, currentDate]);

    const expenseChange = prevMonthExpense > 0 ? Math.round(((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100) : 0;

    const balances = getCalculatedBalances();
    const totalAssets = useMemo(() => Object.values(balances).reduce((a, b) => a + b, 0), [balances]);

    // Asset trend chart data (7 days)
    const assetChartData = useMemo(() => {
        const txByDate = {};
        transactions.forEach((t) => {
            if (!txByDate[t.date]) txByDate[t.date] = [];
            txByDate[t.date].push(t);
        });

        let runningAssets = totalAssets;
        const data = [];
        for (let i = 0; i < ASSET_CHART_DAYS; i++) {
            const d = subDays(currentDate, i);
            const ds = format(d, 'yyyy-MM-dd');
            const dayTxs = txByDate[ds] || [];
            data.unshift({ name: format(d, 'M/d'), 자산: runningAssets });
            dayTxs.forEach((t) => {
                if (t.type === 'income') runningAssets -= t.amount;
                else runningAssets += t.amount;
            });
        }
        return data;
    }, [transactions, totalAssets, currentDate]);

    // Category pie chart
    const categoryData = useMemo(() => {
        const catMap = {};
        transactions.filter((t) => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate)).forEach((t) => {
            catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        });
        return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [transactions, currentDate]);

    // #25 Last 6 months expense bar chart
    const sixMonthData = useMemo(() => {
        return Array.from({ length: 6 }).map((_, i) => {
            const monthDate = subMonths(currentDate, 5 - i);
            const total = transactions
                .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), monthDate))
                .reduce((s, t) => s + t.amount, 0);
            return {
                name: format(monthDate, 'M월'),
                지출: total,
            };
        });
    }, [transactions, currentDate]);

    // #24 Financial health score
    const financialHealthScore = useMemo(() => {
        let savingsScore = 0;
        if (currentMonthIncome > 0) {
            const savingsRate = Math.max(0, (currentMonthIncome - currentMonthExpense) / currentMonthIncome);
            savingsScore = Math.min(savingsRate * 40, 40);
        }

        const hasBudgets = budgets && Object.keys(budgets).length > 0;
        let budgetScore = 20;
        if (hasBudgets) {
            const catSpend = {};
            transactions.filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate))
                .forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; });
            const anyExceeded = Object.entries(budgets).some(([catId, limit]) => {
                const spent = catSpend[catId] || 0;
                return limit > 0 && spent > limit;
            });
            budgetScore = anyExceeded ? 15 : 30;
        }

        const assetScore = totalAssets > 0 ? 30 : 0;
        return Math.round(savingsScore + budgetScore + assetScore);
    }, [currentMonthIncome, currentMonthExpense, budgets, transactions, currentDate, totalAssets]);

    const healthColor = financialHealthScore >= 70 ? 'text-emerald-400' : financialHealthScore >= 40 ? 'text-amber-400' : 'text-rose-400';
    const healthBg = financialHealthScore >= 70 ? 'bg-emerald-500/10 border-emerald-500/30' : financialHealthScore >= 40 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/30';
    const healthLabel = financialHealthScore >= 70 ? '재정 건강 양호' : financialHealthScore >= 40 ? '개선 여지 있음' : '위험 신호';
    // #35 A~F grade
    const healthGrade = financialHealthScore >= 80 ? 'A' : financialHealthScore >= 65 ? 'B' : financialHealthScore >= 50 ? 'C' : financialHealthScore >= 35 ? 'D' : 'F';

    // Finance diary helpers (#34)
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    const diaryValue = financeDiary?.[todayStr] || '';
    const handleDiaryChange = (val) => {
        if (setFinanceDiary) {
            setFinanceDiary(prev => ({ ...prev, [todayStr]: val }));
        }
    };

    // #17 Anomaly detection
    const anomalyData = useMemo(() => {
        const todayExpense = transactions
            .filter(t => t.type === 'expense' && isSameDay(parseISO(t.date), currentDate))
            .reduce((s, t) => s + t.amount, 0);
        // 30-day daily average (excluding today)
        const past30Total = Array.from({ length: 30 }, (_, i) => {
            const d = subDays(currentDate, i + 1);
            return transactions
                .filter(t => t.type === 'expense' && isSameDay(parseISO(t.date), d))
                .reduce((s, t) => s + t.amount, 0);
        }).reduce((a, b) => a + b, 0);
        const dailyAvg = past30Total / 30;
        const isAnomaly = dailyAvg > 0 && todayExpense > dailyAvg * 2;
        return { todayExpense, dailyAvg, isAnomaly };
    }, [transactions, currentDate]);

    // #21 Net worth line chart — last 6 months running total
    const netWorthData = useMemo(() => {
        let running = 0;
        return Array.from({ length: 6 }).map((_, i) => {
            const monthDate = subMonths(currentDate, 5 - i);
            const monthIncome = transactions
                .filter(t => t.type === 'income' && isSameMonth(parseISO(t.date), monthDate))
                .reduce((s, t) => s + t.amount, 0);
            const monthExpense = transactions
                .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), monthDate))
                .reduce((s, t) => s + t.amount, 0);
            running += monthIncome - monthExpense;
            return { name: format(monthDate, 'M월'), 순자산: running };
        });
    }, [transactions, currentDate]);

    // #26 Spending pattern by weekday
    const weekdaySpendingData = useMemo(() => {
        const totals = Array(7).fill(0); // 0=Mon..6=Sun
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const d = parseISO(t.date);
                // getDay: 0=Sun, 1=Mon...6=Sat → convert to Mon=0..Sun=6
                const dow = (d.getDay() + 6) % 7;
                totals[dow] += t.amount;
            });
        return totals.map((v, i) => ({ name: WEEKDAY_NAMES[i], 지출: v }));
    }, [transactions]);

    // #29 Portfolio donut — accounts grouped by type
    const portfolioData = useMemo(() => {
        const typeMap = {};
        accounts.forEach(acc => {
            const bal = balances[acc.id] || 0;
            const type = acc.type || 'bank';
            typeMap[type] = (typeMap[type] || 0) + bal;
        });
        const total = Object.values(typeMap).reduce((a, b) => a + b, 0);
        return Object.entries(typeMap)
            .filter(([, v]) => v > 0)
            .map(([type, value]) => ({
                name: ASSET_TYPE_LABELS[type] || type,
                value,
                pct: total > 0 ? Math.round((value / total) * 100) : 0,
            }));
    }, [accounts, balances]);

    // #20 Spending prediction — 3-month average extrapolated to full month
    const spendingPrediction = useMemo(() => {
        const today = currentDate;
        const dayOfMonth = today.getDate();
        const daysInMonth = getDaysInMonth(today);
        const avg3m = Array.from({ length: 3 }, (_, i) => {
            const m = subMonths(today, i + 1);
            return transactions
                .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), m))
                .reduce((s, t) => s + t.amount, 0);
        }).reduce((a, b) => a + b, 0) / 3;
        const projected = dayOfMonth > 0 ? Math.round((currentMonthExpense / dayOfMonth) * daysInMonth) : 0;
        return { avg3m: Math.round(avg3m), projected, dayOfMonth, daysInMonth };
    }, [transactions, currentDate, currentMonthExpense]);

    // #33 Subscription helpers
    const subMonthlyCost = useMemo(() => {
        return subscriptions.reduce((s, sub) => {
            if (sub.cycle === 'monthly') return s + Number(sub.amount || 0);
            if (sub.cycle === 'yearly') return s + Math.round(Number(sub.amount || 0) / 12);
            return s;
        }, 0);
    }, [subscriptions]);

    const saveSubscriptions = (list) => {
        localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(list));
        setSubscriptions(list);
    };

    const handleAddSubscription = () => {
        if (!newSub.name.trim() || !newSub.amount) return toast.error('이름과 금액을 입력해주세요.');
        const sub = { ...newSub, id: generateId(), amount: Number(newSub.amount) };
        saveSubscriptions([...subscriptions, sub]);
        setNewSub({ name: '', amount: '', cycle: 'monthly', nextDate: '', category: '구독' });
        setShowAddSub(false);
        toast.success(`"${sub.name}" 구독이 추가되었습니다.`);
    };

    const handleDeleteSubscription = (id) => {
        saveSubscriptions(subscriptions.filter(s => s.id !== id));
        toast('구독이 삭제되었습니다.', { icon: '🗑️' });
    };

    // #19 Savings goals
    const savingsGoals = useMemo(() => {
        if (!goals) return [];
        return goals.filter(g => g.targetAmount > 0 || g.type === 'savings');
    }, [goals]);

    // #27 Savings rate
    const savingsRate = currentMonthIncome > 0
        ? Math.round(((currentMonthIncome - currentMonthExpense) / currentMonthIncome) * 100)
        : null;

    // #31 Duplicate detection (same date + amount + category in current month)
    const [dupeDismissed, setDupeDismissed] = useState(false);
    const duplicateTxs = useMemo(() => {
        const seen = {};
        const dupes = [];
        transactions
            .filter(t => isSameMonth(parseISO(t.date), currentDate))
            .forEach(t => {
                const key = `${t.date}-${t.amount}-${t.category}`;
                if (seen[key]) {
                    dupes.push(t);
                } else {
                    seen[key] = t;
                }
            });
        return dupes;
    }, [transactions, currentDate]);

    // #21 Budget gauge — top-5 categories with budget set
    const budgetGauges = useMemo(() => {
        if (!budgets || Object.keys(budgets).length === 0) return [];
        const catSpend = {};
        transactions
            .filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate))
            .forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; });
        return Object.entries(budgets)
            .filter(([, limit]) => limit > 0)
            .map(([catId, limit]) => {
                const spent = catSpend[catId] || 0;
                const pct = Math.min(Math.round((spent / limit) * 100), 100);
                return { catId, limit, spent, pct, exceeded: spent > limit };
            })
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 5);
    }, [budgets, transactions, currentDate]);

    const deleteTx = useCallback((txId) => {
        const tx = transactions.find((t) => t.id === txId);
        if (!tx) return;
        setDeleteConfirmState({ open: true, txId, hasGroup: !!tx.groupId });
    }, [transactions]);

    const handleDeleteConfirm = useCallback(() => {
        const { txId, hasGroup } = deleteConfirmState;
        if (hasGroup) {
            const tx = transactions.find((t) => t.id === txId);
            if (tx?.groupId) {
                setTransactions((prev) => prev.filter((t) => t.groupId !== tx.groupId));
                toast('연결된 반복 거래가 모두 삭제되었습니다.', { icon: '🗑️' });
            }
        } else {
            setTransactions((prev) => prev.filter((t) => t.id !== txId));
            toast('거래 내역이 삭제되었습니다.', { icon: '🗑️' });
        }
        setDeleteConfirmState({ open: false, txId: null, hasGroup: false });
    }, [deleteConfirmState, transactions, setTransactions]);

    const openQuickUpdate = useCallback((accId, type) => {
        setQuickUpdateState({ open: true, accId, type });
    }, []);

    const handleQuickUpdate = useCallback((valueStr) => {
        const value = Number(valueStr);
        if (!value || value <= 0) return toast.error('올바른 금액을 입력해주세요!');
        const { accId, type } = quickUpdateState;
        const acc = accounts.find((a) => a.id === accId);
        if (!acc) return;
        setTransactions((prev) => [...prev, {
            id: generateId(),
            type: 'income',
            date: format(currentDate, 'yyyy-MM-dd'),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            title: type === 'interest' ? `${acc.name} 이자 수동반영` : `${acc.name} 평가익 수동 반영`,
            amount: value,
            category: type === 'interest' ? '이자 수익' : '투자 수익',
            memo: `${acc.name} 수동 빠른 갱신`,
            accountId: accId,
        }]);
        toast.success(`${acc.name} 자산 갱신이 반영되었습니다. (+${value.toLocaleString()}원)`, { icon: '💰' });
        setQuickUpdateState({ open: false, accId: null, type: '' });
    }, [quickUpdateState, accounts, setTransactions, currentDate]);

    const handleBudgetUpdate = useCallback((valueStr) => {
        const num = Number(valueStr);
        if (isNaN(num) || num < 0) return toast.error('올바른 예산 금액을 입력해주세요.');
        setBudgets(prev => ({ ...prev, [budgetModal.categoryId]: num }));
        toast.success(`${budgetModal.categoryLabel} 예산이 설정되었습니다.`);
        setBudgetModal({ open: false, categoryId: null, categoryLabel: '', currentBudget: 0 });
    }, [budgetModal, setBudgets]);

    const handleResetBudgets = useCallback(() => {
        setBudgets({});
        toast.success('모든 예산이 초기화되었습니다.');
        setResetConfirmOpen(false);
    }, [setBudgets]);

    const handleInitBalanceUpdate = useCallback((valueStr) => {
        const value = Number(valueStr);
        if (isNaN(value)) return toast.error('올바른 금액을 입력해주세요!');
        setInitialBalances(prev => ({ ...prev, [initBalanceModal.accId]: value }));
        toast.success(`${initBalanceModal.accName} 초기 잔액 설정이 완료되었습니다.`);
        setInitBalanceModal({ open: false, accId: null, accName: '', currentInit: 0 });
    }, [initBalanceModal, setInitialBalances]);

    // 카테고리 레이블 헬퍼
    const allCategories = useMemo(() => {
        const cats = [...(expenseCategories || [])];
        return cats;
    }, [expenseCategories]);

    return (
        <section className="mb-8 space-y-6" aria-label="재정 관리">
            {/* 거래 수정 모달 */}
            {editTxModal.open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="거래 수정">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditTxModal({ open: false, tx: null })} />
                    <div className="relative bg-[#111113] border border-white/10 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-indigo-400" /> 거래 내역 수정
                            </h3>
                            <button onClick={() => setEditTxModal({ open: false, tx: null })} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 수입/지출 토글 */}
                        <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                            {['expense', 'income'].map(t => (
                                <button key={t} onClick={() => setEditTxForm(p => ({ ...p, type: t }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${editTxForm.type === t ? (t === 'expense' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white') : 'text-slate-400'}`}>
                                    {t === 'expense' ? '지출' : '수입'}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">항목명</label>
                                <input type="text" value={editTxForm.title} onChange={e => setEditTxForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">금액 (원)</label>
                                <input type="number" value={editTxForm.amount} onChange={e => setEditTxForm(p => ({ ...p, amount: e.target.value }))}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">날짜</label>
                                <input type="date" value={editTxForm.date} onChange={e => setEditTxForm(p => ({ ...p, date: e.target.value }))}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 outline-none [color-scheme:dark]" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">분류</label>
                                <select value={editTxForm.category} onChange={e => setEditTxForm(p => ({ ...p, category: e.target.value }))}
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 outline-none focus:border-indigo-500">
                                    <option value="">-- 분류 선택 --</option>
                                    {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                            {accounts.length > 0 && (
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">계좌</label>
                                    <select value={editTxForm.account} onChange={e => setEditTxForm(p => ({ ...p, account: e.target.value }))}
                                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 outline-none focus:border-indigo-500">
                                        <option value="">-- 계좌 선택 --</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">메모 (선택)</label>
                                <input type="text" value={editTxForm.memo} onChange={e => setEditTxForm(p => ({ ...p, memo: e.target.value }))}
                                    placeholder="메모를 입력하세요"
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500" />
                            </div>
                            <label className="col-span-2 flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={editTxForm.taxDeductible} onChange={e => setEditTxForm(p => ({ ...p, taxDeductible: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-indigo-500" />
                                <span className="text-xs font-bold text-slate-400">영수증/연말정산 대상</span>
                            </label>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditTxModal({ open: false, tx: null })}
                                className="flex-1 py-2.5 bg-white/5 text-slate-400 font-bold rounded-xl text-sm hover:bg-white/10 transition-colors">
                                취소
                            </button>
                            <button onClick={saveEditTx}
                                className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors">
                                수정 완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={deleteConfirmState.open}
                onClose={() => setDeleteConfirmState({ open: false, txId: null, hasGroup: false })}
                onConfirm={handleDeleteConfirm}
                title="거래 삭제"
                message={deleteConfirmState.hasGroup ? '이 거래는 반복 거래입니다. 연결된 모든 반복 거래를 함께 삭제합니다.' : '이 거래 내역을 삭제하시겠습니까?'}
                confirmText="삭제"
                variant="danger"
            />

            <ConfirmModal
                isOpen={quickUpdateState.open}
                onClose={() => setQuickUpdateState({ open: false, accId: null, type: '' })}
                onConfirm={handleQuickUpdate}
                title="빠른 자산 갱신"
                message={`${quickUpdateState.type === 'interest' ? '이자' : '평가익'} 금액을 입력해주세요.`}
                confirmText="반영"
                variant="info"
                showInput
                inputPlaceholder="금액 (원)"
                inputType="number"
            />

            <ConfirmModal
                isOpen={budgetModal.open}
                onClose={() => setBudgetModal({ open: false, categoryId: null, categoryLabel: '', currentBudget: 0 })}
                onConfirm={handleBudgetUpdate}
                title={`${budgetModal.categoryLabel} 예산 설정`}
                message="월간 목표 예산(원)을 입력해주세요."
                confirmText="설정"
                variant="info"
                showInput
                inputPlaceholder="예: 300000"
                inputType="number"
            />

            <ConfirmModal
                isOpen={resetConfirmOpen}
                onClose={() => setResetConfirmOpen(false)}
                onConfirm={handleResetBudgets}
                title="예산 초기화"
                message="설정한 모든 내역을 초기화하시겠습니까?"
                confirmText="초기화"
                variant="danger"
            />

            <ConfirmModal
                isOpen={initBalanceModal.open}
                onClose={() => setInitBalanceModal({ open: false, accId: null, accName: '', currentInit: 0 })}
                onConfirm={handleInitBalanceUpdate}
                title={`${initBalanceModal.accName} 초기 금액 설정`}
                message="이 계좌의 초기 시작 금액을 입력해주세요."
                confirmText="설정"
                variant="info"
                showInput
                inputPlaceholder="금액 (원)"
                inputType="number"
            />

            {/* Bank import modal */}
            {showBankImport && (
                <BankImportModal
                    onClose={() => setShowBankImport(false)}
                    transactions={transactions}
                    setTransactions={setTransactions}
                />
            )}

            {/* #17 Anomaly detection banner */}
            <AnimatePresence>
                {anomalyData.isAnomaly && !anomalyDismissed && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                    >
                        <span className="text-sm font-bold text-amber-400">
                            ⚠️ 오늘 지출이 평소보다 2배 이상 많습니다 (오늘: ₩{anomalyData.todayExpense.toLocaleString()} / 일평균: ₩{Math.round(anomalyData.dailyAvg).toLocaleString()})
                        </span>
                        <button onClick={() => setAnomalyDismissed(true)} className="text-slate-400 hover:text-slate-200 shrink-0" aria-label="닫기">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Total Assets Card */}
            <div className="glass-card p-4 md:p-5 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-400/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/10 blur-3xl rounded-full" aria-hidden="true" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-500/10 p-2.5 rounded-xl" aria-hidden="true"><Wallet className="w-5 h-5 text-indigo-400" /></div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-100">자산 및 재정 분석</h2>
                            <button
                                onClick={() => setShowBankImport(true)}
                                className="ml-2 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 transition-colors font-medium"
                                title="은행 거래내역 가져오기 (스크린샷/CSV)"
                            >
                                <Upload className="w-3.5 h-3.5" /> 거래내역 가져오기
                            </button>
                        </div>
                        <p className="text-2xl md:text-3xl md:text-4xl font-bold tracking-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400" aria-label={`총 자산 ${totalAssets.toLocaleString()}원`}>
                            ₩{totalAssets.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            {expenseChange !== 0 && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${expenseChange > 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400'}`} aria-live="polite">
                                    {expenseChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    전월 대비 지출 {Math.abs(expenseChange)}% {expenseChange > 0 ? '증가' : '절약'}
                                </span>
                            )}
                            {/* #24 Financial health score badge */}
                            <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border ${healthBg} ${healthColor}`}>
                                <Heart className="w-3 h-3" /> 재정 점수 {financialHealthScore}점 · {healthLabel}
                            </span>
                        </div>
                    </div>
                    <div className="w-full md:w-64 h-32 bg-slate-50/50 dark:bg-white/[0.02] rounded-xl p-2 border border-white/10" aria-label="7일간 자산 추이 차트" role="img">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={assetChartData}>
                                <defs>
                                    <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="자산" stroke="#6366f1" fill="url(#assetGrad)" strokeWidth={3} dot={false} />
                                <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* #24 Financial Health Score Card */}
            <div className={`glass-card p-4 md:p-5 rounded-xl border ${healthBg}`}>
                <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-rose-400" /> 재정 건강 점수
                </h3>
                <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${healthBg}`}>
                        <span className={`text-xl font-bold leading-none ${healthColor}`}>{healthGrade}</span>
                        <span className={`text-[10px] font-bold ${healthColor}`}>{financialHealthScore}점</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>저축률</span><span>예산 준수</span><span>자산 보유</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${financialHealthScore >= 70 ? 'bg-emerald-400' : financialHealthScore >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${financialHealthScore}%` }} />
                        </div>
                        <p className={`text-xs font-bold mt-1.5 ${healthColor}`}>{healthLabel} · {healthGrade}등급 ({financialHealthScore}/100점)</p>
                    </div>
                </div>
            </div>

            {/* #19 Savings Goals */}
            {savingsGoals.length > 0 && (
                <div className="glass-card p-4 md:p-5 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-indigo-400" /> 저축 목표 진행도
                    </h3>
                    <div className="space-y-4">
                        {savingsGoals.map(goal => {
                            const target = goal.targetAmount || 0;
                            const current = goal.currentAmount || goal.progress || 0;
                            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                            return (
                                <div key={goal.id}>
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-sm font-bold text-slate-300">{goal.title}</span>
                                        <span className="text-xs font-bold text-slate-400">
                                            ₩{current.toLocaleString()} {target > 0 && `/ ₩${target.toLocaleString()}`}
                                        </span>
                                    </div>
                                    {target > 0 && (
                                        <>
                                            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                                                    style={{ width: `${Math.max(pct, 1)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold text-indigo-400 mt-1">{pct}% 달성</p>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sub-tabs & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap" role="tablist" aria-label="재정 하위 탭">
                    {[
                        { id: 'list', label: '거래 내역', icon: 'Wallet' },
                        { id: 'category', label: '카테고리별', icon: 'PieChart' },
                        { id: 'monthly', label: '월별 비교', icon: 'BarChart3' },
                        { id: 'networth', label: '순자산', icon: 'TrendingUp' },
                        { id: 'pattern', label: '소비 패턴', icon: 'BarChart3' },
                        { id: 'assets', label: '자산 현황', icon: 'BarChart3' },
                        { id: 'budgets', label: '예산 통제', icon: 'Target' },
                        { id: 'subscriptions', label: '구독', icon: 'RefreshCw' },
                        { id: 'debts', label: '부채', icon: 'TrendingDown' },
                    ].map(({ id, label, icon }) => {
                        const TabIcon = IconMap[icon];
                        return (
                            <button key={id} role="tab" aria-selected={activeSubTab === id} onClick={() => setActiveSubTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${activeSubTab === id ? 'bg-[#111113] border-white/10 text-indigo-400 shadow-none' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                                <TabIcon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex gap-2" role="radiogroup" aria-label="기간 필터">
                    {[{ id: 'daily', label: '일간' }, { id: 'weekly', label: '주간' }, { id: 'monthly', label: '월간' }, { id: 'all', label: '전체' }].map(({ id, label }) => (
                        <button key={id} role="radio" aria-checked={filterType === id} onClick={() => setFilterType(id)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${filterType === id ? 'border-white/10 bg-[#111113] text-indigo-400 shadow-none' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeSubTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    {activeSubTab === 'list' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 거래 리스트
                                </h3>
                                <div className="flex gap-3 text-xs font-bold">
                                    <span className="text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full" aria-label={`수입 ${totalIncome.toLocaleString()}원`}>+{totalIncome.toLocaleString()}원</span>
                                    <span className="text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full" aria-label={`지출 ${totalExpense.toLocaleString()}원`}>-{totalExpense.toLocaleString()}원</span>
                                </div>
                            </div>
                            {/* #27 Savings rate widget */}
                            {savingsRate !== null && (
                                <div className={`flex items-center gap-3 mb-3 p-3 rounded-xl border ${savingsRate >= 20 ? 'bg-emerald-500/5 border-emerald-500/20' : savingsRate >= 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                                    <TrendingUp className={`w-4 h-4 shrink-0 ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 0 ? 'text-amber-400' : 'text-rose-400'}`} />
                                    <span className="text-xs font-bold text-slate-400 flex-1">이번 달 저축률</span>
                                    <span className={`text-sm font-bold ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{savingsRate}%</span>
                                    <span className="text-[10px] text-slate-600">{savingsRate >= 20 ? '우수' : savingsRate >= 0 ? '보통' : '적자'}</span>
                                </div>
                            )}
                            {/* #31 Duplicate detection banner */}
                            {duplicateTxs.length > 0 && !dupeDismissed && (
                                <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <span className="text-sm">⚠️</span>
                                    <span className="text-xs text-amber-400 flex-1">이번 달 중복 의심 거래 {duplicateTxs.length}건이 감지되었습니다. (같은 날짜·금액·분류)</span>
                                    <button onClick={() => setDupeDismissed(true)} className="text-slate-500 hover:text-slate-300 p-1"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                            {/* #21 Budget gauge bars */}
                            {budgetGauges.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    {budgetGauges.map(({ catId, limit, spent, pct, exceeded }) => (
                                        <div key={catId}>
                                            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                                <span className="text-slate-400">{catId}</span>
                                                <span className={exceeded ? 'text-rose-400' : 'text-slate-500'}>{spent.toLocaleString()} / {limit.toLocaleString()}원</span>
                                            </div>
                                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${exceeded ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* #18 Filter + Sort + #19 Search */}
                            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                        type="text"
                                        value={txSearch}
                                        onChange={e => { setTxSearch(e.target.value); setTxVisibleCount(20); }}
                                        placeholder="거래 검색 (항목명/카테고리/메모/금액)..."
                                        className="w-full bg-[#111113] border border-white/10 pl-8 pr-3 py-2 rounded-lg text-xs font-bold text-slate-300 focus:border-indigo-500 outline-none placeholder:text-slate-600"
                                    />
                                    {txSearch && (
                                        <button onClick={() => setTxSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <select
                                        value={txCategoryFilter}
                                        onChange={e => { setTxCategoryFilter(e.target.value); setTxVisibleCount(20); }}
                                        className="bg-[#111113] border border-white/10 px-2 py-2 rounded-lg text-xs font-bold text-slate-300 focus:border-indigo-500 outline-none"
                                        aria-label="카테고리 필터"
                                    >
                                        <option value="all">전체 카테고리</option>
                                        {[...new Set(transactions.map(t => t.category).filter(Boolean))].sort().map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={txSortOrder}
                                        onChange={e => { setTxSortOrder(e.target.value); setTxVisibleCount(20); }}
                                        className="bg-[#111113] border border-white/10 px-2 py-2 rounded-lg text-xs font-bold text-slate-300 focus:border-indigo-500 outline-none"
                                        aria-label="정렬 순서"
                                    >
                                        <option value="newest">최신순</option>
                                        <option value="oldest">오래된순</option>
                                        <option value="amount_desc">금액 많은순</option>
                                        <option value="amount_asc">금액 적은순</option>
                                    </select>
                                </div>
                            </div>
                            {filteredTxs.length === 0 ? (
                                <div className="text-center py-20 text-slate-400"><PieChartIcon className="w-10 h-10 mx-auto mb-3 text-slate-200 dark:text-white/5" aria-hidden="true" /><p className="font-bold">조건에 해당하는 거래 내역이 없습니다.</p></div>
                            ) : (
                                <div className="space-y-2" role="list" aria-label="거래 목록">
                                    {filteredTxs.slice(0, txVisibleCount).map((tx) => (
                                        <div key={tx.id} className="flex items-center gap-4 py-2.5 px-4 hover:bg-white/10 rounded-xl group transition-colors" role="listitem">
                                            <div className={`w-10 h-10 rounded-xl ${tx.type === 'income' ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-rose-50 dark:bg-rose-500/10'} flex items-center justify-center shrink-0 shadow-none`} aria-hidden="true">
                                                {tx.type === 'income' ? <TrendingUp className="w-5 h-5 text-blue-500" /> : <TrendingDown className="w-5 h-5 text-rose-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-400 truncate">{tx.title}</p>
                                                <p className="text-[10px] text-slate-400 font-bold flex flex-wrap gap-1.5 mt-1">
                                                    <span>{tx.date}</span><span>{tx.time}</span>
                                                    <span className="bg-white/5 px-1.5 py-0 rounded">{tx.category}</span>
                                                    {tx.taxDeductible && <span className="text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0 rounded border border-rose-200 dark:border-rose-500/30">영수증/연말정산</span>}
                                                    {tx.memo && <span className="truncate max-w-[80px]">{tx.memo}</span>}
                                                </p>
                                            </div>
                                            <span className={`text-base font-bold tracking-tight whitespace-nowrap ${tx.type === 'income' ? 'text-blue-500' : 'text-rose-500'}`}>
                                                {tx.type === 'income' ? '+' : '-'}₩{tx.amount.toLocaleString()}
                                            </span>
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openEditTx(tx)} className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg transition-colors" aria-label={`${tx.title} 수정`}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                {/* #20 Copy transaction */}
                                                <button
                                                    onClick={() => {
                                                        const copied = { ...tx, id: generateId(), date: format(new Date(), 'yyyy-MM-dd'), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
                                                        setTransactions(prev => [...prev, copied]);
                                                        toast.success(`"${tx.title}" 오늘 날짜로 복사됐습니다!`, { icon: '📋' });
                                                    }}
                                                    className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg transition-colors"
                                                    aria-label={`${tx.title} 복사`}
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteTx(tx.id)} className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg transition-colors" aria-label={`${tx.title} 거래 삭제`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredTxs.length > txVisibleCount && (
                                        <button
                                            onClick={() => setTxVisibleCount(c => c + 20)}
                                            className="w-full py-2 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all"
                                        >
                                            + {filteredTxs.length - txVisibleCount}개 더 보기
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeSubTab === 'category' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <PieChartIcon className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 이번 달 카테고리별 지출
                            </h3>
                            {categoryData.length === 0 ? (
                                <div className="text-center py-20 text-slate-400"><p className="font-bold">이번 달 지출 데이터가 없습니다.</p></div>
                            ) : (
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    <div className="w-56 h-56" role="img" aria-label="카테고리별 지출 파이 차트">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={categoryData} innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                                    {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', fontSize: '12px', fontWeight: 'bold' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-3 w-full" role="list" aria-label="카테고리 목록">
                                        {categoryData.map((cat, i) => (
                                            <div key={cat.name} className="flex items-center gap-3" role="listitem">
                                                <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden="true" />
                                                <span className="text-sm font-bold text-slate-200 flex-1 truncate">{cat.name}</span>
                                                <span className="text-sm font-bold tracking-tight text-slate-100">₩{cat.value.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400 w-10 text-right">{Math.round((cat.value / currentMonthExpense) * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* #25 6-month comparison chart */}
                    {activeSubTab === 'monthly' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <BarChart3 className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 최근 6개월 지출 비교
                            </h3>
                            {sixMonthData.every(d => d.지출 === 0) ? (
                                <div className="text-center py-20 text-slate-400"><p className="font-bold">지출 데이터가 없습니다.</p></div>
                            ) : (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sixMonthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                                            <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(15,15,20,0.95)', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                            <Bar dataKey="지출" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* #20 Spending prediction */}
                            {spendingPrediction.avg3m > 0 && (
                                <div className="mt-5 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                    <p className="text-xs font-bold text-slate-500 mb-3">📊 이번 달 지출 예측</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-slate-500 mb-1">현재까지</p>
                                            <p className="text-sm font-bold text-rose-400">₩{currentMonthExpense.toLocaleString()}</p>
                                            <p className="text-[9px] text-slate-600">{spendingPrediction.dayOfMonth}일째</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-slate-500 mb-1">예상 월말</p>
                                            <p className={`text-sm font-bold ${spendingPrediction.projected > spendingPrediction.avg3m ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                ₩{spendingPrediction.projected.toLocaleString()}
                                            </p>
                                            <p className="text-[9px] text-slate-600">일비율 기반</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-slate-500 mb-1">3개월 평균</p>
                                            <p className="text-sm font-bold text-indigo-400">₩{spendingPrediction.avg3m.toLocaleString()}</p>
                                            <p className="text-[9px] text-slate-600">기준선</p>
                                        </div>
                                    </div>
                                    {spendingPrediction.projected > spendingPrediction.avg3m && (
                                        <p className="text-[10px] font-bold text-amber-400 mt-2 text-center">
                                            ⚠️ 평균보다 ₩{(spendingPrediction.projected - spendingPrediction.avg3m).toLocaleString()} 초과 예상
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* #21 Net Worth Chart */}
                    {activeSubTab === 'networth' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <TrendingUp className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 순자산 변화 (최근 6개월)
                            </h3>
                            {netWorthData.every(d => d.순자산 === 0) ? (
                                <div className="text-center py-20 text-slate-400"><p className="font-bold">거래 데이터가 없습니다.</p></div>
                            ) : (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={netWorthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                                            <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(15,15,20,0.95)', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                            <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                                            <Line type="monotone" dataKey="순자산" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* #26 Spending Pattern by Weekday */}
                    {activeSubTab === 'pattern' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <BarChart3 className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 소비 패턴 — 요일별 지출
                            </h3>
                            {weekdaySpendingData.every(d => d.지출 === 0) ? (
                                <div className="text-center py-20 text-slate-400"><p className="font-bold">지출 데이터가 없습니다.</p></div>
                            ) : (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weekdaySpendingData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                                            <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(15,15,20,0.95)', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                            <Bar dataKey="지출" fill="#a855f7" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {activeSubTab === 'assets' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <Landmark className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 보유 자산 현황
                            </h3>

                            {/* #29 Portfolio donut chart */}
                            {portfolioData.length > 0 && (
                                <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                    <p className="text-xs font-bold text-slate-500 mb-3">자산 유형별 비율</p>
                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        <div className="w-44 h-44 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={portfolioData} innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                                        {portfolioData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(15,15,20,0.95)', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 space-y-2 w-full">
                                            {portfolioData.map((item, i) => (
                                                <div key={item.name} className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                    <span className="text-sm font-bold text-slate-300 flex-1">{item.name}</span>
                                                    <span className="text-sm font-bold text-slate-100">₩{item.value.toLocaleString()}</span>
                                                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">{item.pct}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3" role="list" aria-label="보유 자산 목록">
                                {accounts.map((acc) => {
                                    const bal = balances[acc.id] || 0;
                                    const pct = totalAssets > 0 ? Math.round((bal / totalAssets) * 100) : 0;
                                    return (
                                        <div key={acc.id} className="bg-[#09090b][0.03] p-4 rounded-xl border border-white/10 group" role="listitem">
                                            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedAccId(expandedAccId === acc.id ? null : acc.id)} role="button" tabIndex={0} aria-expanded={expandedAccId === acc.id} onKeyDown={(e) => e.key === 'Enter' && setExpandedAccId(expandedAccId === acc.id ? null : acc.id)}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold tracking-tight tracking-tighter text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-500/30">
                                                        {acc.type === 'savings' ? '저축' : acc.type === 'investment' ? '투자' : acc.type === 'bank' ? '입출금' : '현금'}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-200">{acc.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold tracking-tight text-slate-100">₩{bal.toLocaleString()}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{pct}%</span>
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedAccId === acc.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                            </div>
                                            <AnimatePresence>
                                                {expandedAccId === acc.id && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                        <div className="mt-4 flex gap-2 flex-wrap">
                                                            {(acc.type === 'savings' || acc.type === 'investment') && (
                                                                <button onClick={() => openQuickUpdate(acc.id, acc.type === 'savings' ? 'interest' : 'investment')} className="flex items-center gap-1 text-xs font-bold bg-[#111113] border border-white/10 px-3 py-2 rounded-lg hover:border-indigo-200 dark:hover:border-indigo-500/50 text-indigo-500 transition-all shadow-none">
                                                                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {acc.type === 'savings' ? '이자 수동반영' : '평가익 반영'}
                                                                </button>
                                                            )}
                                                            <button onClick={() => setInitBalanceModal({ open: true, accId: acc.id, accName: acc.name, currentInit: initialBalances[acc.id] || 0 })} className="flex items-center gap-1 text-xs font-bold bg-[#111113] border border-white/10 px-3 py-2 rounded-lg hover:border-slate-300 dark:hover:border-white/20 text-slate-500 transition-all shadow-none">
                                                                ⚙️ 초기 금액 설정
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'budgets' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                                <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-rose-500" aria-hidden="true" /> 카테고리별 예산 통제
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setResetConfirmOpen(true)} className="text-[11px] font-bold text-slate-500 bg-[#09090b] border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50">
                                        기본값 초기화
                                    </button>
                                    <div className="text-[11px] font-bold text-slate-500 px-3 py-1.5 bg-[#09090b] border border-white/10 rounded-lg shadow-none">
                                        {format(currentDate, 'yyyy년 M월')} 기준
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {expenseCategories.map(cat => {
                                    const budget = budgets[cat.id] || 0;
                                    const spent = categoryData.find(d => d.name === cat.label)?.value || 0;
                                    const rawPct = budget > 0 ? (spent / budget) * 100 : 0;
                                    const pct = Math.min(100, Math.round(rawPct));
                                    const isExceeded = rawPct > 100;
                                    const isWarning = rawPct >= 90 && !isExceeded;

                                    const daysInMonth = getDaysInMonth(currentDate);
                                    const remainingDays = Math.max(1, daysInMonth - currentDate.getDate() + 1);
                                    const remainingBudget = Math.max(0, budget - spent);
                                    const dailySafeSpend = budget > 0 ? Math.floor(remainingBudget / remainingDays) : 0;

                                    return (
                                        <div key={cat.id} className="relative group p-2 -mx-2 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-200">{cat.label}</span>
                                                    {isExceeded && <span className="text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 px-2 flex items-center gap-1 py-0.5 rounded-lg font-bold tracking-tight border border-rose-200 dark:border-rose-500/30">초과 위험!</span>}
                                                    {isWarning && <span className="text-[10px] bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 px-2 flex items-center gap-1 py-0.5 rounded-lg font-bold tracking-tight border border-orange-200 dark:border-orange-500/30">예산 임박</span>}
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <button onClick={() => setBudgetModal({ open: true, categoryId: cat.id, categoryLabel: cat.label, currentBudget: budget })} className="text-[11px] text-indigo-500 hover:text-indigo-400 dark:hover:text-indigo-300 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-md p-1 sm:opacity-0 sm:group-hover:opacity-100 opacity-100" aria-label={`${cat.label} 예산 수정`}>
                                                        ⚙️ <span className="hidden sm:inline">예산 수정</span>
                                                    </button>
                                                    <div className="text-sm font-bold tracking-tight text-slate-100">
                                                        ₩{spent.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold ml-1">/ {budget > 0 ? `₩${budget.toLocaleString()}` : "미설정"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="h-4 w-full bg-white/5 border border-slate-200/50 dark:border-white/5 rounded-full overflow-hidden flex relative" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                                                <div className={`h-full rounded-full transition-all duration-1000 ${budget === 0 ? 'bg-slate-300 dark:bg-slate-700' : isExceeded ? 'bg-rose-500' : isWarning ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                                            </div>
                                            <div className="mt-2 flex justify-between items-center text-[11px] font-bold">
                                                <span className={`text-slate-400 ${isExceeded ? 'text-rose-500' : ''}`}>
                                                    {budget === 0 ? '목표 예산이 설정되지 않았습니다' : isExceeded ? `${(rawPct - 100).toFixed(1)}% 초과 (통제 불능)` : `${pct}% 사용됨 / 남은 금액 ₩${remainingBudget.toLocaleString()}`}
                                                </span>
                                                {budget > 0 && !isExceeded && (
                                                    <span className="text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-md">
                                                        하루 권장: ₩{dailySafeSpend.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* #33 Subscriptions tab */}
                    {activeSubTab === 'subscriptions' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2">
                                        <RefreshCw className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 보험 / 구독 관리
                                    </h3>
                                    {subscriptions.length > 0 && (
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            월 총 비용: <span className="text-indigo-400">₩{subMonthlyCost.toLocaleString()}</span>
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowAddSub(s => !s)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all active:scale-95"
                                >
                                    <Plus className="w-3.5 h-3.5" /> 추가
                                </button>
                            </div>

                            {/* Add subscription form */}
                            <AnimatePresence>
                                {showAddSub && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mb-5"
                                    >
                                        <div className="bg-[#09090b] border border-indigo-500/30 rounded-xl p-4 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    value={newSub.name}
                                                    onChange={e => setNewSub(s => ({ ...s, name: e.target.value }))}
                                                    placeholder="이름 (예: 넷플릭스)"
                                                    className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                />
                                                <input
                                                    type="number"
                                                    value={newSub.amount}
                                                    onChange={e => setNewSub(s => ({ ...s, amount: e.target.value }))}
                                                    placeholder="금액 (원)"
                                                    className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <select
                                                    value={newSub.cycle}
                                                    onChange={e => setNewSub(s => ({ ...s, cycle: e.target.value }))}
                                                    className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                >
                                                    <option value="monthly">매월</option>
                                                    <option value="yearly">매년</option>
                                                </select>
                                                <input
                                                    type="date"
                                                    value={newSub.nextDate}
                                                    onChange={e => setNewSub(s => ({ ...s, nextDate: e.target.value }))}
                                                    className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                />
                                                <select
                                                    value={newSub.category}
                                                    onChange={e => setNewSub(s => ({ ...s, category: e.target.value }))}
                                                    className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                >
                                                    <option value="구독">구독</option>
                                                    <option value="보험">보험</option>
                                                    <option value="기타">기타</option>
                                                </select>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setShowAddSub(false)} className="px-3 py-1.5 text-xs font-bold text-slate-400 bg-[#111113] border border-white/10 rounded-lg hover:bg-white/10">취소</button>
                                                <button onClick={handleAddSubscription} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600">저장</button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {subscriptions.length === 0 ? (
                                <div className="text-center py-20 text-slate-400">
                                    <RefreshCw className="w-10 h-10 mx-auto mb-3 text-white/5" />
                                    <p className="font-bold">등록된 구독/보험이 없습니다.</p>
                                    <p className="text-xs mt-1">+ 추가 버튼으로 정기 결제 항목을 등록하세요.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {subscriptions.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-all">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{sub.category}</span>
                                                    <p className="text-sm font-bold text-slate-200 truncate">{sub.name}</p>
                                                </div>
                                                <p className="text-xs text-slate-500 font-bold mt-1">
                                                    {sub.cycle === 'monthly' ? '매월' : '매년'} · {sub.nextDate ? `다음 결제일: ${sub.nextDate}` : '결제일 미설정'}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-bold text-slate-100">₩{Number(sub.amount).toLocaleString()}</p>
                                                {sub.cycle === 'yearly' && (
                                                    <p className="text-[10px] text-slate-500 font-bold">월 환산 ₩{Math.round(sub.amount / 12).toLocaleString()}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSubscription(sub.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-1.5 rounded-lg"
                                                aria-label={`${sub.name} 구독 삭제`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* #22 Debt Management Tab */}
                    {activeSubTab === 'debts' && (
                        <div className="space-y-4">
                            {/* Total debt summary */}
                            {debts.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-rose-400">₩{debts.reduce((s, d) => s + d.principal, 0).toLocaleString()}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-bold">총 부채 원금</p>
                                    </div>
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center">
                                        <p className="text-xl font-bold text-amber-400">₩{debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0).toLocaleString()}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-bold">월 상환 합계</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center col-span-2 md:col-span-1">
                                        <p className="text-xl font-bold text-slate-200">{debts.length}건</p>
                                        <p className="text-xs text-slate-500 mt-1 font-bold">부채 항목 수</p>
                                    </div>
                                </div>
                            )}

                            {/* Add debt toggle */}
                            <button
                                onClick={() => setShowAddDebt(v => !v)}
                                className="flex items-center gap-2 text-sm font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 px-4 py-2 rounded-xl transition-colors"
                            >
                                <Plus className="w-4 h-4" /> 부채/대출 추가
                            </button>

                            <AnimatePresence>
                                {showAddDebt && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">항목명 *</label>
                                                    <input value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} placeholder="예: 학자금 대출" className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">원금 *</label>
                                                    <input type="number" value={newDebt.principal} onChange={e => setNewDebt(p => ({ ...p, principal: e.target.value }))} placeholder="0" className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">연이율 (%)</label>
                                                    <input type="number" step="0.1" value={newDebt.interestRate} onChange={e => setNewDebt(p => ({ ...p, interestRate: e.target.value }))} placeholder="0.0" className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">월 상환액</label>
                                                    <input type="number" value={newDebt.monthlyPayment} onChange={e => setNewDebt(p => ({ ...p, monthlyPayment: e.target.value }))} placeholder="0" className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">만기일</label>
                                                    <input type="date" value={newDebt.dueDate} onChange={e => setNewDebt(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors [color-scheme:dark]" />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">메모</label>
                                                    <input value={newDebt.memo} onChange={e => setNewDebt(p => ({ ...p, memo: e.target.value }))} placeholder="비고 사항" className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-rose-500 transition-colors" />
                                                </div>
                                            </div>
                                            <button onClick={handleAddDebt} className="w-full bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-bold py-2.5 rounded-xl text-sm transition-colors">추가하기</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {debts.length === 0 ? (
                                <div className="text-center py-16 text-slate-500">
                                    <TrendingDown className="w-10 h-10 mx-auto mb-3 text-white/5" />
                                    <p className="font-bold">등록된 부채/대출이 없습니다.</p>
                                    <p className="text-xs mt-1">+ 추가 버튼으로 대출 항목을 등록하세요.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {debts.map(debt => {
                                        const monthlyInterest = debt.interestRate > 0 ? Math.round(debt.principal * (debt.interestRate / 100) / 12) : 0;
                                        const monthsLeft = debt.monthlyPayment > 0 ? Math.ceil(debt.principal / debt.monthlyPayment) : null;
                                        return (
                                            <div key={debt.id} className="flex items-start gap-4 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-rose-500/20 transition-all">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-sm font-bold text-slate-200">{debt.name}</p>
                                                        {debt.dueDate && <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">만기 {debt.dueDate}</span>}
                                                    </div>
                                                    <div className="flex flex-wrap gap-3 text-xs font-bold">
                                                        <span className="text-rose-400">원금 ₩{debt.principal.toLocaleString()}</span>
                                                        {debt.interestRate > 0 && <span className="text-amber-400">연 {debt.interestRate}% · 월이자 ₩{monthlyInterest.toLocaleString()}</span>}
                                                        {debt.monthlyPayment > 0 && <span className="text-slate-400">월 상환 ₩{debt.monthlyPayment.toLocaleString()}</span>}
                                                        {monthsLeft && <span className="text-indigo-400">약 {monthsLeft}개월 후 완납 예정</span>}
                                                    </div>
                                                    {debt.memo && <p className="text-[10px] text-slate-600 mt-1">{debt.memo}</p>}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteDebt(debt.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-1.5 rounded-lg shrink-0"
                                                    aria-label={`${debt.name} 삭제`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* #34 Finance Diary */}
            <div className="glass-card p-4 md:p-5 rounded-xl">
                <h3 className="font-bold tracking-tight text-base text-slate-100 flex items-center gap-2 mb-3">
                    📔 재정 일기 <span className="text-xs font-bold text-slate-500">({todayStr})</span>
                </h3>
                <textarea
                    value={diaryValue}
                    onChange={e => handleDiaryChange(e.target.value)}
                    placeholder="오늘의 소비 습관, 재정 목표, 절약 다짐을 자유롭게 기록해보세요..."
                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none min-h-[100px] placeholder-slate-600 font-medium"
                    rows={4}
                />
                {diaryValue && (
                    <p className="text-[10px] text-slate-600 mt-1 text-right font-bold">자동 저장됨 ✓</p>
                )}
            </div>
        </section>
    );
}

FinanceView.propTypes = {
    transactions: PropTypes.array.isRequired,
    setTransactions: PropTypes.func.isRequired,
    getCalculatedBalances: PropTypes.func.isRequired,
    accounts: PropTypes.array.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    budgets: PropTypes.object,
    setBudgets: PropTypes.func,
    expenseCategories: PropTypes.array,
    initialBalances: PropTypes.object,
    setInitialBalances: PropTypes.func,
    financeDiary: PropTypes.object,
    setFinanceDiary: PropTypes.func,
    goals: PropTypes.array,
};
