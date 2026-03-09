/**
 * @fileoverview FinanceView — refactored with ConfirmModal, useMemo, accessibility, PropTypes.
 * Added: financial health score (#24), 6-month expense chart (#25), finance diary (#34)
 */
import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, subDays, getDaysInMonth, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { toast } from 'react-hot-toast';
import { PIE_COLORS, ASSET_CHART_DAYS } from '../constants';
import { generateId } from '../utils/helpers';

export default function FinanceView({ transactions, setTransactions, getCalculatedBalances, accounts, currentDate, budgets, setBudgets, expenseCategories, initialBalances, setInitialBalances, financeDiary, setFinanceDiary }) {
    const { Wallet, TrendingUp, TrendingDown, PieChart: PieChartIcon, Trash2, RefreshCw, CheckCircle2, ChevronDown, DollarSign, Landmark, BarChart3, Target, Heart } = IconMap;

    const [filterType, setFilterType] = useState('daily');
    const [activeSubTab, setActiveSubTab] = useState('list');
    const [expandedAccId, setExpandedAccId] = useState(null);

    // ConfirmModal states
    const [deleteConfirmState, setDeleteConfirmState] = useState({ open: false, txId: null, hasGroup: false });
    const [quickUpdateState, setQuickUpdateState] = useState({ open: false, accId: null, type: '' });
    const [budgetModal, setBudgetModal] = useState({ open: false, categoryId: null, categoryLabel: '', currentBudget: 0 });
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [initBalanceModal, setInitBalanceModal] = useState({ open: false, accId: null, accName: '', currentInit: 0 });

    const filteredTxs = useMemo(() => {
        return transactions.filter((t) => {
            const tDate = parseISO(t.date);
            if (filterType === 'daily') return isSameDay(tDate, currentDate);
            if (filterType === 'weekly') return isSameWeek(tDate, currentDate);
            if (filterType === 'monthly') return isSameMonth(tDate, currentDate);
            return true;
        }).sort((a, b) => {
            if (typeof a.id === 'string' && typeof b.id === 'string') return b.id.localeCompare(a.id);
            return 0;
        });
    }, [transactions, filterType, currentDate]);

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
        // Savings rate: (income - expense) / income × 40pts
        let savingsScore = 0;
        if (currentMonthIncome > 0) {
            const savingsRate = Math.max(0, (currentMonthIncome - currentMonthExpense) / currentMonthIncome);
            savingsScore = Math.min(savingsRate * 40, 40);
        }

        // Budget compliance: 30pts if all under, 15pts if some exceeded, 20pts if no budgets set
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

        // Asset growth: 30pts if positive, 0 if not
        const assetScore = totalAssets > 0 ? 30 : 0;

        return Math.round(savingsScore + budgetScore + assetScore);
    }, [currentMonthIncome, currentMonthExpense, budgets, transactions, currentDate, totalAssets]);

    const healthColor = financialHealthScore >= 70 ? 'text-emerald-400' : financialHealthScore >= 40 ? 'text-amber-400' : 'text-rose-400';
    const healthBg = financialHealthScore >= 70 ? 'bg-emerald-500/10 border-emerald-500/30' : financialHealthScore >= 40 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/30';
    const healthLabel = financialHealthScore >= 70 ? '재정 건강 양호' : financialHealthScore >= 40 ? '개선 여지 있음' : '위험 신호';

    // Finance diary helpers (#34)
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    const diaryValue = financeDiary?.[todayStr] || '';
    const handleDiaryChange = (val) => {
        if (setFinanceDiary) {
            setFinanceDiary(prev => ({ ...prev, [todayStr]: val }));
        }
    };

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

    return (
        <section className="mb-8 space-y-6" aria-label="재정 관리">
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

            {/* Total Assets Card */}
            <div className="glass-card p-4 md:p-5 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-400/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/10 blur-3xl rounded-full" aria-hidden="true" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-500/10 p-2.5 rounded-xl" aria-hidden="true"><Wallet className="w-5 h-5 text-indigo-400" /></div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-100">자산 및 재정 분석</h2>
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
                    <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0 ${healthBg}`}>
                        <span className={`text-xl font-bold ${healthColor}`}>{financialHealthScore}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>저축률</span><span>예산 준수</span><span>자산 보유</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${financialHealthScore >= 70 ? 'bg-emerald-400' : financialHealthScore >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${financialHealthScore}%` }} />
                        </div>
                        <p className={`text-xs font-bold mt-1.5 ${healthColor}`}>{healthLabel} · {financialHealthScore}/100점</p>
                    </div>
                </div>
            </div>

            {/* Sub-tabs & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap" role="tablist" aria-label="재정 하위 탭">
                    {[
                        { id: 'list', label: '거래 내역', icon: 'Wallet' },
                        { id: 'category', label: '카테고리별', icon: 'PieChart' },
                        { id: 'monthly', label: '월별 비교', icon: 'BarChart3' },
                        { id: 'assets', label: '자산 현황', icon: 'BarChart3' },
                        { id: 'budgets', label: '예산 통제', icon: 'Target' },
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
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 거래 리스트
                                </h3>
                                <div className="flex gap-3 text-xs font-bold">
                                    <span className="text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full" aria-label={`수입 ${totalIncome.toLocaleString()}원`}>+{totalIncome.toLocaleString()}원</span>
                                    <span className="text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full" aria-label={`지출 ${totalExpense.toLocaleString()}원`}>-{totalExpense.toLocaleString()}원</span>
                                </div>
                            </div>
                            {filteredTxs.length === 0 ? (
                                <div className="text-center py-20 text-slate-400"><PieChartIcon className="w-10 h-10 mx-auto mb-3 text-slate-200 dark:text-white/5" aria-hidden="true" /><p className="font-bold">조건에 해당하는 거래 내역이 없습니다.</p></div>
                            ) : (
                                <div className="space-y-2" role="list" aria-label="거래 목록">
                                    {filteredTxs.map((tx) => (
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
                                            <button onClick={() => deleteTx(tx.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 rounded-lg transition-all" aria-label={`${tx.title} 거래 삭제`}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
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
                        </div>
                    )}

                    {activeSubTab === 'assets' && (
                        <div className="glass-card p-4 md:p-5 min-h-[400px]">
                            <h3 className="font-bold tracking-tight text-lg text-slate-100 flex items-center gap-2 mb-5">
                                <Landmark className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 보유 자산 현황
                            </h3>
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
};