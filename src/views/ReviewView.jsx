import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { generateId } from '../utils/helpers';

export default function ReviewView({ reviews, setReviews, currentDate, schedules }) {
    const { ClipboardList, Plus, Trash2, CheckCircle2, TrendingDown } = IconMap;
    const [isWriting, setIsWriting] = useState(false);
    const [reviewType, setReviewType] = useState('daily'); // 'daily' | 'weekly'

    // Form state
    const [score, setScore] = useState(5);
    const [keep, setKeep] = useState('');
    const [problem, setProblem] = useState('');
    const [tryItem, setTryItem] = useState('');
    const [deleteId, setDeleteId] = useState(null);

    const filterDateStr = format(currentDate, 'yyyy-MM-dd');

    // Auto-generate statistics based on current date
    const todaySchedules = schedules.filter(s => s.date === filterDateStr);
    const todayCompleted = todaySchedules.filter(s => s.completed).length;
    const completionRate = todaySchedules.length > 0 ? Math.round((todayCompleted / todaySchedules.length) * 100) : 0;

    const currentReview = reviews.find(r => r.date === filterDateStr && r.type === reviewType);

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
            stats: {
                completionRate
            }
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
        setIsWriting(true);
    };

    const handleDelete = () => {
        setReviews(p => p.filter(r => r.id !== deleteId));
        toast.success('회고가 삭제되었습니다.');
        setDeleteId(null);
    };

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
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {format(currentDate, 'yyyy년 MM월 dd일')}의 기록을 모아보세요.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => setReviewType('daily')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${reviewType === 'daily' ? 'bg-[#111113] shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                            aria-pressed={reviewType === 'daily'}
                        >
                            일간
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                        <span className="text-xl md:text-2xl font-bold tracking-tight">{completionRate}%</span>
                        <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">일정 달성률</span>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl flex flex-col items-center justify-center border border-white/10">
                        <ClipboardList className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-xl md:text-2xl font-bold tracking-tight">{todayCompleted} / {todaySchedules.length}</span>
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
                        <div className="mb-6">
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
                                className="flex-[2] py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-indigo-500 shadow-none "
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
                            <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className={`text-xl md:text-2xl ${i < currentReview.score ? '' : 'opacity-30 grayscale'}`}>⭐</span>
                                ))}
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
                                setScore(5); setKeep(''); setProblem(''); setTryItem('');
                                setIsWriting(true);
                            }}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-full transition-all shadow-none  active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            첫 회고 작성하기
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

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
