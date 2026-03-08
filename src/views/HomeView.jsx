/**
 * @fileoverview HomeView — refactored with useMemo, ARIA, and PropTypes.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, subDays, differenceInDays } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_DAYS_RANGE } from '../constants';

export default function HomeView({ schedules, transactions, totalAssets, setCurrentTab, currentDate, goals }) {
    const { CheckCircle2, Circle, ChevronRight, Flag, CalendarCheck } = IconMap;

    const todayStr = format(currentDate, 'yyyy-MM-dd');

    const todaySchedules = useMemo(() =>
        schedules.filter((s) => s.date === todayStr).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
        [schedules, todayStr]
    );
    const todayCompletedCount = useMemo(() => todaySchedules.filter((s) => s.completed).length, [todaySchedules]);

    const todayIncome = useMemo(() => transactions.filter((t) => isSameDay(parseISO(t.date), currentDate) && t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions, currentDate]);
    const todayExpense = useMemo(() => transactions.filter((t) => isSameDay(parseISO(t.date), currentDate) && t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions, currentDate]);

    // Optimized 60-day chart — build date-transaction map first
    const assetData = useMemo(() => {
        const txByDate = {};
        transactions.forEach((t) => {
            if (!txByDate[t.date]) txByDate[t.date] = [];
            txByDate[t.date].push(t);
        });

        let running = totalAssets;
        const data = [];
        for (let i = 0; i < CHART_DAYS_RANGE; i++) {
            const d = subDays(currentDate, i);
            const ds = format(d, 'yyyy-MM-dd');
            const dayTxs = txByDate[ds] || [];
            data.unshift({ name: format(d, 'M/d'), 자산: running });
            dayTxs.forEach((t) => {
                if (t.type === 'income') running -= t.amount;
                else running += t.amount;
            });
        }
        return data;
    }, [transactions, totalAssets, currentDate]);

    const primaryGoal = useMemo(() => goals.find((g) => g.type === 'short' && g.progress < 100) || goals[0], [goals]);

    return (
        <div className="flex flex-col gap-5">
            {/* Schedule Widget */}
            <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="오늘의 일정">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-400/10 dark:bg-indigo-500/20 blur-3xl rounded-full" aria-hidden="true" />
                <div className="relative">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 오늘의 일정
                        </h2>
                        <button onClick={() => setCurrentTab('schedule')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors" aria-label="전체 일정 보기">
                            전체 일정 <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>

                    {todaySchedules.length === 0 ? (
                        <p className="text-sm text-slate-400 font-bold py-4">오늘 등록된 일정이 없습니다.</p>
                    ) : (
                        <div className="space-y-2.5" role="list" aria-label="오늘의 일정 목록">
                            {todaySchedules.slice(0, 4).map((sc) => (
                                <div key={sc.id} className="flex items-center gap-3 py-2" role="listitem">
                                    <div className="shrink-0" aria-hidden="true">
                                        {sc.completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500 fill-indigo-50 dark:fill-indigo-500/20" /> : <Circle className="w-5 h-5 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${sc.completed ? 'text-slate-400 line-through' : 'text-slate-400'}`}>{sc.title}</p>
                                        <p className="text-[11px] text-slate-400 font-bold">{sc.time} {sc.endTime && `~ ${sc.endTime}`}</p>
                                    </div>
                                </div>
                            ))}
                            {todaySchedules.length > 4 && <p className="text-xs text-slate-400 font-bold text-center pt-1">+{todaySchedules.length - 4}개 더</p>}
                        </div>
                    )}

                    {todaySchedules.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10" aria-live="polite">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-bold text-slate-400">오늘 달성률</span>
                                <span className="text-xs font-bold tracking-tight text-indigo-400">{todaySchedules.length > 0 ? Math.round((todayCompletedCount / todaySchedules.length) * 100) : 0}%</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={todaySchedules.length > 0 ? Math.round((todayCompletedCount / todaySchedules.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-700" style={{ width: `${todaySchedules.length > 0 ? (todayCompletedCount / todaySchedules.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Finance Widget */}
            <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="재정 요약">
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-rose-400/10 dark:bg-fuchsia-500/10 blur-3xl rounded-full" aria-hidden="true" />
                <div className="relative">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
                            <span className="text-xl" aria-hidden="true">💰</span> 오늘의 수입 · 지출
                        </h2>
                        <button onClick={() => setCurrentTab('finance')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors" aria-label="재정 상세 보기">
                            상세 보기 <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                            <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mb-1">수입</p>
                            <p className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">+₩{todayIncome.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-xl border border-rose-100 dark:border-rose-500/20">
                            <p className="text-xs font-bold text-rose-500 dark:text-rose-400 mb-1">지출</p>
                            <p className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">-₩{todayExpense.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="mt-5" aria-label="60일간 자산 추이 차트" role="img">
                        <p className="text-xs font-bold text-slate-400 mb-2">최근 {CHART_DAYS_RANGE}일간 자산 추이</p>
                        <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-50/50 dark:bg-white/[0.02] p-2 border border-white/10">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={assetData}>
                                    <defs>
                                        <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="자산" stroke="#6366f1" fill="url(#homeGrad)" strokeWidth={2} dot={false} />
                                    <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', fontSize: '12px', fontWeight: 'bold' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </section>

            {/* Goal Widget */}
            {primaryGoal && (
                <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="주요 목표">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/10 dark:bg-purple-500/20 blur-3xl rounded-full" aria-hidden="true" />
                    <div className="relative">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
                                <Flag className="w-5 h-5 text-purple-500" aria-hidden="true" /> 주요 목표
                            </h2>
                            <button onClick={() => setCurrentTab('goal')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors" aria-label="목표 상세 보기">
                                모든 목표 <ChevronRight className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="bg-[#09090b][0.03] p-4 rounded-xl border border-white/10">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-xl md:text-2xl" aria-hidden="true">{primaryGoal.icon || '🎯'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-sm font-bold tracking-tight text-slate-100 truncate">{primaryGoal.title}</p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${differenceInDays(parseISO(primaryGoal.deadline), new Date()) < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                            D{differenceInDays(parseISO(primaryGoal.deadline), new Date()) < 0 ? '+' : '-'}{Math.abs(differenceInDays(parseISO(primaryGoal.deadline), new Date()))}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-bold">{primaryGoal.deadline} 까지</p>
                                </div>
                                <span className="text-lg font-bold tracking-tight text-indigo-400">{primaryGoal.progress}%</span>
                            </div>
                            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={primaryGoal.progress} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700 relative overflow-hidden" style={{ width: `${primaryGoal.progress}%` }}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" aria-hidden="true" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

HomeView.propTypes = {
    schedules: PropTypes.array.isRequired,
    transactions: PropTypes.array.isRequired,
    totalAssets: PropTypes.number.isRequired,
    setCurrentTab: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    goals: PropTypes.array.isRequired,
};
