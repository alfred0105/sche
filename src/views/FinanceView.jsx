import React, { useState, useCallback } from 'react';
import { IconMap } from '../components/IconMap';
import { isSameDay, isSameWeek, isSameMonth, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function FinanceView({ transactions, setTransactions, getCalculatedBalances, accounts, currentDate }) {
    const { PieChart, Utensils, Coffee, Train, ShoppingBag, ChevronDown, Trash2, Wallet, TrendingDown } = IconMap;

    const [filterType, setFilterType] = useState('monthly'); // daily, weekly, monthly, all
    const [expandedId, setExpandedId] = useState(null);

    const filteredTransactions = transactions.filter(t => {
        if (filterType === 'all') return true;
        const tDate = parseISO(t.date);
        if (filterType === 'daily') return isSameDay(tDate, currentDate);
        if (filterType === 'weekly') return isSameWeek(tDate, currentDate);
        if (filterType === 'monthly') return isSameMonth(tDate, currentDate);
        return true;
    }).sort((a, b) => b.id - a.id);

    const incomeTotal = filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expenseTotal = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

    const balances = getCalculatedBalances();
    const totalAssets = Object.values(balances).reduce((a, b) => a + b, 0);

    // Calculate Asset Trend Data for the chart dynamically
    const chartData = (() => {
        const data = [];
        let tempAsset = totalAssets;

        // Go back 7 days from current date
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - i);
            // Format to yyyy-MM-dd safely without timezone shift issues
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dt = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${dt}`;

            data.unshift({
                name: `${d.getMonth() + 1}/${d.getDate()}`,
                asset: tempAsset
            });

            // Revert transactions to get the previous day's end balance
            const dayTx = transactions.filter(t => t.date === dateStr);
            dayTx.forEach(t => {
                if (t.type === 'income') tempAsset -= t.amount;
                if (t.type === 'expense') tempAsset += t.amount;
            });
        }
        return data;
    })();

    // Calculate category spending stat
    const categoryData = (() => {
        const expenses = filteredTransactions.filter(t => t.type === 'expense');
        const map = expenses.reduce((acc, curr) => {
            if (!acc[curr.category]) acc[curr.category] = 0;
            acc[curr.category] += curr.amount;
            return acc;
        }, {});
        return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    })();

    const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'];

    const deleteTransaction = (id) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        toast('재정 내역이 삭제되었습니다.', { icon: '🗑️', style: { border: '1px solid #fee2e2' } });
    };

    const handleQuickAssetUpdate = useCallback((type, accountId, accountName) => {
        const val = window.prompt(`${accountName}의 ${type === 'interest' ? '이자/만기수익' : '현재가치 평가손익'}액을 입력하세요.\n(숫자만 입력해 주세요. 만약 손실이 발생했다면 앞에 -를 붙여주세요!)`);
        if (!val || isNaN(val)) return;
        const amount = Number(val);
        if (amount === 0) return;

        const isIncome = amount > 0;
        const absAmount = Math.abs(amount);
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');

        const newTx = {
            id: new Date().getTime(),
            type: isIncome ? 'income' : 'expense',
            date: `${y}-${m}-${d}`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            title: type === 'interest' ? '예적금 이자수익' : isIncome ? '주식/단기 평가수익' : '주식/단기 평가손실',
            amount: absAmount,
            category: type === 'interest' ? '이자 수익' : isIncome ? '투자 수익' : '투자 손실',
            memo: '시스템 간편 평가 업데이트',
            accountId: accountId
        };
        setTransactions(prev => [newTx, ...prev]);
        toast.success(`${accountName} 자산 변동이 정상적으로 기록되었습니다.`, { icon: '📈' });
    }, [currentDate, setTransactions]);

    const cashAccounts = accounts.filter(a => a.type === 'cash' || a.type === 'bank' || !a.type);
    const savingAccounts = accounts.filter(a => a.type === 'savings');
    const investAccounts = accounts.filter(a => a.type === 'investment');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left Col: Lists */}
            <div className="glass-card p-6 min-h-[500px] flex flex-col relative z-10">
                <header className="mb-6 border-b border-slate-100 dark:border-white/5 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <PieChart className="w-6 h-6 text-emerald-500 line-scale" /> 재정 세부 내역
                    </h2>
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl shadow-inner border border-slate-200/50 dark:border-white/5 relative z-20">
                        {['daily', 'weekly', 'monthly', 'all'].map(type => (
                            <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === type ? 'bg-white dark:bg-[#1a1c23] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                {type === 'daily' ? '일간' : type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : '전체'}
                            </button>
                        ))}
                    </div>
                </header>

                {filteredTransactions.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#0f1115]/50 rounded-3xl border border-slate-100 dark:border-white/5 flex-1 flex flex-col items-center justify-center">
                        <Wallet className="w-12 h-12 mx-auto mb-4 text-slate-200 dark:text-white/5" />
                        <p className="font-bold">선택한 기간에 내역이 없습니다.</p>
                    </motion.div>
                ) : (
                    <div className="space-y-4 flex-1">
                        <AnimatePresence>
                            {filteredTransactions.map(exp => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    key={exp.id}
                                    className="flex flex-col border border-slate-100 dark:border-white/5 bg-white dark:bg-[#13151a] shadow-sm p-4 rounded-[1.25rem] hover:shadow-md transition-all group"
                                >
                                    <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex justify-center items-center font-black text-sm transition-transform group-hover:scale-105
                                                ${exp.type === 'income' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400' : 'bg-rose-50 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400'}`}>
                                                {exp.type === 'income' ? '수입' : '지출'}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="block font-bold text-slate-800 dark:text-slate-200 text-sm md:text-base transition-colors group-hover:text-emerald-500 dark:group-hover:text-emerald-400">{exp.title}</span>
                                                <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] mt-0.5">{exp.date} • {exp.time} • {exp.category}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-extrabold text-base md:text-lg ${exp.type === 'income' ? 'text-blue-500 dark:text-blue-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                                {exp.type === 'income' ? '+' : '-'}{exp.amount.toLocaleString()}원
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedId === exp.id ? 'rotate-180 text-emerald-500' : ''}`} />
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {expandedId === exp.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5 mt-4 relative">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-xl"></div>
                                                    <div className="pl-1">
                                                        <span className="text-[10px] font-black tracking-wider uppercase text-emerald-500 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md inline-block mb-1 border border-emerald-100 dark:border-emerald-500/30">{accounts.find(a => a.id === exp.accountId)?.name}</span>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{exp.memo || '세부 내역/메모가 작성되지 않았습니다.'}</p>
                                                    </div>
                                                    <button onClick={() => deleteTransaction(exp.id)} className="text-[11px] shrink-0 flex items-center justify-center gap-1 font-bold text-rose-500 dark:text-rose-400 bg-white dark:bg-[#1a1c23] border border-rose-100 dark:border-rose-500/20 px-3 py-1.5 rounded-lg hover:border-rose-300 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shadow-sm active:scale-95">
                                                        <Trash2 className="w-3.5 h-3.5" /> 내역 삭제
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Right Col: Stats & Bank Accounts */}
            <div className="flex flex-col gap-6 relative z-10">
                {/* Total Assets Overview */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-slate-900 dark:bg-[#13151a] rounded-[1.5rem] p-7 shadow-2xl border border-slate-800 dark:border-white/5 text-white relative overflow-hidden group hover:shadow-[0_8px_30px_-10px_rgba(16,185,129,0.3)] transition-all"
                >
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
                    <h3 className="text-xs font-black tracking-wider uppercase text-slate-400 flex items-center gap-2 mb-2 relative z-10">
                        <Wallet className="w-4 h-4 text-emerald-400" /> 총 자산 (예금/현금 포함)
                    </h3>
                    <div className="flex items-end gap-3 mb-6 relative z-10">
                        <span className="text-4xl lg:text-5xl font-black text-white tracking-tight">{totalAssets.toLocaleString()}원</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-700/50 dark:border-white/10 pt-5 relative z-10">
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">{filterType === 'monthly' ? '월간' : '선택기간'} 총 수입</p>
                            <p className="text-xl font-black text-blue-400">+{incomeTotal.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">{filterType === 'monthly' ? '월간' : '선택기간'} 총 지출</p>
                            <p className="text-xl font-black text-rose-400">-{expenseTotal.toLocaleString()}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Bank Balances */}
                <div className="glass-card p-6 flex flex-col flex-1">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        자산 계좌 관리 <span className="text-[10px] font-bold text-slate-400 font-normal ml-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">여러 방면 기록지원</span>
                    </h3>

                    <div className="space-y-5 flex-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* 1. Cash & Bank */}
                        {cashAccounts.length > 0 && (
                            <div>
                                <p className="text-[11px] font-black tracking-widest text-slate-400 mb-2 px-1 uppercase flex flex-col gap-0.5"><span className="leading-tight">입출금 및 현금</span></p>
                                <div className="space-y-2">
                                    {cashAccounts.map(acc => (
                                        <div key={acc.id} className="flex justify-between items-center bg-slate-50 dark:bg-white/5 p-3 px-4 rounded-xl border border-slate-100 dark:border-white/5">
                                            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{acc.name}</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-slate-100 bg-white dark:bg-[#1a1c23] px-2 py-1 rounded-md shadow-sm border border-slate-100 dark:border-white/5">{(balances[acc.id] || 0).toLocaleString()}원</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. Savings */}
                        {savingAccounts.length > 0 && (
                            <div>
                                <p className="text-[11px] font-black tracking-widest text-emerald-500 mb-2 px-1 uppercase flex flex-col gap-0.5"><span className="leading-tight">저축 및 청약</span></p>
                                <div className="space-y-2">
                                    {savingAccounts.map(acc => (
                                        <div key={acc.id} className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-500/5 p-3 px-4 rounded-xl border border-emerald-100/50 dark:border-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleQuickAssetUpdate('interest', acc.id, acc.name); }} className="mt-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/20 px-2 py-1 rounded-lg w-fit flex items-center gap-1 hover:bg-emerald-200 dark:hover:bg-emerald-500/40 transition-colors border border-emerald-200 dark:border-emerald-500/30">
                                                    + 이자 추가
                                                </button>
                                            </div>
                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#1a1c23] px-2 py-1 rounded-md shadow-sm border border-emerald-100 dark:border-emerald-500/20">{(balances[acc.id] || 0).toLocaleString()}원</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Investments */}
                        {investAccounts.length > 0 && (
                            <div>
                                <p className="text-[11px] font-black tracking-widest text-indigo-500 mb-2 px-1 uppercase flex flex-col gap-0.5"><span className="leading-tight">투자 (주식/크립토)</span></p>
                                <div className="space-y-2">
                                    {investAccounts.map(acc => (
                                        <div key={acc.id} className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-500/5 p-3 px-4 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleQuickAssetUpdate('invest', acc.id, acc.name); }} className="mt-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-500/20 px-2 py-1 rounded-lg w-fit flex items-center gap-1 hover:bg-indigo-200 dark:hover:bg-indigo-500/40 transition-colors border border-indigo-200 dark:border-indigo-500/30">
                                                    ± 변동률 반영
                                                </button>
                                            </div>
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#1a1c23] px-2 py-1 rounded-md shadow-sm border border-indigo-100 dark:border-indigo-500/20">{(balances[acc.id] || 0).toLocaleString()}원</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Pie Chart */}
                <div className="glass-card p-6 flex flex-col min-h-[220px]">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        지출 카테고리 비율
                    </h3>
                    <div className="flex-1 w-full flex items-center justify-center">
                        {categoryData.length === 0 ? (
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">데이터가 없습니다.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <RechartsPie>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val) => [`${val.toLocaleString()}원`, '지출']}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, rgba(15, 23, 42, 0.9))', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                </RechartsPie>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Chart - Dynamic Recharts AreaChart */}
                <div className="glass-card p-6 flex-1 min-h-[250px] flex flex-col">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-emerald-500 scale-y-[-1]" /> 자산 증가 추이 (최근 7일)
                    </h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAsset" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.4} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                                <Tooltip
                                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, rgba(15, 23, 42, 0.9))', backdropFilter: 'blur(8px)', color: '#fff', padding: '12px 16px' }}
                                    formatter={(val) => [`${val.toLocaleString()}원`, '자산']}
                                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="asset" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorAsset)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
