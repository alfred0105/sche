/**
 * @fileoverview HomeView — refactored with useMemo, ARIA, and PropTypes.
 * Added: D-Day widget (#78), daily quote (#79), productivity score (#80), activity feed (#83)
 * Added: weather widget (#77), quick entry bar (#81), weekly report banner (#84)
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, subDays, differenceInDays, getDay, getDayOfYear, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_DAYS_RANGE } from '../constants';
import { generateId } from '../utils/helpers';
import { toast } from 'react-hot-toast';

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

// #77 Weathercode to emoji
function weatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '🌤️';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌡️';
}

// #84 Get ISO week string like "2026-W10"
function getWeekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// #76 Widget definitions (id → 표시 이름)
const WIDGET_DEFS = [
    { id: 'stats', label: '날씨·D-Day·점수 스트립' },
    { id: 'schedule', label: '오늘의 일정' },
    { id: 'finance', label: '재정 요약' },
    { id: 'goal', label: '주요 목표' },
    { id: 'activity', label: '최근 활동 피드' },
    { id: 'quote', label: '오늘의 격언' },
];

const HIDDEN_WIDGETS_KEY = 'homeHiddenWidgets';

function loadHiddenWidgets() {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_WIDGETS_KEY) || '[]')); }
    catch { return new Set(); }
}

export default function HomeView({ schedules, setSchedules, transactions, totalAssets, setCurrentTab, currentDate, goals, studies = [], studyTimes = {}, budgets = {}, setTransactions, reviews = [] }) {
    const { CheckCircle2, Circle, ChevronRight, Flag, CalendarCheck, TrendingUp, TrendingDown, Activity, Plus, X, ClipboardList, Settings } = IconMap;

    // #76 Widget visibility
    const [hiddenWidgets, setHiddenWidgets] = useState(loadHiddenWidgets);
    const [showWidgetSettings, setShowWidgetSettings] = useState(false);

    const isVisible = (id) => !hiddenWidgets.has(id);

    const toggleWidget = (id) => {
        setHiddenWidgets(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            try { localStorage.setItem(HIDDEN_WIDGETS_KEY, JSON.stringify([...next])); } catch { }
            return next;
        });
    };

    const toggleSchedule = (id) => {
        if (!setSchedules) return;
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
    };

    const todayStr = format(currentDate, 'yyyy-MM-dd');

    // #77 Weather state
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        const fetchWeather = async (lat, lon) => {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=Asia/Seoul`);
                const data = await res.json();
                if (data?.current) {
                    setWeather({
                        temp: Math.round(data.current.temperature_2m),
                        code: data.current.weathercode,
                        isSeoul: lat === 37.5665,
                    });
                }
            } catch { /* silently fail */ }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                () => fetchWeather(37.5665, 126.9780)
            );
        } else {
            fetchWeather(37.5665, 126.9780);
        }
    }, []);

    // #81 Quick entry state
    const [quickMode, setQuickMode] = useState(null); // null | 'expense' | 'schedule'
    const [quickExpense, setQuickExpense] = useState({ title: '', amount: '' });
    const [quickSchedule, setQuickSchedule] = useState({ title: '', time: '' });

    const handleQuickExpense = () => {
        if (!quickExpense.title.trim() || !quickExpense.amount) return toast.error('항목명과 금액을 입력하세요.');
        if (setTransactions) {
            setTransactions(prev => [...prev, {
                id: generateId(), type: 'expense', title: quickExpense.title.trim(),
                amount: Number(quickExpense.amount), date: todayStr, category: '기타', account: '',
            }]);
        }
        setQuickExpense({ title: '', amount: '' });
        setQuickMode(null);
        toast.success('지출이 추가되었습니다!', { icon: '💸' });
    };

    const handleQuickSchedule = () => {
        if (!quickSchedule.title.trim()) return toast.error('일정 제목을 입력하세요.');
        if (setSchedules) {
            setSchedules(prev => [...prev, {
                id: generateId(), title: quickSchedule.title.trim(),
                date: todayStr, time: quickSchedule.time, completed: false,
            }]);
        }
        setQuickSchedule({ title: '', time: '' });
        setQuickMode(null);
        toast.success('일정이 추가되었습니다!', { icon: '📅' });
    };

    // #84 Weekly report banner — show on Monday, dismissible
    const isMonday = getDay(currentDate) === 1;
    const prevWeekKey = getWeekKey(subDays(currentDate, 7));
    const bannerStorageKey = `weeklyBannerDismissed_${prevWeekKey}`;
    const [bannerDismissed, setBannerDismissed] = useState(() => {
        try { return localStorage.getItem(bannerStorageKey) === '1'; } catch { return false; }
    });

    const weeklyBannerStats = useMemo(() => {
        if (!isMonday || bannerDismissed) return null;
        const lastWeekStart = startOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subDays(currentDate, 7), { weekStartsOn: 1 });
        const lastWeekDays = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd }).map(d => format(d, 'yyyy-MM-dd'));

        const lastWeekSchedules = schedules.filter(s => lastWeekDays.includes(s.date));
        const lastWeekCompleted = lastWeekSchedules.filter(s => s.completed).length;
        const completionPct = lastWeekSchedules.length > 0 ? Math.round((lastWeekCompleted / lastWeekSchedules.length) * 100) : 0;

        const totalStudySecs = Object.values(studyTimes).reduce((a, b) => a + b, 0);
        const studyHours = Math.floor(totalStudySecs / 3600);
        const studyMins = Math.floor((totalStudySecs % 3600) / 60);

        const lastWeekIncome = transactions.filter(t => lastWeekDays.includes(t.date) && t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const lastWeekExpense = transactions.filter(t => lastWeekDays.includes(t.date) && t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        return { completionPct, studyHours, studyMins, lastWeekIncome, lastWeekExpense };
    }, [isMonday, bannerDismissed, currentDate, schedules, studyTimes, transactions]);

    const dismissBanner = () => {
        try { localStorage.setItem(bannerStorageKey, '1'); } catch { }
        setBannerDismissed(true);
    };

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
    // #49 Top 3 in-progress goals for mini widget
    const topGoals = useMemo(() => goals.filter(g => g.progress < 100).slice(0, 3), [goals]);

    // #77 Today's study plans from localStorage
    const todayStudyPlans = useMemo(() => {
        try {
            const plans = JSON.parse(localStorage.getItem('studyPlans') || '[]');
            return plans.filter(p => p.date === todayStr);
        } catch { return []; }
    }, [todayStr]);

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
        const weekSchedules = schedules.filter(s => isSameWeek(parseISO(s.date), currentDate));
        const weekCompleted = weekSchedules.filter(s => s.completed).length;
        const scheduleRate = weekSchedules.length > 0 ? weekCompleted / weekSchedules.length : 0;
        const scheduleScore = scheduleRate * 40;

        const totalStudySecs = Object.values(studyTimes).reduce((a, b) => a + b, 0);
        const studyHours = totalStudySecs / 3600;
        const studyScore = Math.min(studyHours / 4, 1) * 40;

        const hasbudgets = Object.keys(budgets).length > 0;
        const monthExpenseByCategory = {};
        transactions.filter(t => t.type === 'expense' && isSameMonth(parseISO(t.date), currentDate))
            .forEach(t => { monthExpenseByCategory[t.category] = (monthExpenseByCategory[t.category] || 0) + t.amount; });
        let budgetScore = 20;
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

    // #71 Review streak (daily reviews)
    const reviewStreak = useMemo(() => {
        const dailyDates = new Set(reviews.filter(r => r.type === 'daily').map(r => r.date));
        let count = 0;
        let checkDate = new Date(currentDate);
        while (dailyDates.has(format(checkDate, 'yyyy-MM-dd'))) {
            count++;
            checkDate = subDays(checkDate, 1);
        }
        return count;
    }, [reviews, currentDate]);

    // #78 Weekly schedule completion chart — past 7 days
    const weeklyCompletionData = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = subDays(currentDate, 6 - i);
            const ds = format(d, 'yyyy-MM-dd');
            const daySchedules = schedules.filter(s => s.date === ds);
            const completed = daySchedules.filter(s => s.completed).length;
            const total = daySchedules.length;
            return { label: format(d, 'EEE').slice(0, 1), completed, total, isToday: ds === todayStr };
        });
    }, [schedules, currentDate, todayStr]);

    // #82 Quick timer state
    const [quickTimerActive, setQuickTimerActive] = useState(false);
    const [quickTimerSecs, setQuickTimerSecs] = useState(0);
    const quickTimerRef = useRef(null);
    useEffect(() => {
        if (quickTimerActive) {
            quickTimerRef.current = setInterval(() => setQuickTimerSecs(s => s + 1), 1000);
        } else {
            clearInterval(quickTimerRef.current);
        }
        return () => clearInterval(quickTimerRef.current);
    }, [quickTimerActive]);
    const formatQuickTimer = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // #83 Recent activity feed (last 2 days, last 8 events)
    const activityFeed = useMemo(() => {
        const twoDaysAgo = format(subDays(currentDate, 2), 'yyyy-MM-dd');
        const items = [];

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
        <div className="flex flex-col gap-3 md:gap-3">
            {/* #76 Widget settings button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowWidgetSettings(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${showWidgetSettings ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/6'}`}
                    style={{ borderRadius: '3px' }}
                    aria-expanded={showWidgetSettings}
                >
                    <Settings className="w-3 h-3" /> 위젯 설정
                </button>
            </div>

            {/* #76 Widget settings panel */}
            {showWidgetSettings && (
                <section className="border border-indigo-500/20 p-3" style={{ borderRadius: '3px' }} aria-label="위젯 표시 설정">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest pb-1.5 border-b border-white/8 mb-2">표시할 위젯 선택</p>
                    <div className="flex flex-wrap gap-2">
                        {WIDGET_DEFS.map(w => (
                            <button
                                key={w.id}
                                onClick={() => toggleWidget(w.id)}
                                className={`px-2.5 py-1 text-[11px] font-semibold border transition-all ${isVisible(w.id) ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'border-white/10 text-slate-500'}`}
                                style={{ borderRadius: '3px' }}
                            >
                                {isVisible(w.id) ? '✓ ' : ''}{w.label}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* #84 Weekly Report Banner — Monday only */}
            {isMonday && !bannerDismissed && weeklyBannerStats && (
                <section className="border border-amber-500/20 p-3" aria-label="지난 주 성과 요약">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">📊 지난 주 성과 요약</h2>
                        <button onClick={dismissBanner} className="text-slate-500 hover:text-slate-300 transition-colors" aria-label="닫기">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 text-center border-b border-white/6">
                            <p className="text-[9px] font-semibold text-slate-500 mb-0.5">일정 완료율</p>
                            <p className="text-base font-mono tabular-nums font-bold text-emerald-400">{weeklyBannerStats.completionPct}%</p>
                        </div>
                        <div className="p-2 text-center border-b border-white/6">
                            <p className="text-[9px] font-semibold text-slate-500 mb-0.5">총 공부</p>
                            <p className="text-base font-mono tabular-nums font-bold text-indigo-400">{weeklyBannerStats.studyHours}h {weeklyBannerStats.studyMins}m</p>
                        </div>
                        <div className="p-2 text-center border-b border-white/6">
                            <p className="text-[9px] font-semibold text-slate-500 mb-0.5">수입 / 지출</p>
                            <p className="text-xs font-mono tabular-nums font-bold">
                                <span className="text-blue-400">+{(weeklyBannerStats.lastWeekIncome / 10000).toFixed(0)}만</span>
                                <span className="text-slate-500"> / </span>
                                <span className="text-rose-400">-{(weeklyBannerStats.lastWeekExpense / 10000).toFixed(0)}만</span>
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* #81 Quick Entry Bar */}
            <section className="border-b border-white/6 p-2.5" aria-label="빠른 입력">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">빠른 추가</span>
                    <button
                        onClick={() => setQuickMode(quickMode === 'expense' ? null : 'expense')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border transition-all ${quickMode === 'expense' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/6'}`}
                        style={{ borderRadius: '3px' }}
                    >
                        <Plus className="w-2.5 h-2.5" /> 지출
                    </button>
                    <button
                        onClick={() => setQuickMode(quickMode === 'schedule' ? null : 'schedule')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border transition-all ${quickMode === 'schedule' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/6'}`}
                        style={{ borderRadius: '3px' }}
                    >
                        <Plus className="w-2.5 h-2.5" /> 일정
                    </button>
                </div>
                {quickMode === 'expense' && (
                    <div className="mt-2 flex gap-1.5 items-center">
                        <input type="text" placeholder="항목명" value={quickExpense.title}
                            onChange={e => setQuickExpense(p => ({ ...p, title: e.target.value }))}
                            className="bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-xs font-bold text-slate-200 outline-none focus:border-rose-500 flex-1 min-w-0" />
                        <input type="number" placeholder="금액" value={quickExpense.amount}
                            onChange={e => setQuickExpense(p => ({ ...p, amount: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleQuickExpense()}
                            className="bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-xs font-mono tabular-nums font-bold text-slate-200 outline-none focus:border-rose-500 w-24" />
                        <button onClick={handleQuickExpense} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-white shrink-0" style={{ borderRadius: '3px' }}>추가</button>
                    </div>
                )}
                {quickMode === 'schedule' && (
                    <div className="mt-2 flex gap-1.5 items-center">
                        <input type="text" placeholder="일정 제목" value={quickSchedule.title}
                            onChange={e => setQuickSchedule(p => ({ ...p, title: e.target.value }))}
                            className="bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500 flex-1 min-w-0" />
                        <input type="time" value={quickSchedule.time}
                            onChange={e => setQuickSchedule(p => ({ ...p, time: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleQuickSchedule()}
                            className="bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-xs font-bold text-slate-400 outline-none focus:border-indigo-500 [color-scheme:dark]" />
                        <button onClick={handleQuickSchedule} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white shrink-0" style={{ borderRadius: '3px' }}>추가</button>
                    </div>
                )}
            </section>

            {/* Compact Stats Strip: Weather + D-Day + Score */}
            {isVisible('stats') && <section className="grid grid-cols-3 border-b border-white/6" aria-label="오늘의 현황">
                {/* Weather */}
                <div className="p-2.5 flex flex-col items-center justify-center gap-0.5 border-r border-white/6" aria-label="날씨">
                    {weather ? (
                        <>
                            <span className="text-2xl">{weatherEmoji(weather.code)}</span>
                            <span className="text-sm font-mono tabular-nums font-bold text-slate-100">{weather.temp}°C</span>
                            <span className="text-[9px] text-slate-500">{weather.isSeoul ? '서울' : '현재'}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl">🌡️</span>
                            <span className="text-[10px] text-slate-500 text-center">로딩중</span>
                        </>
                    )}
                </div>

                {/* D-Day */}
                <div className="p-2.5 flex flex-col items-center justify-center gap-0.5 overflow-hidden border-r border-white/6" aria-label="D-Day">
                    {ddayGoal ? (
                        <>
                            <span className="text-xl">{ddayGoal.icon || '🎯'}</span>
                            <span className="text-sm font-mono tabular-nums font-bold text-indigo-400">D-{differenceInDays(parseISO(ddayGoal.deadline), new Date())}</span>
                            <span className="text-[9px] text-slate-500 truncate w-full text-center">{ddayGoal.title}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-xl">📅</span>
                            <span className="text-[10px] text-slate-500 text-center">목표 없음</span>
                        </>
                    )}
                </div>

                {/* Productivity Score + Review streak */}
                <div
                    className={`p-2.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-white/[0.03] transition-colors`}
                    aria-label="생산성 점수 및 회고 스트릭"
                    onClick={() => setCurrentTab('review')}
                >
                    <Activity className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                    <span className={`text-lg font-mono tabular-nums font-bold tracking-tight ${scoreColor}`}>{productivityScore}</span>
                    <span className="text-[9px] text-slate-500">주간점수</span>
                    {reviewStreak > 0 ? (
                        <span className="text-[9px] font-bold text-orange-400">🔥{reviewStreak}일 회고</span>
                    ) : (
                        <span className="text-[9px] text-slate-600">회고 쓰기</span>
                    )}
                </div>
            </section>}

            {/* Schedule Widget */}
            {isVisible('schedule') && <section aria-label="오늘의 일정">
                <div className="flex justify-between items-center py-2 border-b border-white/8">
                    <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" /> 오늘의 일정
                        {todaySchedules.length > 0 && (
                            <span className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5">{todayCompletedCount}/{todaySchedules.length}</span>
                        )}
                    </h2>
                    <button onClick={() => setCurrentTab('schedule')} className="text-[11px] font-semibold text-indigo-500 flex items-center gap-0.5" aria-label="전체 일정 보기">
                        전체 <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                </div>

                {todaySchedules.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2.5">오늘 등록된 일정이 없습니다.</p>
                ) : (
                    <div role="list" aria-label="오늘의 일정 목록">
                        {todaySchedules.slice(0, 4).map((sc) => (
                            <div key={sc.id} className="flex items-center gap-2 py-2.5 border-b border-white/6 hover:bg-white/[0.03]" role="listitem">
                                <button
                                    className="shrink-0 active:scale-90 transition-transform"
                                    onClick={() => toggleSchedule(sc.id)}
                                    aria-label={sc.completed ? '일정 미완료로 변경' : '일정 완료로 변경'}
                                >
                                    {sc.completed
                                        ? <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                        : <Circle className="w-4 h-4 text-slate-600 hover:text-slate-400 transition-colors" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate ${sc.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{sc.title}</p>
                                    {sc.time && <p className="text-[10px] text-slate-500 font-mono tabular-nums">{sc.time}{sc.endTime ? ` ~ ${sc.endTime}` : ''}</p>}
                                </div>
                                {sc.color && <div className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: sc.color, borderRadius: '50%' }} aria-hidden="true" />}
                            </div>
                        ))}
                        {todaySchedules.length > 4 && <p className="text-[10px] text-slate-500 py-1.5">+{todaySchedules.length - 4}개 더</p>}
                    </div>
                )}

                {todaySchedules.length > 0 && (
                    <div className="pt-2 pb-1" aria-live="polite">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-500">달성률</span>
                            <span className="text-[10px] font-mono tabular-nums font-semibold text-indigo-400">{Math.round((todayCompletedCount / todaySchedules.length) * 100)}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/8" role="progressbar">
                            <div className="h-1 bg-indigo-500 transition-all" style={{ width: `${(todayCompletedCount / todaySchedules.length) * 100}%` }} />
                        </div>
                    </div>
                )}
            </section>}

            {/* Finance Widget */}
            {isVisible('finance') && <section aria-label="재정 요약">
                <div className="flex justify-between items-center py-2 border-b border-white/8">
                    <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <span aria-hidden="true">💰</span> 오늘의 수입 · 지출
                    </h2>
                    <button onClick={() => setCurrentTab('finance')} className="text-[11px] font-semibold text-indigo-500 flex items-center gap-0.5" aria-label="재정 상세 보기">
                        상세 <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                </div>
                <div className="grid grid-cols-2 border-b border-white/6">
                    <div className="py-3 pr-3 border-r border-white/6">
                        <p className="text-[10px] font-semibold text-blue-400 mb-0.5">수입</p>
                        <p className="text-base font-mono tabular-nums font-bold text-emerald-400">+₩{todayIncome.toLocaleString()}</p>
                    </div>
                    <div className="py-3 pl-3">
                        <p className="text-[10px] font-semibold text-rose-400 mb-0.5">지출</p>
                        <p className="text-base font-mono tabular-nums font-bold text-rose-400">-₩{todayExpense.toLocaleString()}</p>
                    </div>
                </div>
                <div className="pt-2" aria-label="자산 추이 차트" role="img">
                    <p className="text-[10px] font-semibold text-slate-500 mb-1.5">최근 {CHART_DAYS_RANGE}일 자산 추이</p>
                    <div className="h-24 w-full overflow-hidden bg-white/[0.02] p-1.5 border border-white/8">
                        {transactions.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-600 text-xs font-bold">아직 거래 내역이 없습니다</div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={assetData}>
                                <defs>
                                    <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="자산" stroke="#6366f1" fill="url(#homeGrad)" strokeWidth={2} dot={false} />
                                <Tooltip formatter={(v) => `₩${v.toLocaleString()}`} contentStyle={{ border: 'none', background: 'rgba(15,15,20,0.95)', fontSize: '11px', fontWeight: 'bold', color: '#e2e8f0' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </section>}

            {/* #49 Goal Mini Gauges Widget */}
            {isVisible('goal') && topGoals.length > 0 && (
                <section aria-label="진행 중 목표">
                    <div className="flex justify-between items-center py-2 border-b border-white/8">
                        <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Flag className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" /> 진행 중 목표
                        </h2>
                        <button onClick={() => setCurrentTab('goal')} className="text-[11px] font-semibold text-indigo-500 flex items-center gap-0.5" aria-label="목표 상세 보기">
                            전체 <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                    </div>
                    {topGoals.map(goal => (
                        <div key={goal.id} className="flex items-center gap-3 py-2.5 border-b border-white/6 hover:bg-white/[0.03]">
                            <span className="text-base shrink-0" aria-hidden="true">{goal.icon || '🎯'}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-bold text-slate-200 truncate">{goal.title}</p>
                                    <span className="text-xs font-mono tabular-nums font-bold text-indigo-400 shrink-0 ml-2">{goal.progress}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/8" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="h-1 bg-indigo-500 transition-all" style={{ width: `${goal.progress}%` }} />
                                </div>
                                {goal.deadline && (
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono tabular-nums">
                                        {(() => {
                                            const d = differenceInDays(parseISO(goal.deadline), new Date());
                                            return d < 0 ? `D+${Math.abs(d)} 초과` : d === 0 ? 'D-Day!' : `D-${d}`;
                                        })()}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* #77 Today's Study Plans */}
            {todayStudyPlans.length > 0 && (
                <section aria-label="오늘의 공부 계획">
                    <div className="flex justify-between items-center py-2 border-b border-white/8">
                        <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            📚 오늘의 공부 계획
                        </h2>
                        <button onClick={() => setCurrentTab('study')} className="text-[11px] font-semibold text-indigo-500 flex items-center gap-0.5">
                            공부 탭 <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {todayStudyPlans.map(plan => (
                        <div key={plan.id} className={`flex items-center gap-2 py-2.5 border-b border-white/6 hover:bg-white/[0.03] ${plan.done ? 'opacity-60' : ''}`}>
                            <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-500 shrink-0">{plan.time}~{plan.endTime}</span>
                            <p className={`text-xs font-bold flex-1 truncate ${plan.done ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{plan.subjectTitle}{plan.note ? ` — ${plan.note}` : ''}</p>
                            {plan.done && <span className="text-[10px] text-emerald-400">✅</span>}
                        </div>
                    ))}
                </section>
            )}

            {/* #78 Weekly schedule completion mini chart */}
            {weeklyCompletionData.some(d => d.total > 0) && (
                <section aria-label="주간 일정 달성 현황">
                    <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest pt-4 pb-1.5 border-b border-white/8 mb-3">이번 주 일정 달성</h2>
                    <div className="flex items-end gap-1.5 h-12">
                        {weeklyCompletionData.map((d, i) => {
                            const pct = d.total > 0 ? (d.completed / d.total) * 100 : 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex flex-col justify-end" style={{ height: '2.5rem' }}>
                                        <div
                                            className={`w-full rounded-t-sm transition-all ${d.isToday ? 'bg-indigo-500' : pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500/50' : 'bg-white/10'}`}
                                            style={{ height: `${Math.max(d.total > 0 ? pct : 5, 5)}%` }}
                                            title={`${d.completed}/${d.total}`}
                                        />
                                    </div>
                                    <span className={`text-[9px] font-bold ${d.isToday ? 'text-indigo-400' : 'text-slate-600'}`}>{d.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* #82 Quick timer */}
            <section className="flex items-center gap-3 py-2.5 border-b border-white/6" aria-label="빠른 타이머">
                <span className="text-base">⏱️</span>
                <span className="text-xs font-semibold text-slate-400 flex-1">빠른 타이머</span>
                <span className="text-sm font-mono tabular-nums font-bold text-indigo-400 min-w-[3.5rem] text-right">
                    {formatQuickTimer(quickTimerSecs)}
                </span>
                <button
                    onClick={() => {
                        if (quickTimerActive) {
                            setQuickTimerActive(false);
                            toast(`⏱️ ${formatQuickTimer(quickTimerSecs)} 기록 완료!`, { duration: 3000 });
                            setQuickTimerSecs(0);
                        } else {
                            setQuickTimerActive(true);
                        }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold border transition-all ${quickTimerActive ? 'text-rose-400 border-rose-500/30 hover:bg-rose-500/10' : 'bg-indigo-500 hover:bg-indigo-400 text-white border-transparent'}`}
                    style={{ borderRadius: '3px' }}
                >
                    {quickTimerActive ? '⏸ 종료' : '▶ 시작'}
                </button>
                {quickTimerSecs > 0 && !quickTimerActive && (
                    <button onClick={() => setQuickTimerSecs(0)} className="text-slate-500 hover:text-slate-300 text-xs">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </section>

            {/* #83 Recent Activity Feed */}
            {isVisible('activity') && activityFeed.length > 0 && (
                <section aria-label="최근 활동 피드">
                    <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest pt-4 pb-1.5 border-b border-white/8">최근 활동</h2>
                    <div role="list">
                        {activityFeed.map(item => (
                            <div key={item.id} className="flex items-center gap-2 py-2.5 border-b border-white/6 hover:bg-white/[0.03]" role="listitem">
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                    {activityIcon(item.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-slate-300 truncate">{item.label}</p>
                                </div>
                                <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-500 shrink-0">{item.sub}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* #79 Daily Quote */}
            {isVisible('quote') && <section className="border-t border-white/6 pt-3 pb-1" aria-label="오늘의 격언">
                <p className="text-[11px] italic text-slate-500 text-center leading-relaxed">"{dailyQuote}"</p>
            </section>}
        </div>
    );
}

HomeView.propTypes = {
    schedules: PropTypes.array.isRequired,
    setSchedules: PropTypes.func,
    transactions: PropTypes.array.isRequired,
    totalAssets: PropTypes.number.isRequired,
    setCurrentTab: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    goals: PropTypes.array.isRequired,
    studies: PropTypes.array,
    studyTimes: PropTypes.object,
    budgets: PropTypes.object,
    setTransactions: PropTypes.func,
    reviews: PropTypes.array,
};
