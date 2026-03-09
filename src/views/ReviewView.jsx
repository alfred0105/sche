import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameWeek } from 'date-fns';
import { toast } from 'react-hot-toast';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { generateId } from '../utils/helpers';

const MOODS = ['😊', '😄', '😐', '😔', '😤'];
const CATEGORIES = ['전체', '업무', '개인', '건강', '재정'];
const CATEGORY_COLORS = {
    '업무': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    '개인': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    '건강': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    '재정': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export default function ReviewView({ reviews, setReviews, currentDate, schedules }) {
    const { ClipboardList, Plus, Trash2, CheckCircle2, TrendingDown, Trophy } = IconMap;
    const [isWriting, setIsWriting] = useState(false);
    const [reviewType, setReviewType] = useState('daily'); // 'daily' | 'weekly'
    const [categoryFilter, setCategoryFilter] = useState('전체');

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

    // Past reviews filtered by category (excluding current date's review)
    const pastReviews = useMemo(() => {
        return reviews
            .filter(r => r.date !== filterDateStr)
            .filter(r => categoryFilter === '전체' || r.category === categoryFilter)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10);
    }, [reviews, filterDateStr, categoryFilter]);

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
                    {/* #66 Weekly tab back */}
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => setReviewType('daily')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${reviewType === 'daily' ? 'bg-[#111113] shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            aria-pressed={reviewType === 'daily'}
                        >
                            일간
                        </button>
                        <button
                            onClick={() => setReviewType('weekly')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${reviewType === 'weekly' ? 'bg-[#111113] shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            aria-pressed={reviewType === 'weekly'}
                        >
                            주간
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
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
                </div>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                {isWriting ? (
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

            {/* #69 Category filter + Past reviews */}
            {reviews.filter(r => r.date !== filterDateStr).length > 0 && (
                <div className="glass p-4 md:p-5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
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
                    <div className="space-y-3">
                        {pastReviews.map(r => (
                            <div key={r.id} className="bg-[#09090b] p-3 rounded-xl border border-white/5 flex items-start gap-3">
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
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i} className={`text-xs ${i < r.score ? '' : 'opacity-20 grayscale'}`}>⭐</span>
                                            ))}
                                        </div>
                                    </div>
                                    {r.keep && <p className="text-xs text-slate-400 truncate">{r.keep}</p>}
                                </div>
                                <button
                                    onClick={() => setDeleteId(r.id)}
                                    className="p-1 text-slate-600 hover:text-rose-500 transition-colors shrink-0"
                                    aria-label="삭제"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
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
};