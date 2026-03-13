import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfWeek, endOfWeek, isSameWeek, parseISO, isWithinInterval, getYear } from 'date-fns';
import { toast } from 'react-hot-toast';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { generateId } from '../utils/helpers';

const BOOKMARKS_KEY = 'reviewBookmarks';

// #75 Korean stopwords for keyword analysis
const KO_STOPWORDS = new Set(['그', '이', '저', '것', '수', '등', '및', '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만', '에서', '으로', '하다', '있다', '없다', '되다', '하고', '하여', '해서', '했다', '한다', '합니다', '했습니다', '이다', '입니다', '더', '또', '또한', '그리고', '하지만', '그러나', '때문에', '위해', '통해', '대한', '관한', '같은', '다음', '오늘', '오늘도', '내일', '어제', '다시', '계속', '정말', '너무', '매우', '좀', '잘', '못', '안', '안됨', '않다', '않고', '않은', '이번', '다음에', '앞으로', '앞으로도']);

const MOODS = ['😊', '😄', '😐', '😔', '😤'];
const CATEGORIES = ['전체', '업무', '개인', '건강', '재정'];
const CATEGORY_COLORS = {
    '업무': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    '개인': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    '건강': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    '재정': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export default function ReviewView({ reviews, setReviews, currentDate, schedules, transactions = [], studies = [], studyTimes = {}, goals = [], userProfile }) {
    const { ClipboardList, Plus, Trash2, CheckCircle2, TrendingDown, Trophy, BookOpen, DollarSign, Flag, ChevronDown, ChevronUp, Search, Bookmark } = IconMap;
    const [isWriting, setIsWriting] = useState(false);
    const [reviewType, setReviewType] = useState('daily'); // 'daily' | 'weekly' | 'annual'
    const [categoryFilter, setCategoryFilter] = useState('전체');
    // #74 Search
    const [reviewSearch, setReviewSearch] = useState('');
    // #75 Bookmarks
    const [bookmarkedIds, setBookmarkedIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
    });
    // #75 Keyword cloud toggle
    const [showKeywords, setShowKeywords] = useState(false);
    // #67 AI summary loading state
    const [aiLoading, setAiLoading] = useState(false);

    const toggleBookmark = (id) => {
        setBookmarkedIds(prev => {
            const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id];
            localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Form state
    const [score, setScore] = useState(5);
    const [keep, setKeep] = useState('');
    const [problem, setProblem] = useState('');
    const [tryItem, setTryItem] = useState('');
    const [wins, setWins] = useState('');
    const [mood, setMood] = useState('😊');
    const [category, setCategory] = useState('개인');
    const [deleteId, setDeleteId] = useState(null);

    const filterDateStr = format(currentDate, 'yyyy-MM-dd');

    // Auto-generate statistics based on current date / week
    const todaySchedules = schedules.filter(s => s.date === filterDateStr);
    const todayCompleted = todaySchedules.filter(s => s.completed).length;
    const completionRate = todaySchedules.length > 0 ? Math.round((todayCompleted / todaySchedules.length) * 100) : 0;

    // Weekly stats
    const weekSchedules = useMemo(() => schedules.filter(s => isSameWeek(new Date(s.date), currentDate)), [schedules, currentDate]);
    const weekCompleted = useMemo(() => weekSchedules.filter(s => s.completed).length, [weekSchedules]);
    const weekCompletionRate = weekSchedules.length > 0 ? Math.round((weekCompleted / weekSchedules.length) * 100) : 0;

    // Weekly study days (unique days in studies.logs within current week)
    const weekStudyDays = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        const daySet = new Set();
        studies.forEach(s => {
            (s.logs || []).forEach(d => {
                try {
                    const date = parseISO(d);
                    if (isWithinInterval(date, { start: weekStart, end: weekEnd })) daySet.add(d);
                } catch { /* skip */ }
            });
        });
        return daySet.size;
    }, [studies, currentDate]);

    // Weekly total expense
    const weekExpense = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return transactions
            .filter(t => t.type === 'expense')
            .filter(t => {
                try {
                    const d = parseISO(t.date);
                    return isWithinInterval(d, { start: weekStart, end: weekEnd });
                } catch { return false; }
            })
            .reduce((sum, t) => sum + (t.amount || 0), 0);
    }, [transactions, currentDate]);

    // Goals completed (progress >= 100)
    const completedGoalsCount = useMemo(() => goals.filter(g => g.progress >= 100).length, [goals]);

    // Auto-summary template for weekly review
    const generateWeeklySummary = () => {
        const studyHours = Math.floor(Object.values(studyTimes).reduce((a, b) => a + b, 0) / 3600);
        const parts = [];
        if (weekCompletionRate > 0) parts.push(`이번 주 일정 달성률 ${weekCompletionRate}%`);
        if (weekStudyDays > 0) parts.push(`공부 ${weekStudyDays}일 출석`);
        if (studyHours > 0) parts.push(`총 공부시간 ${studyHours}시간`);
        if (weekExpense > 0) parts.push(`지출 ${weekExpense.toLocaleString()}원`);
        if (completedGoalsCount > 0) parts.push(`목표 ${completedGoalsCount}개 달성`);
        return parts.length > 0 ? `[주간 요약] ${parts.join(', ')}` : '';
    };

    const currentReview = reviews.find(r => r.date === filterDateStr && r.type === reviewType);

    // #71 Streak: consecutive days with daily reviews
    const streak = useMemo(() => {
        const dailyReviewDates = new Set(reviews.filter(r => r.type === 'daily').map(r => r.date));
        let count = 0;
        let checkDate = new Date(currentDate);
        while (dailyReviewDates.has(format(checkDate, 'yyyy-MM-dd'))) {
            count++;
            checkDate = subDays(checkDate, 1);
        }
        return count;
    }, [reviews, currentDate]);

    const displayedSchedules = reviewType === 'weekly' ? weekSchedules : todaySchedules;
    const displayedCompleted = reviewType === 'weekly' ? weekCompleted : todayCompleted;
    const displayedRate = reviewType === 'weekly' ? weekCompletionRate : completionRate;

    // #67 AI review summary using Claude API
    const handleAiSummary = async () => {
        const apiKey = userProfile?.anthropicApiKey;
        if (!apiKey) {
            toast.error('설정 > 외부연동에서 Anthropic API 키를 먼저 입력해주세요.', { duration: 4000 });
            return;
        }
        const studyHours = Math.floor(Object.values(studyTimes).reduce((a, b) => a + b, 0) / 3600);
        const context = `
주간 현황:
- 일정 달성률: ${displayedRate}%
- 완료 일정: ${displayedCompleted}/${displayedSchedules.length}건
- 공부 출석: ${weekStudyDays}일
- 공부 시간: ${studyHours}시간
- 이번 주 지출: ${weekExpense.toLocaleString()}원
- 달성한 목표: ${completedGoalsCount}개
Keep(잘한 점): ${keep}
Problem(아쉬운 점): ${problem}
Try(개선할 점): ${tryItem}
오늘의 작은 성취: ${wins}
        `.trim();
        setAiLoading(true);
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `아래는 개인 회고 데이터입니다. 3~4문장으로 따뜻하고 건설적인 피드백을 한국어로 작성해주세요. 구체적인 칭찬과 다음 주를 위한 실천 가능한 조언 1~2개를 포함해주세요.\n\n${context}`,
                    }],
                }),
            });
            if (!res.ok) throw new Error(`API error ${res.status}`);
            const data = await res.json();
            const summary = data.content?.[0]?.text || '';
            if (summary) {
                setKeep(prev => prev ? `${prev}\n\n[AI 요약] ${summary}` : `[AI 요약] ${summary}`);
                toast.success('AI 요약이 Keep 항목에 추가되었습니다!', { icon: '✨' });
            }
        } catch (e) {
            if (import.meta.env.DEV) console.error('[AI Summary]', e);
            toast.error('AI 요약 실패: API 키나 네트워크를 확인해주세요.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSave = () => {
        if (!keep.trim() && !problem.trim() && !tryItem.trim()) {
            toast.error('내용을 하나 이상 입력해주세요!', { id: 'review_empty' });
            return;
        }

        const newReview = {
            id: currentReview ? currentReview.id : generateId(),
            date: filterDateStr,
            type: reviewType,
            score,
            keep: keep.trim(),
            problem: problem.trim(),
            try: tryItem.trim(),
            wins: wins.trim(),
            mood,
            category,
            stats: { completionRate: displayedRate }
        };

        if (currentReview) {
            setReviews(p => p.map(r => r.id === newReview.id ? newReview : r));
            toast.success('회고가 수정되었습니다.');
        } else {
            setReviews(p => [newReview, ...p]);
            toast.success('회고가 저장되었습니다! 🎉');
        }
        setIsWriting(false);
    };

    const handleEdit = () => {
        setScore(currentReview.score);
        setKeep(currentReview.keep);
        setProblem(currentReview.problem);
        setTryItem(currentReview.try);
        setWins(currentReview.wins || '');
        setMood(currentReview.mood || '😊');
        setCategory(currentReview.category || '개인');
        setIsWriting(true);
    };

    const handleDelete = () => {
        setReviews(p => p.filter(r => r.id !== deleteId));
        toast.success('회고가 삭제되었습니다.');
        setDeleteId(null);
    };

    // Past reviews filtered by category + search (#74), bookmarks pinned (#75)
    const pastReviews = useMemo(() => {
        const q = reviewSearch.toLowerCase().trim();
        return reviews
            .filter(r => r.date !== filterDateStr)
            .filter(r => categoryFilter === '전체' || r.category === categoryFilter)
            .filter(r => !q || [r.keep, r.problem, r.try, r.wins].filter(Boolean).some(t => t.toLowerCase().includes(q)))
            .sort((a, b) => {
                // Bookmarked first
                const ab = bookmarkedIds.includes(a.id) ? 1 : 0;
                const bb = bookmarkedIds.includes(b.id) ? 1 : 0;
                if (bb !== ab) return bb - ab;
                return b.date.localeCompare(a.date);
            })
            .slice(0, 15);
    }, [reviews, filterDateStr, categoryFilter, reviewSearch, bookmarkedIds]);

    // #75 Keyword frequency analysis
    const keywordCloud = useMemo(() => {
        if (reviews.length < 2) return [];
        const freq = {};
        reviews.forEach(r => {
            const text = [r.keep, r.problem, r.try, r.wins].filter(Boolean).join(' ');
            text.split(/[\s,.!?()[\]{}'"·…]+/).forEach(word => {
                const w = word.trim();
                if (w.length < 2 || KO_STOPWORDS.has(w) || /^\d+$/.test(w)) return;
                freq[w] = (freq[w] || 0) + 1;
            });
        });
        return Object.entries(freq)
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40);
    }, [reviews]);

    // #70 Annual stats
    const currentYear = getYear(currentDate);
    const annualStats = useMemo(() => {
        const yearStr = String(currentYear);
        const yearSchedules = schedules.filter(s => s.date?.startsWith(yearStr));
        const yearCompleted = yearSchedules.filter(s => s.completed).length;
        const yearExpense = transactions
            .filter(t => t.type === 'expense' && t.date?.startsWith(yearStr))
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const yearIncome = transactions
            .filter(t => t.type === 'income' && t.date?.startsWith(yearStr))
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        const studySecsTotal = Object.values(studyTimes).reduce((a, b) => a + b, 0);
        const yearReviews = reviews.filter(r => r.date?.startsWith(yearStr));
        const avgScore = yearReviews.length > 0
            ? (yearReviews.reduce((s, r) => s + (r.score || 0), 0) / yearReviews.length).toFixed(1)
            : 0;
        const completedGoals = goals.filter(g => g.progress >= 100 && (!g.repeat || g.repeat === 'none') && (g.completedAt?.startsWith(yearStr) || g.deadline?.startsWith(yearStr))).length;
        const monthlyExpense = {};
        transactions
            .filter(t => t.type === 'expense' && t.date?.startsWith(yearStr))
            .forEach(t => {
                const month = t.date.substring(5, 7);
                monthlyExpense[month] = (monthlyExpense[month] || 0) + t.amount;
            });
        return { yearSchedules: yearSchedules.length, yearCompleted, yearExpense, yearIncome, studySecsTotal, avgScore, completedGoals, monthlyExpense };
    }, [currentYear, schedules, transactions, studyTimes, reviews, goals]);

    return (
        <section className="flex flex-col gap-4 md:p-5" aria-label="회고 뷰">
            {/* Header / Stats */}
            <div className="glass p-5 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-indigo-500" />
                            선택한 날의 피드백
                            {streak > 0 && (
                                <span className="text-sm font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg">
                                    🔥 {streak}일 연속
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {format(currentDate, 'yyyy년 MM월 dd일')}의 기록을 모아보세요.
                        </p>
                    </div>
                    {/* #66 Weekly tab + #70 Annual tab */}
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                        {['daily', 'weekly', 'annual'].map(t => (
                            <button
                                key={t}
                                onClick={() => setReviewType(t)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${reviewType === t ? 'bg-[#111113] shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                aria-pressed={reviewType === t}
                            >
                                {t === 'daily' ? '일간' : t === 'weekly' ? '주간' : '연간'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`grid gap-3 mt-6 ${reviewType === 'weekly' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                        <span className="text-xl md:text-2xl font-bold tracking-tight">{displayedRate}%</span>
                        <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">일정 달성률</span>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                        <ClipboardList className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-xl md:text-2xl font-bold tracking-tight">{displayedCompleted} / {displayedSchedules.length}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">일정 완료/전체</span>
                    </div>
                    {reviewType === 'weekly' && (
                        <>
                            <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                                <BookOpen className="w-6 h-6 text-purple-400 mb-2" />
                                <span className="text-xl md:text-2xl font-bold tracking-tight">{weekStudyDays}일</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">공부 출석</span>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                                <DollarSign className="w-6 h-6 text-amber-400 mb-2" />
                                <span className="text-xl md:text-2xl font-bold tracking-tight">{weekExpense > 0 ? `${(weekExpense / 10000).toFixed(1)}만` : '0'}</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">이번 주 지출</span>
                            </div>
                        </>
                    )}
                </div>
                {reviewType === 'weekly' && completedGoalsCount > 0 && (
                    <div className="mt-3 flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5">
                        <Flag className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-sm font-bold text-amber-400">달성한 목표 {completedGoalsCount}개</span>
                        <div className="flex gap-1 flex-wrap ml-1">
                            {goals.filter(g => g.progress >= 100).slice(0, 3).map(g => (
                                <span key={g.id} className="text-xs text-amber-300">{g.icon} {g.title}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area — hidden in annual view */}
            <AnimatePresence mode="wait">
                {reviewType === 'annual' ? null : isWriting ? (
                    <motion.div
                        key="writing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass p-4 md:p-5 rounded-xl border border-indigo-200/50 dark:border-indigo-500/30"
                    >
                        {/* Score */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold mb-2">오늘 하루 점수</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setScore(s)}
                                        className={`p-3 rounded-xl text-xl md:text-2xl transition-transform ${score >= s ? 'scale-110 drop-shadow-none' : 'opacity-40 grayscale'}`}
                                        aria-label={`${s}별`}
                                    >
                                        ⭐
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* #68 Mood */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold mb-2 text-slate-400">오늘의 기분</label>
                            <div className="flex gap-2">
                                {MOODS.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMood(m)}
                                        className={`p-2 rounded-xl text-2xl transition-all ${mood === m ? 'scale-125 bg-indigo-500/10 border border-indigo-500/30' : 'opacity-50 hover:opacity-80'}`}
                                        aria-label={m}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* #69 Category */}
                        <div className="mb-4">
                            <label className="block text-sm font-bold mb-2 text-slate-400">카테고리</label>
                            <div className="flex gap-2 flex-wrap">
                                {CATEGORIES.filter(c => c !== '전체').map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setCategory(c)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${category === c ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/5 text-slate-400 border-white/10 hover:border-indigo-500/50'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {reviewType === 'weekly' && (
                            <div className="mb-4 flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-2.5">
                                <span className="text-xs text-slate-400 flex-1">이번 주 데이터 기반 자동 요약을 Keep 항목에 채워줍니다.</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const summary = generateWeeklySummary();
                                        if (summary) setKeep(prev => prev ? `${prev}\n${summary}` : summary);
                                        else toast('아직 집계할 주간 데이터가 없습니다.', { icon: '📊' });
                                    }}
                                    className="shrink-0 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors"
                                >
                                    ✨ 자동 요약 채우기
                                </button>
                                {/* #67 AI summary button */}
                                {userProfile?.anthropicApiKey && (
                                    <button
                                        type="button"
                                        onClick={handleAiSummary}
                                        disabled={aiLoading}
                                        className="shrink-0 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold hover:bg-purple-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {aiLoading ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : '🤖'}
                                        AI 요약
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-emerald-600 dark:text-emerald-400">Keep (잘한 점 / 유지할 점)</label>
                                <textarea
                                    value={keep}
                                    onChange={(e) => setKeep(e.target.value)}
                                    placeholder="오늘 가장 잘한 작은 성공을 적어보세요."
                                    className="w-full bg-[#09090b] border outline-none border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[100px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-rose-600 dark:text-rose-400">Problem (아쉬웠던 점 / 문제점)</label>
                                <textarea
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    placeholder="시간을 낭비했거나 아쉬웠던 점을 객관적으로 담백하게 적어주세요."
                                    className="w-full bg-[#09090b] border outline-none border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all min-h-[100px]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-indigo-400">Try (내일 시도할 점)</label>
                                <textarea
                                    value={tryItem}
                                    onChange={(e) => setTryItem(e.target.value)}
                                    placeholder="Problem을 해결하기 위해 내일 당장 실행할 수 있는 작은 행동을 적어보세요."
                                    className="w-full bg-[#09090b] border outline-none border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[100px]"
                                />
                            </div>
                            {/* #73 Win Journal */}
                            <div>
                                <label className="block text-sm font-bold mb-1 text-amber-400">🏆 오늘의 작은 성취 (Win Journal)</label>
                                <textarea
                                    value={wins}
                                    onChange={(e) => setWins(e.target.value)}
                                    placeholder="오늘 이뤄낸 작은 성취를 기록해보세요. 아무리 사소해도 좋아요!"
                                    className="w-full bg-[#09090b] border outline-none border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all min-h-[80px]"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setIsWriting(false)}
                                className="flex-1 py-2.5 bg-white/5 text-slate-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-slate-400"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-indigo-500 shadow-none"
                            >
                                {currentReview ? '수정 완료' : '회고 저장하기'}
                            </button>
                        </div>
                    </motion.div>
                ) : currentReview ? (
                    <motion.div
                        key="viewing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 md:p-5 rounded-xl"
                    >
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i} className={`text-xl md:text-2xl ${i < currentReview.score ? '' : 'opacity-30 grayscale'}`}>⭐</span>
                                    ))}
                                </div>
                                {/* #68 Show mood */}
                                {currentReview.mood && (
                                    <span className="text-2xl">{currentReview.mood}</span>
                                )}
                                {/* #69 Show category badge */}
                                {currentReview.category && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${CATEGORY_COLORS[currentReview.category] || 'bg-white/5 text-slate-400 border-white/10'}`}>
                                        {currentReview.category}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleEdit}
                                    className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 text-sm font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                    수정
                                </button>
                                <button
                                    onClick={() => setDeleteId(currentReview.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                                    aria-label="삭제"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {currentReview.keep && (
                                <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                                        <CheckCircle2 className="w-4 h-4" /> Keep (잘한 점)
                                    </h4>
                                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{currentReview.keep}</p>
                                </div>
                            )}
                            {currentReview.problem && (
                                <div className="bg-rose-50/50 dark:bg-rose-500/5 p-4 rounded-xl border border-rose-100 dark:border-rose-500/20">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-400 mb-2">
                                        <TrendingDown className="w-4 h-4" /> Problem (문제/아쉬운 점)
                                    </h4>
                                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{currentReview.problem}</p>
                                </div>
                            )}
                            {currentReview.try && (
                                <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-indigo-400 mb-2">
                                        <Plus className="w-4 h-4" /> Try (시도할 점)
                                    </h4>
                                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{currentReview.try}</p>
                                </div>
                            )}
                            {/* #73 Wins display */}
                            {currentReview.wins && (
                                <div className="bg-amber-50/50 dark:bg-amber-500/5 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">
                                        <Trophy className="w-4 h-4" /> 오늘의 작은 성취
                                    </h4>
                                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{currentReview.wins}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass flex flex-col items-center justify-center p-10 rounded-xl"
                    >
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-2xl md:text-3xl shadow-none">
                            ✍️
                        </div>
                        <h3 className="text-lg font-bold text-slate-100 mb-2">
                            아직 작성된 회고가 없습니다.
                        </h3>
                        <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">
                            오늘 하루를 되돌아보고, 잘한 점과 아쉬운 점을 기록해 성장의 발판으로 삼아보세요.
                        </p>
                        <button
                            onClick={() => {
                                setScore(5); setKeep(''); setProblem(''); setTryItem(''); setWins(''); setMood('😊'); setCategory('개인');
                                setIsWriting(true);
                            }}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-full transition-all shadow-none active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            첫 회고 작성하기
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* #70 Annual Review Report */}
            {reviewType === 'annual' && (
                <motion.div
                    key="annual"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-5 rounded-xl space-y-5"
                >
                    <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" /> {currentYear}년 연간 회고 리포트
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { label: '일정 달성', value: `${annualStats.yearCompleted}/${annualStats.yearSchedules}`, sub: '완료/전체', color: 'text-emerald-400' },
                            { label: '목표 달성', value: `${annualStats.completedGoals}개`, sub: '완료된 목표', color: 'text-amber-400' },
                            { label: '총 지출', value: `${(annualStats.yearExpense / 10000).toFixed(0)}만원`, sub: '올해 지출', color: 'text-rose-400' },
                            { label: '총 수입', value: `${(annualStats.yearIncome / 10000).toFixed(0)}만원`, sub: '올해 수입', color: 'text-blue-400' },
                            { label: '평균 점수', value: `${annualStats.avgScore}점`, sub: '회고 평점', color: 'text-purple-400' },
                            { label: '회고 횟수', value: `${reviews.filter(r => r.date?.startsWith(String(currentYear))).length}회`, sub: '작성한 회고', color: 'text-indigo-400' },
                        ].map(({ label, value, sub, color }) => (
                            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className={`text-xl font-bold ${color}`}>{value}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1">{label}</p>
                                <p className="text-[10px] text-slate-600">{sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Monthly expense bar chart */}
                    {Object.keys(annualStats.monthlyExpense).length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">월별 지출</h4>
                            <div className="flex items-end gap-1.5 h-20">
                                {Array.from({ length: 12 }, (_, i) => {
                                    const m = String(i + 1).padStart(2, '0');
                                    const val = annualStats.monthlyExpense[m] || 0;
                                    const maxVal = Math.max(...Object.values(annualStats.monthlyExpense), 1);
                                    const pct = (val / maxVal) * 100;
                                    return (
                                        <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full bg-rose-500/40 rounded-t-sm transition-all"
                                                style={{ height: `${Math.max(pct, 4)}%` }}
                                                title={`${i + 1}월: ${val.toLocaleString()}원`}
                                            />
                                            <span className="text-[9px] text-slate-600 font-bold">{i + 1}월</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Mood distribution */}
                    {(() => {
                        const yearReviews = reviews.filter(r => r.date?.startsWith(String(currentYear)));
                        if (yearReviews.length === 0) return null;
                        const moodCount = yearReviews.reduce((acc, r) => { acc[r.mood || '😊'] = (acc[r.mood || '😊'] || 0) + 1; return acc; }, {});
                        return (
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">기분 분포</h4>
                                <div className="flex gap-3 flex-wrap">
                                    {Object.entries(moodCount).sort((a, b) => b[1] - a[1]).map(([mood, count]) => (
                                        <div key={mood} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                                            <span className="text-lg">{mood}</span>
                                            <span className="text-sm font-bold text-slate-300">{count}회</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </motion.div>
            )}

            {/* #75 Keyword Cloud */}
            {reviewType !== 'annual' && keywordCloud.length > 0 && (
                <div className="glass rounded-xl overflow-hidden">
                    <button
                        onClick={() => setShowKeywords(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-indigo-400 text-base">🔍</span>
                            <span className="text-sm font-bold text-slate-300">자주 쓴 키워드</span>
                            <span className="bg-indigo-500/20 text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">{keywordCloud.length}개</span>
                        </div>
                        {showKeywords ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    <AnimatePresence>
                        {showKeywords && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 pb-5">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {keywordCloud.map(([word, count]) => {
                                            const maxCount = keywordCloud[0]?.[1] || 1;
                                            const ratio = count / maxCount;
                                            const size = ratio > 0.7 ? 'text-xl' : ratio > 0.4 ? 'text-base' : ratio > 0.2 ? 'text-sm' : 'text-xs';
                                            const opacity = ratio > 0.5 ? 'text-indigo-300' : ratio > 0.25 ? 'text-slate-300' : 'text-slate-500';
                                            return (
                                                <span
                                                    key={word}
                                                    className={`${size} ${opacity} font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-lg`}
                                                    title={`${count}회 등장`}
                                                >
                                                    {word}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* #69 Category filter + #74 Search + #75 Bookmark + Past reviews */}
            {reviewType !== 'annual' && reviews.filter(r => r.date !== filterDateStr).length > 0 && (
                <div className="glass p-4 md:p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-400">지난 회고 기록</h3>
                        <div className="flex gap-1.5 flex-wrap">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCategoryFilter(c)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${categoryFilter === c ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/5 text-slate-400 border-white/10 hover:border-indigo-500/30'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* #74 Search bar */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            value={reviewSearch}
                            onChange={e => setReviewSearch(e.target.value)}
                            placeholder="Keep/Problem/Try 내용 검색..."
                            className="w-full pl-8 pr-3 py-2 bg-[#09090b] border border-white/10 rounded-xl text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-3">
                        {pastReviews.map(r => {
                            const isBookmarked = bookmarkedIds.includes(r.id);
                            return (
                                <div key={r.id} className={`bg-[#09090b] p-3 rounded-xl border flex items-start gap-3 ${isBookmarked ? 'border-amber-500/30' : 'border-white/5'}`}>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-lg">{r.mood || '😊'}</span>
                                        <span className="text-[10px] font-bold text-slate-500">{r.date}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {r.category && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[r.category] || 'bg-white/5 text-slate-400 border-white/10'}`}>
                                                    {r.category}
                                                </span>
                                            )}
                                            {isBookmarked && <span className="text-[10px] text-amber-400">📌 북마크</span>}
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={`text-xs ${i < r.score ? '' : 'opacity-20 grayscale'}`}>⭐</span>
                                                ))}
                                            </div>
                                        </div>
                                        {r.keep && <p className="text-xs text-slate-400 truncate">{r.keep}</p>}
                                    </div>
                                    {/* #75 Bookmark button */}
                                    <button
                                        onClick={() => toggleBookmark(r.id)}
                                        className={`p-1 transition-colors shrink-0 ${isBookmarked ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-amber-400'}`}
                                        aria-label={isBookmarked ? '북마크 해제' : '북마크'}
                                    >
                                        <Bookmark className="w-3.5 h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(r.id)}
                                        className="p-1 text-slate-600 hover:text-rose-500 transition-colors shrink-0"
                                        aria-label="삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                        {pastReviews.length === 0 && reviewSearch && (
                            <p className="text-xs text-slate-600 text-center py-4">검색 결과가 없습니다.</p>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={deleteId !== null}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="회고 삭제"
                message="정말로 이 회고를 삭제하시겠습니까? (삭제 후 복구할 수 없습니다)"
                confirmText="삭제하기"
                isDestructive={true}
            />
        </section>
    );
}

ReviewView.propTypes = {
    reviews: PropTypes.array.isRequired,
    setReviews: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    schedules: PropTypes.array.isRequired,
    transactions: PropTypes.array,
    studies: PropTypes.array,
    studyTimes: PropTypes.object,
    goals: PropTypes.array,
    userProfile: PropTypes.object,
};