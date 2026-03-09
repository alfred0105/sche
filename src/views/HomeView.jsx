/**
 * @fileoverview HomeView — refactored with useMemo, ARIA, and PropTypes.
 * Added: D-Day widget (#78), daily quote (#79), productivity score (#80), activity feed (#83)
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, subDays, differenceInDays, getDay, getDayOfYear } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_DAYS_RANGE } from '../constants';

const DAILY_QUOTES = [
    '작은 전진이 매일 쌓이면 위대한 변화가 된다.',
    '오늘의 당신은 어제의 당신보다 조금 더 나아졌습니다.',
    '완벽한 계획보다 불완전한 실천이 낫다.',
    '힘든 시간은 지나가지만 포기는 영원히 남는다.',
    '당신이 심은 씨앗은 반드시 꽃을 피운다.',
    '한 번에 한 걸음씩, 그것이 산을 오르는 법이다.',
    '오늘의 노력은 내일의 자신에게 보내는 선물이다.',
    '집중하라. 두 마리 토끼를 쫓으면 하나도 못 잡는다.',
    '루틴이 결과를 만든다. 오늘 루틴을 지켰나요?',
    '불편함 속에서 성장이 시작된다.',
    '지금 당장 완벽하지 않아도 괜찮다. 계속 나아가면 된다.',
    '꾸준함은 재능을 이긴다.',
    '작은 습관이 큰 차이를 만든다.',
    '포기하고 싶을 때 딱 하루만 더 버텨봐.',
    '지금 이 순간이 앞으로의 나를 만든다.',
    '어제보다 나은 오늘, 그것이 성공이다.',
    '두려움을 느끼면서도 행동하는 것이 용기다.',
    '성공은 준비된 자에게 찾아온 기회다.',
    '당신의 가능성은 아직 발휘되지 않았다.',
    '오늘 최선을 다하면 내일의 자신이 감사할 것이다.',
];

export default function HomeView({ schedules, transactions, totalAssets, setCurrentTab, currentDate, goals, studies = [], studyTimes = {}, budgets = {} }) {
    const { CheckCircle2, Circle, ChevronRight, Flag, CalendarCheck, TrendingUp, TrendingDown, Activity } = IconMap;

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

    // #78 D-Day widget: nearest upcoming goal deadline
    const ddayGoal = useMemo(() => {
        const today = new Date();
        const upcoming = goals
            .filter(g => g.deadline && differenceInDays(parseISO(g.deadline), today) >= 0)
            .sort((a, b) => differenceInDays(parseISO(a.deadline), today) - differenceInDays(parseISO(b.deadline), today));
        return upcoming[0] || null;
    }, [goals]);

    // #79 Daily quote
    const dailyQuote = useMemo(() => {
        const dayOfYear = getDayOfYear(currentDate);
        return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
    }, [currentDate]);

    // #80 Weekly productivity score
    const productivityScore = useMemo(() => {
        // Schedule completion rate this week (40pts)
        const weekSchedules = schedules.filter(s => isSameWeek(parseISO(s.date), currentDate));
        const weekCompleted = weekSchedules.filter(s => s.completed).length;
        const scheduleRate = weekSchedules.length > 0 ? weekCompleted / weekSchedules.length : 0;
        const scheduleScore = scheduleRate * 40;

        // Study hours this week (40pts) — sum all studyTimes values
        const totalStudySecs = Object.values(studyTimes).reduce((a, b) => a + b, 0);
        const studyHours = totalStudySecs / 3600;
        const studyScore = Math.min(studyHours / 4, 1) * 40;

        // Budget compliance (20pts)
        const hasbudgets = Object.keys(budgets).length > 0;
        const monthExpenseByCategory = {};
        transactions.filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate))
            .forEach(t => { monthExpenseByCategory[t.category] = (monthExpenseByCategory[t.category] || 0) + t.amount; });
        let budgetScore = 20; // default if no budgets
        if (hasbudgets) {
            const exceeded = Object.entries(budgets).some(([catId, limit]) => {
                const spent = monthExpenseByCategory[catId] || 0;
                return limit > 0 && spent > limit;
            });
            budgetScore = exceeded ? 10 : 20;
        }

        return Math.round(scheduleScore + studyScore + budgetScore);
    }, [schedules, studyTimes, budgets, transactions, currentDate]);

    const scoreColor = productivityScore >= 70 ? 'text-emerald-400' : productivityScore >= 40 ? 'text-amber-400' : 'text-rose-400';
    const scoreBg = productivityScore >= 70 ? 'bg-emerald-500/10 border-emerald-500/20' : productivityScore >= 40 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';

    // #83 Recent activity feed (last 2 days, last 8 events)
    const activityFeed = useMemo(() => {
        const twoDaysAgo = format(subDays(currentDate, 2), 'yyyy-MM-dd');
        const items = [];

        // Transactions
        transactions.filter(t => t.date >= twoDaysAgo).forEach(t => {
            items.push({
                id: `tx-${t.id}`,
                type: t.type === 'income' ? 'income' : 'expense',
                label: t.title,
                sub: `${t.type === 'income' ? '+' : '-'}₩${t.amount.toLocaleString()}`,
                date: t.date,
                sortKey: t.id,
            });
        });

        // Completed schedules
        schedules.filter(s => s.completed && s.date >= twoDaysAgo).forEach(s => {
            items.push({
                id: `sc-${s.id}`,
                type: 'schedule',
                label: s.title,
                sub: s.time || '완료',
                date: s.date,
                sortKey: s.id,
            });
        });

        // Recent goals (by deadline proximity)
        goals.filter(g => g.deadline >= twoDaysAgo).forEach(g => {
            items.push({
                id: `goal-${g.id}`,
                type: 'goal',
                label: g.title,
                sub: `D-${Math.max(0, differenceInDays(parseISO(g.deadline), currentDate))}`,
                date: g.deadline,
                sortKey: g.id,
            });
        });

        return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 8);
    }, [transactions, schedules, goals, currentDate]);

    const activityIcon = (type) => {
        if (type === 'income') return <TrendingUp className="w-3.5 h-3.5 text-blue-400" />;
        if (type === 'expense') return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
        if (type === 'schedule') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
        return <Flag className="w-3.5 h-3.5 text-purple-400" />;
    };

    return (
        <div className="flex flex-col gap-5">
            {/* #78 D-Day Widget */}
            {ddayGoal && (
                <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="D-Day 위젯">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full" aria-hidden="true" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{ddayGoal.icon || '🎯'}</span>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">마감 임박 목표</p>
                                <p className="text-sm font-bold text-slate-100 truncate max-w-[200px]">{ddayGoal.title}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold tracking-tight text-indigo-400">
                                D-{differenceInDays(parseISO(ddayGoal.deadline), new Date())}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500">{ddayGoal.deadline}</p>
                        </div>
                    </div>
                </section>
            )}

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
                                    {/* Color dot from schedule color label (#2) */}
                                    {sc.color && (
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.color }} aria-hidden="true" />
                                    )}
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

            {/* #80 Weekly Productivity Score */}
            <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="주간 생산성 점수">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" aria-hidden="true" />
                <div className="relative flex items-center gap-4">
                    <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center shrink-0 ${scoreBg}`}>
                        <span className={`text-2xl font-bold tracking-tight ${scoreColor}`}>{productivityScore}</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 주간 생산성 점수
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            일정 달성 · 공부 시간 · 예산 준수를 종합한 점수
                        </p>
                        <p className={`text-xs font-bold mt-1 ${scoreColor}`}>
                            {productivityScore >= 70 ? '이번 주도 훌륭해요!' : productivityScore >= 40 ? '조금만 더 화이팅!' : '오늘부터 다시 시작해봐요!'}
                        </p>
                    </div>
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

            {/* #83 Recent Activity Feed */}
            {activityFeed.length > 0 && (
                <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="최근 활동 피드">
                    <h2 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-indigo-500" aria-hidden="true" /> 최근 활동 피드
                    </h2>
                    <div className="space-y-2" role="list">
                        {activityFeed.map(item => (
                            <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0" role="listitem">
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                    {activityIcon(item.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-300 truncate">{item.label}</p>
                                    <p className="text-[10px] text-slate-500">{item.date}</p>
                                </div>
                                <span className="text-xs font-bold text-slate-400 shrink-0">{item.sub}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* #79 Daily Quote */}
            <section className="glass-card p-4 md:p-5 relative overflow-hidden" aria-label="오늘의 격언">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" aria-hidden="true" />
                <div className="relative text-center">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">오늘의 격언</p>
                    <p className="text-sm italic text-slate-300 font-medium leading-relaxed">"{dailyQuote}"</p>
                </div>
            </section>
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
    studies: PropTypes.array,
    studyTimes: PropTypes.object,
    budgets: PropTypes.object,
};
