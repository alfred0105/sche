/**
 * @fileoverview GoalView — refactored to use extracted GoalCard, shared constants,
 * proper ID generation, accessibility (ARIA, keyboard nav, ESC key), and PropTypes.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import GoalCard from '../components/GoalCard';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import { EMOJI_LIST, GRADIENT_LIST, TRACKER_UNITS } from '../constants';
import { generateId } from '../utils/helpers';

export default function GoalView({ goals, setGoals }) {
    const { Flag, Plus, Trash2, X, Target, CheckSquare, List, ChevronDown } = IconMap;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState(null);
    const [newTaskText, setNewTaskText] = useState('');

    const [goalForm, setGoalForm] = useState({
        type: 'short', title: '', deadline: '', icon: '🎯', colorIdx: 0,
        trackerType: 'checklist', trackerUnit: '% (수동 퍼센트)', targetValue: 100,
    });

    const shorts = useMemo(() => goals.filter((g) => g.type === 'short'), [goals]);
    const mids = useMemo(() => goals.filter((g) => g.type === 'mid'), [goals]);
    const longs = useMemo(() => goals.filter((g) => g.type === 'long'), [goals]);
    const selectedGoal = useMemo(() => goals.find((g) => g.id === selectedGoalId), [goals, selectedGoalId]);

    // ESC key to close modals
    useEffect(() => {
        if (!selectedGoalId && !isCreateModalOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (selectedGoalId) setSelectedGoalId(null);
                else if (isCreateModalOpen) setIsCreateModalOpen(false);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedGoalId, isCreateModalOpen]);

    const triggerConfetti = useCallback(() => {
        const count = 200;
        const defaults = { origin: { y: 0.7 } };
        const fire = (particleRatio, opts) =>
            confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    }, []);

    const deleteGoal = useCallback((id) => {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        if (selectedGoalId === id) setSelectedGoalId(null);
        toast('목표가 삭제되었습니다.', { icon: '🗑️' });
    }, [setGoals, selectedGoalId]);

    const updateGoalItem = useCallback((id, updates) => {
        setGoals((prev) => prev.map((g) => {
            if (g.id !== id) return g;
            const updated = { ...g, ...updates };
            if (updated.progress === 100 && g.progress < 100) {
                triggerConfetti();
                toast.success('완벽합니다! 목표 달성을 축하합니다! 🎉', { duration: 4000 });
            }
            return updated;
        }));
    }, [setGoals, triggerConfetti]);

    const handleCreateGoal = useCallback(() => {
        if (!goalForm.title.trim()) return toast.error('목표 제목을 입력해주세요.');
        if (!goalForm.deadline) return toast.error('마감일을 설정해주세요.');
        if (goalForm.trackerType === 'numeric' && (!goalForm.targetValue || Number(goalForm.targetValue) <= 0)) {
            return toast.error('올바른 목표 수치를 입력해주세요.');
        }
        const grad = GRADIENT_LIST[goalForm.colorIdx];
        setGoals((prev) => [...prev, {
            id: generateId(),
            type: goalForm.type,
            title: goalForm.title,
            progress: 0,
            deadline: goalForm.deadline,
            icon: goalForm.icon,
            colorFrom: grad.from,
            colorTo: grad.to,
            tasks: [],
            memo: '',
            tracker: { type: goalForm.trackerType, unit: goalForm.trackerUnit, current: 0, target: Number(goalForm.targetValue) || 100 },
        }]);
        setIsCreateModalOpen(false);
        setGoalForm({ type: 'short', title: '', deadline: '', icon: '🎯', colorIdx: 0, trackerType: 'checklist', trackerUnit: '% (수동 퍼센트)', targetValue: 100 });
        toast.success('새로운 목표가 등록되었습니다!', { icon: '✨' });
    }, [goalForm, setGoals]);

    const updateNumericProgress = useCallback((id, value, isDirect = false) => {
        setGoals((prev) => prev.map((g) => {
            if (g.id !== id || !g.tracker) return g;
            let newCurrent = isDirect ? value : (g.tracker.current + value);
            if (newCurrent < 0) newCurrent = 0;
            if (newCurrent > g.tracker.target) newCurrent = g.tracker.target;
            const newProgress = Math.round((newCurrent / g.tracker.target) * 100);
            const updated = { ...g, tracker: { ...g.tracker, current: newCurrent }, progress: newProgress };
            if (updated.progress === 100 && g.progress < 100) {
                triggerConfetti();
                toast.success('완벽합니다! 목표 달성을 축하합니다! 🎉', { duration: 4000 });
            }
            return updated;
        }));
    }, [setGoals, triggerConfetti]);

    const addTask = useCallback((goal, text) => {
        if (!text.trim()) return;
        const newTasks = [...(goal.tasks || []), { id: generateId(), text, done: false }];
        const newProgress = Math.round((newTasks.filter((t) => t.done).length / newTasks.length) * 100);
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
        setNewTaskText('');
    }, [updateGoalItem]);

    const toggleTask = useCallback((goal, taskId) => {
        const newTasks = goal.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
        const newProgress = Math.round((newTasks.filter((t) => t.done).length / newTasks.length) * 100);
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
    }, [updateGoalItem]);

    const deleteTask = useCallback((goal, taskId) => {
        const newTasks = goal.tasks.filter((t) => t.id !== taskId);
        const newProgress = newTasks.length > 0 ? Math.round((newTasks.filter((t) => t.done).length / newTasks.length) * 100) : goal.progress;
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
    }, [updateGoalItem]);

    const handleGoalClick = useCallback((id) => setSelectedGoalId(id), []);

    const renderColumn = (type, label, dotColor, items) => (
        <div className="flex-1 min-w-[300px] snap-center flex flex-col gap-3 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-xl border border-white/10 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${dotColor}`} aria-hidden="true" />
            <div className="flex items-center justify-between mb-2 px-1 pt-1">
                <h3 className="text-base font-bold tracking-tight text-slate-200 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${dotColor} shadow-none`} aria-hidden="true" /> {label}
                </h3>
                <span className="bg-[#111113] text-slate-400 text-xs px-2.5 py-0.5 rounded-lg font-bold tracking-tight border border-white/10 shadow-none" aria-label={`${items.length}개`}>{items.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3" role="list" aria-label={`${label} 목표 목록`}>
                <AnimatePresence>
                    {items.map((g) => <GoalCard key={g.id} goal={g} onClick={handleGoalClick} />)}
                </AnimatePresence>
            </div>
            {items.length === 0 && (
                <button
                    onClick={() => { setGoalForm({ ...goalForm, type }); setIsCreateModalOpen(true); }}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-400 text-sm font-bold transition-colors flex flex-col items-center justify-center gap-2 mt-2"
                    aria-label={`새 ${label} 목표 추가`}
                >
                    <Plus className="w-5 h-5" aria-hidden="true" />추가하기
                </button>
            )}
        </div>
    );

    return (
        <section className="min-h-[600px] mb-8 relative" aria-label="목표 관리">
            <header className="flex justify-between items-center mb-6 pl-2 pr-1">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-400 mt-2">
                    <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl" aria-hidden="true">
                        <Flag className="w-5 h-5" />
                    </div>
                    Notion-스타일 목표 보드
                </h2>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-slate-900 dark:bg-indigo-600 text-white px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-none flex items-center gap-1.5 hover:bg-slate-800 dark:hover:bg-indigo-500 active:scale-95"
                    aria-label="새 목표 페이지 생성"
                >
                    <Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" /> <span className="hidden md:inline">새 페이지 생성</span><span className="md:hidden">생성</span>
                </button>
            </header>

            <div className="flex flex-col md:flex-row gap-4 md:p-5 overflow-x-auto pb-4 snap-x [&::-webkit-scrollbar]:hidden">
                {renderColumn('short', '단기 (과제/일반)', 'bg-rose-400', shorts)}
                {renderColumn('mid', '중기 (학기/자격증)', 'bg-blue-400', mids)}
                {renderColumn('long', '장기 (연간/취업/목돈)', 'bg-purple-500', longs)}
            </div>

            {/* Goal Detail Overlay */}
            <AnimatePresence>
                {selectedGoal && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center sm:px-4 fade-in" role="dialog" aria-modal="true" aria-labelledby="goal-detail-title">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedGoalId(null)} aria-hidden="true" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="relative bg-[#111113] w-full sm:w-[500px] md:w-[650px] h-full sm:h-[85vh] sm:max-h-[800px] sm:rounded-xl shadow-2xl overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden"
                        >
                            <div className={`h-40 sm:h-48 bg-gradient-to-r ${selectedGoal.colorFrom || 'from-slate-400'} ${selectedGoal.colorTo || 'to-slate-600'} relative shrink-0`} aria-hidden="true">
                                <button onClick={() => setSelectedGoalId(null)} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm z-10" aria-label="닫기"><X className="w-5 h-5" /></button>
                                <div className="absolute -bottom-10 left-6 sm:left-10 text-6xl bg-transparent drop-shadow-none select-none bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/30">{selectedGoal.icon}</div>
                            </div>
                            <div className="px-5 sm:px-10 pt-14 pb-10 flex-1 space-y-6">
                                <div>
                                    <input
                                        id="goal-detail-title"
                                        type="text"
                                        value={selectedGoal.title}
                                        onChange={(e) => updateGoalItem(selectedGoal.id, { title: e.target.value })}
                                        className="w-full text-2xl md:text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 mb-1"
                                        placeholder="무제"
                                        aria-label="목표 제목"
                                    />
                                    <div className="flex gap-4 text-xs font-bold text-slate-400">
                                        <div className="flex items-center gap-1"><Flag className="w-3.5 h-3.5" aria-hidden="true" /> 데드라인: {selectedGoal.deadline}</div>
                                        <button className="flex items-center gap-1 cursor-pointer hover:text-rose-500 transition-colors" onClick={() => deleteGoal(selectedGoal.id)} aria-label="이 목표 삭제"><Trash2 className="w-3.5 h-3.5" /> 페이지 삭제</button>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 w-full" role="separator" />

                                {selectedGoal.tracker?.type === 'numeric' ? (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold tracking-tight text-slate-400 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" aria-hidden="true" /> 수치 기록 업데이트</h4>
                                        <div className="bg-[#09090b] p-5 rounded-xl border border-white/10 space-y-5 shadow-none">
                                            <div className="flex items-center justify-between">
                                                <span className="text-4xl font-bold tracking-tight text-indigo-400 tracking-tight">{selectedGoal.tracker.current} <span className="text-sm font-bold text-slate-500">{selectedGoal.tracker.unit}</span></span>
                                                <div className="text-right"><span className="block text-[11px] font-bold tracking-tight text-slate-400 tracking-wider">목표 수치</span><span className="text-lg font-bold tracking-tight text-slate-200">{selectedGoal.tracker.target}</span></div>
                                            </div>
                                            <div className="flex gap-2" role="group" aria-label="수치 조절">
                                                {[-1, 1, 5, 10].map((v) => (
                                                    <button key={v} onClick={() => updateNumericProgress(selectedGoal.id, v)} className="p-3 bg-[#111113] border border-white/10 rounded-xl hover:bg-white/10 text-slate-400 font-bold active:scale-95 transition-transform flex-1 shadow-none">
                                                        {v > 0 ? `+${v}` : v}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="pt-2">
                                                <label htmlFor="numeric-range" className="sr-only">수치 직접 조절</label>
                                                <input id="numeric-range" type="range" min="0" max={selectedGoal.tracker.target} value={selectedGoal.tracker.current} onChange={(e) => updateNumericProgress(selectedGoal.id, Number(e.target.value), true)} className="w-full accent-indigo-500 cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold tracking-tight text-slate-400 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-500" aria-hidden="true" /> 세부 체크리스트</h4>
                                        {(!selectedGoal.tasks || selectedGoal.tasks.length === 0) && (
                                            <div className="bg-[#09090b] p-4 rounded-xl border border-white/10 space-y-2">
                                                <p className="text-xs font-bold text-slate-500 mb-2">체크리스트가 없습니다. 임의로 달성률 조절:</p>
                                                <label htmlFor="manual-progress" className="sr-only">달성률 조절</label>
                                                <input id="manual-progress" type="range" min="0" max="100" value={selectedGoal.progress} onChange={(e) => updateGoalItem(selectedGoal.id, { progress: Number(e.target.value) })} className="w-full accent-indigo-500 cursor-pointer" />
                                                <div className="text-right text-xs font-bold tracking-tight text-indigo-400" aria-live="polite">{selectedGoal.progress}%</div>
                                            </div>
                                        )}
                                        {selectedGoal.tasks && selectedGoal.tasks.length > 0 && (
                                            <div className="space-y-1" role="list" aria-label="체크리스트">
                                                {selectedGoal.tasks.map((t) => (
                                                    <div key={t.id} className="group/task flex items-center justify-between p-2 hover:bg-white/10 rounded-xl transition-colors" role="listitem">
                                                        <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                                            <div className="mt-0.5"><input type="checkbox" checked={t.done} onChange={() => toggleTask(selectedGoal, t.id)} className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-white border-white/10 dark:bg-[#1a1c23] cursor-pointer" /></div>
                                                            <span className={`text-[14px] font-medium transition-all ${t.done ? 'line-through text-slate-400' : 'text-slate-200'}`}>{t.text}</span>
                                                        </label>
                                                        <button onClick={() => deleteTask(selectedGoal, t.id)} className="opacity-0 group-hover/task:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 transition-all" aria-label={`${t.text} 삭제`}><X className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <label htmlFor="new-task-input" className="sr-only">새 할 일</label>
                                            <input id="new-task-input" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask(selectedGoal, newTaskText)} placeholder="할 일 추가... (Enter)" className="flex-1 bg-transparent border-b border-white/10 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none placeholder:font-bold placeholder:text-slate-400" />
                                            <button onClick={() => addTask(selectedGoal, newTaskText)} className="text-indigo-500 text-sm font-bold tracking-tight px-2 hover:text-indigo-600 transition-colors">추가</button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 pt-4">
                                    <h4 className="text-sm font-bold tracking-tight text-slate-400 flex items-center gap-2"><List className="w-4 h-4 text-emerald-500" aria-hidden="true" /> 노트 / 기록</h4>
                                    <label htmlFor="goal-memo" className="sr-only">메모</label>
                                    <textarea id="goal-memo" value={selectedGoal.memo || ''} onChange={(e) => updateGoalItem(selectedGoal.id, { memo: e.target.value })} placeholder="목표를 달성하기 위한 구체적인 계획이나 다짐을 자유롭게 기록해보세요." rows={8} className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 text-sm resize-none focus:ring-0 focus:outline-none focus:border-slate-300 dark:focus:border-white/20 text-slate-200 font-medium placeholder:font-medium placeholder:text-slate-400/70" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create New Goal Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="create-goal-title">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} aria-hidden="true" />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="relative glass-card bg-[#111113] w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-white/5">
                            <div className="p-7 space-y-6">
                                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                                    <h3 id="create-goal-title" className="font-bold tracking-tight text-xl text-slate-100 flex items-center gap-2">새 페이지 생성</h3>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10" aria-label="닫기"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:hidden pb-4">
                                    <div>
                                        <label className="block text-[11px] font-bold tracking-tight text-slate-500 mb-2 uppercase tracking-wider">유형</label>
                                        <div className="flex gap-2 p-1 bg-white/5 rounded-xl" role="radiogroup" aria-label="목표 유형">
                                            {[{ val: 'short', label: '단기' }, { val: 'mid', label: '중기' }, { val: 'long', label: '장기' }].map(({ val, label }) => (
                                                <button key={val} role="radio" aria-checked={goalForm.type === val} onClick={() => setGoalForm({ ...goalForm, type: val })} className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-tight transition-all ${goalForm.type === val ? 'bg-[#111113] text-indigo-400 shadow-none' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="goal-title-input" className="block text-[11px] font-bold tracking-tight text-slate-500 mb-2 uppercase tracking-wider">페이지 제목 *</label>
                                        <input id="goal-title-input" autoFocus value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="예: 토익 900점 완성, 이번주 팀플" className="w-full bg-[#111113] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 outline-none focus:border-indigo-500 transition-all" aria-required="true" />
                                    </div>
                                    <div className="border-t border-b border-white/10 py-4 my-2">
                                        <label className="block text-[11px] font-bold tracking-tight text-slate-500 mb-3 uppercase tracking-wider"><Target className="w-3 h-3 inline pb-0.5 text-indigo-400" aria-hidden="true" /> 달성률 측정 방식</label>
                                        <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-3" role="radiogroup" aria-label="측정 방식">
                                            <button role="radio" aria-checked={goalForm.trackerType === 'checklist'} onClick={() => setGoalForm({ ...goalForm, trackerType: 'checklist' })} className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all ${goalForm.trackerType === 'checklist' ? 'bg-[#111113] text-emerald-500 shadow-none border border-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>✅ 체크리스트 (태스크)</button>
                                            <button role="radio" aria-checked={goalForm.trackerType === 'numeric'} onClick={() => setGoalForm({ ...goalForm, trackerType: 'numeric' })} className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all ${goalForm.trackerType === 'numeric' ? 'bg-[#111113] text-indigo-500 shadow-none border border-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>📈 수치 기록 (30+종)</button>
                                        </div>
                                        <AnimatePresence>
                                            {goalForm.trackerType === 'numeric' && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                    <div className="grid grid-cols-5 gap-3 bg-[#09090b] p-3 rounded-xl border border-white/10 mt-2 shadow-none">
                                                        <div className="col-span-3">
                                                            <label htmlFor="tracker-unit-select" className="block text-[10px] font-bold text-slate-500 mb-1.5 pl-1">단위 선택</label>
                                                            <select id="tracker-unit-select" value={goalForm.trackerUnit} onChange={(e) => setGoalForm({ ...goalForm, trackerUnit: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-slate-200 outline-none cursor-pointer">
                                                                {TRACKER_UNITS.map((cat) => (<optgroup key={cat.category} label={cat.category}>{cat.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</optgroup>))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label htmlFor="target-value-input" className="block text-[10px] font-bold text-slate-500 mb-1.5 pl-1">목표 달성 수치</label>
                                                            <input id="target-value-input" type="number" min="1" value={goalForm.targetValue} onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 outline-none focus:border-indigo-500" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold tracking-tight text-slate-500 mb-2 uppercase tracking-wider">아이콘</label>
                                            <div className="relative group cursor-pointer bg-[#111113] border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                                <span className="text-xl" aria-label="선택된 아이콘">{goalForm.icon}</span> <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                                <div className="absolute top-10 left-0 w-[200px] bg-[#111113] border border-white/10 p-2 rounded-xl shadow-none z-10 hidden group-hover:flex flex-wrap gap-2" role="listbox" aria-label="아이콘 선택">
                                                    {EMOJI_LIST.map((emj) => (<button key={emj} role="option" aria-selected={goalForm.icon === emj} onClick={(e) => { e.preventDefault(); setGoalForm({ ...goalForm, icon: emj }); }} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg">{emj}</button>))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="goal-deadline-input" className="block text-[11px] font-bold tracking-tight text-slate-500 mb-2 uppercase tracking-wider">마감일 *</label>
                                            <input id="goal-deadline-input" type="date" value={goalForm.deadline} onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })} className="w-full h-12 bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 outline-none focus:border-indigo-500 transition-all [color-scheme:light] dark:[color-scheme:dark]" aria-required="true" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold tracking-tight text-slate-500 mb-2 uppercase tracking-wider">커버 색상</label>
                                        <div className="flex gap-2" role="radiogroup" aria-label="커버 색상 선택">
                                            {GRADIENT_LIST.map((g, idx) => (<button key={idx} role="radio" aria-checked={goalForm.colorIdx === idx} aria-label={`색상 ${idx + 1}`} onClick={() => setGoalForm({ ...goalForm, colorIdx: idx })} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.from} ${g.to} cursor-pointer transition-transform ${goalForm.colorIdx === idx ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#13151a]' : 'hover:scale-105 opacity-60'}`} />))}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleCreateGoal} className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-bold tracking-tight py-4 rounded-xl shadow-none mt-2 active:scale-95 transition-transform">생성하기</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
}

GoalView.propTypes = {
    goals: PropTypes.array.isRequired,
    setGoals: PropTypes.func.isRequired,
};
