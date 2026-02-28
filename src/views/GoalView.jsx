import React, { useState } from 'react';
import { IconMap } from '../components/IconMap';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

const emojiList = ['🎯', '🚀', '🔥', '💻', '💡', '🎓', '🏆', '✈️', '💰', '💪', '📚', '🎨', '🏖️', '🍔', '🎉'];
const gradientList = [
    { from: 'from-rose-400', to: 'to-orange-400' },
    { from: 'from-blue-400', to: 'to-indigo-500' },
    { from: 'from-purple-500', to: 'to-fuchsia-500' },
    { from: 'from-emerald-400', to: 'to-teal-500' },
    { from: 'from-amber-300', to: 'to-orange-500' },
    { from: 'from-cyan-400', to: 'to-blue-500' },
];

const trackerUnits = [
    { category: '기본 설정', options: ['% (수동 퍼센트)', '개 (항목수)', '건 (프로젝트/계약)'] },
    { category: '학습 및 자기계발', options: ['페이지 (독서/공부)', '장 (챕터)', '권 (책)', '문제 (풀이)', '점 (시험 점수)', '시간 (공부/집중)', '분 (짧은 집중)', '단어 (글쓰기)', '자 (원고 분량)'] },
    { category: '건강 및 운동', options: ['kg (체중 감량/증량)', 'km (러닝/라이딩)', 'm (수영)', '회 (운동 횟수)', '세트 (세트)', '걸음 (만보기)', 'kcal (칼로리)', '잔 (물 마시기)', 'L (물 마시기)'] },
    { category: '재정 및 경험', options: ['원 (저축/목표)', '달러 (투자/수입)', '일 (챌린지/진행일)', '주 (장기 프로젝트)', '달 (장기 계획)'] },
    { category: 'IT/개발 특화', options: ['커밋 (Git)', '버그 (이슈 해결)', 'PR (코드 리뷰)', '레벨 (성장 척도)'] }
];

export default function GoalView({ goals, setGoals }) {
    const { Flag, Plus, Trash2, X, Target, CheckSquare, List, LayoutDashboard, ChevronRight, ChevronDown, Settings } = IconMap;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState(null);
    const [newTaskText, setNewTaskText] = useState('');

    const [goalForm, setGoalForm] = useState({
        type: 'short',
        title: '',
        deadline: '',
        icon: '🎯',
        colorIdx: 0,
        trackerType: 'checklist',
        trackerUnit: '% (수동 퍼센트)',
        targetValue: 100
    });

    const shorts = goals.filter(g => g.type === 'short');
    const mids = goals.filter(g => g.type === 'mid');
    const longs = goals.filter(g => g.type === 'long');

    const triggerConfetti = () => {
        const count = 200;
        const defaults = { origin: { y: 0.7 } };
        function fire(particleRatio, opts) {
            confetti(Object.assign({}, defaults, opts, { particleCount: Math.floor(count * particleRatio) }));
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    const deleteGoal = (id) => {
        setGoals(prev => prev.filter(g => g.id !== id));
        if (selectedGoalId === id) setSelectedGoalId(null);
        toast('목표가 삭제되었습니다.', { icon: '🗑️', style: { border: '1px solid #fee2e2' } });
    };

    const updateGoalItem = (id, updates) => {
        setGoals(prev => prev.map(g => {
            if (g.id !== id) return g;
            const updated = { ...g, ...updates };

            // Check for confetti condition if progress just hit 100
            if (updated.progress === 100 && g.progress < 100) {
                triggerConfetti();
                toast.success('완벽합니다! 목표 달성을 축하합니다! 🎉', { duration: 4000 });
            }
            return updated;
        }));
    };

    const handleCreateGoal = () => {
        if (!goalForm.title.trim()) return toast.error('목표 제목을 입력해주세요.');
        if (!goalForm.deadline) return toast.error('마감일을 설정해주세요.');
        if (goalForm.trackerType === 'numeric' && (!goalForm.targetValue || Number(goalForm.targetValue) <= 0)) {
            return toast.error('올바른 목표 수치를 입력해주세요.');
        }

        const grad = gradientList[goalForm.colorIdx];

        setGoals(prev => [...prev, {
            id: Date.now(),
            type: goalForm.type,
            title: goalForm.title,
            progress: 0,
            deadline: goalForm.deadline,
            icon: goalForm.icon,
            colorFrom: grad.from,
            colorTo: grad.to,
            tasks: [],
            memo: '',
            tracker: {
                type: goalForm.trackerType,
                unit: goalForm.trackerUnit,
                current: 0,
                target: Number(goalForm.targetValue) || 100
            }
        }]);
        setIsCreateModalOpen(false);
        setGoalForm({ type: 'short', title: '', deadline: '', icon: '🎯', colorIdx: 0, trackerType: 'checklist', trackerUnit: '% (수동 퍼센트)', targetValue: 100 });
        toast.success('새로운 목표가 등록되었습니다!', { icon: '✨' });
    };

    const updateNumericProgress = (id, value, isDirect = false) => {
        setGoals(prev => prev.map(g => {
            if (g.id !== id) return g;
            if (!g.tracker) return g;

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
    };

    const addTask = (goal, text) => {
        if (!text.trim()) return;
        const newTasks = [...(goal.tasks || []), { id: Date.now(), text, done: false }];
        const newProgress = Math.round((newTasks.filter(t => t.done).length / newTasks.length) * 100);
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
        setNewTaskText('');
    };

    const toggleTask = (goal, taskId) => {
        const newTasks = goal.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
        const newProgress = Math.round((newTasks.filter(t => t.done).length / newTasks.length) * 100);
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
    };

    const deleteTask = (goal, taskId) => {
        const newTasks = goal.tasks.filter(t => t.id !== taskId);
        const newProgress = newTasks.length > 0 ? Math.round((newTasks.filter(t => t.done).length / newTasks.length) * 100) : goal.progress;
        updateGoalItem(goal.id, { tasks: newTasks, progress: newProgress });
    };

    const selectedGoal = goals.find(g => g.id === selectedGoalId);

    const GoalCard = ({ goal }) => {
        const cFrom = goal.colorFrom || 'from-slate-400';
        const cTo = goal.colorTo || 'to-slate-500';
        const hasTasks = goal.tasks && goal.tasks.length > 0;

        return (
            <motion.div
                layoutId={`card-${goal.id}`}
                onClick={() => setSelectedGoalId(goal.id)}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`group cursor-pointer bg-white dark:bg-[#13151a] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-slate-200/60 dark:border-white/5 transition-all flex flex-col relative ${goal.progress === 100 ? 'ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-[#0f1115]' : ''}`}
            >
                {/* Cover Header */}
                <div className={`h-14 bg-gradient-to-r ${cFrom} ${cTo} opacity-80 relative`}>
                    <div className="absolute -bottom-5 left-4 w-10 h-10 bg-white dark:bg-[#1a1c23] rounded-xl flex items-center justify-center text-xl shadow-sm border border-slate-100 dark:border-white/10">
                        {goal.icon || '🎯'}
                    </div>
                </div>

                <div className="p-4 pt-7 flex flex-col flex-1">
                    <h3 className={`font-black text-[15px] mb-1 line-clamp-2 ${goal.progress === 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {goal.title} {goal.progress === 100 && '🏆'}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-3">{goal.deadline} 까지</p>

                    <div className="mt-auto">
                        <div className="flex justify-between text-[10px] items-end mb-1.5 font-bold uppercase tracking-wide">
                            <span className="text-slate-400 flex items-center gap-1">
                                {goal.tracker?.type === 'numeric' ? (
                                    <><Target className="w-3 h-3 text-indigo-400" /> {goal.tracker.current} / {goal.tracker.target} <span className="text-[9px] truncate max-w-[50px]">{goal.tracker.unit.split(' ')[0]}</span></>
                                ) : (
                                    <><CheckSquare className="w-3 h-3 text-emerald-400" /> {hasTasks ? `${goal.tasks.filter(t => t.done).length}/${goal.tasks.length}` : '진행률'}</>
                                )}
                            </span>
                            <span className={goal.progress === 100 ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}>{goal.progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${goal.progress}%` }}
                                className={`h-full bg-gradient-to-r ${goal.progress === 100 ? 'from-emerald-400 to-emerald-500' : `${cFrom} ${cTo}`} rounded-full relative overflow-hidden`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer"></div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-[600px] mb-8 relative">
            <header className="flex justify-between items-center mb-6 pl-2 pr-1">
                <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100 mt-2 hover:scale-[1.02] origin-left transition-transform">
                    <div className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl">
                        <Flag className="w-5 h-5" />
                    </div>
                    Notion-스타일 목표 보드
                </h2>
                <button onClick={() => setIsCreateModalOpen(true)} className="bg-slate-900 dark:bg-indigo-600 text-white px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-1.5 hover:bg-slate-800 dark:hover:bg-indigo-500 active:scale-95">
                    <Plus className="w-4 h-4 stroke-[3]" /> <span className="hidden md:inline">새 페이지 생성</span><span className="md:hidden">생성</span>
                </button>
            </header>

            {/* Kanban/Gallery Board Layout */}
            <div className="flex flex-col md:flex-row gap-6 overflow-x-auto pb-4 snap-x [&::-webkit-scrollbar]:hidden">

                {/* Board Column 1 */}
                <div className="flex-1 min-w-[300px] snap-center flex flex-col gap-3 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> 단기 (과제/일반)
                        </h3>
                        <span className="bg-white dark:bg-white/5 text-slate-500 text-[10px] px-2 py-0.5 rounded-md font-bold">{shorts.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                        <AnimatePresence>
                            {shorts.map(g => <GoalCard key={g.id} goal={g} />)}
                        </AnimatePresence>
                    </div>
                    {shorts.length === 0 && <button onClick={() => { setGoalForm({ ...goalForm, type: 'short' }); setIsCreateModalOpen(true); }} className="w-full py-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-400 text-sm font-bold transition-colors flex flex-col items-center justify-center gap-2 mt-2"><Plus className="w-5 h-5" />추가하기</button>}
                </div>

                {/* Board Column 2 */}
                <div className="flex-1 min-w-[300px] snap-center flex flex-col gap-3 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> 중기 (학기/자격증)
                        </h3>
                        <span className="bg-white dark:bg-white/5 text-slate-500 text-[10px] px-2 py-0.5 rounded-md font-bold">{mids.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                        <AnimatePresence>
                            {mids.map(g => <GoalCard key={g.id} goal={g} />)}
                        </AnimatePresence>
                    </div>
                    {mids.length === 0 && <button onClick={() => { setGoalForm({ ...goalForm, type: 'mid' }); setIsCreateModalOpen(true); }} className="w-full py-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-400 text-sm font-bold transition-colors flex flex-col items-center justify-center gap-2 mt-2"><Plus className="w-5 h-5" />추가하기</button>}
                </div>

                {/* Board Column 3 */}
                <div className="flex-1 min-w-[300px] snap-center flex flex-col gap-3 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-3xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> 장기 (연간/취업/목돈)
                        </h3>
                        <span className="bg-white dark:bg-white/5 text-slate-500 text-[10px] px-2 py-0.5 rounded-md font-bold">{longs.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                        <AnimatePresence>
                            {longs.map(g => <GoalCard key={g.id} goal={g} />)}
                        </AnimatePresence>
                    </div>
                    {longs.length === 0 && <button onClick={() => { setGoalForm({ ...goalForm, type: 'long' }); setIsCreateModalOpen(true); }} className="w-full py-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-slate-400 text-sm font-bold transition-colors flex flex-col items-center justify-center gap-2 mt-2"><Plus className="w-5 h-5" />추가하기</button>}
                </div>

            </div>

            {/* Notion-Style Page Overaly (Goal Detail) */}
            <AnimatePresence>
                {selectedGoal && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center sm:px-4 fade-in">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedGoalId(null)}></div>

                        <motion.div
                            layoutId={`card-${selectedGoal.id}`}
                            className="relative bg-white dark:bg-[#111318] w-full sm:w-[500px] md:w-[650px] h-full sm:h-[85vh] sm:max-h-[800px] sm:rounded-3xl shadow-2xl overflow-y-auto flex flex-col [&::-webkit-scrollbar]:hidden"
                        >
                            {/* Page Cover */}
                            <div className={`h-40 sm:h-48 bg-gradient-to-r ${selectedGoal.colorFrom || 'from-slate-400'} ${selectedGoal.colorTo || 'to-slate-600'} relative shrink-0`}>
                                <button onClick={() => setSelectedGoalId(null)} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors backdrop-blur-sm z-10"><X className="w-5 h-5" /></button>

                                <div className="absolute -bottom-10 left-6 sm:left-10 text-6xl bg-transparent drop-shadow-md select-none bg-white/20 p-2 rounded-2xl backdrop-blur-md border border-white/30">
                                    {selectedGoal.icon}
                                </div>
                            </div>

                            <div className="px-6 sm:px-10 pt-14 pb-10 flex-1 space-y-6">
                                {/* Title Area */}
                                <div className="group">
                                    <input
                                        type="text"
                                        value={selectedGoal.title}
                                        onChange={(e) => updateGoalItem(selectedGoal.id, { title: e.target.value })}
                                        className="w-full text-3xl sm:text-4xl font-black text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 mb-1"
                                        placeholder="무제"
                                    />
                                    <div className="flex gap-4 text-xs font-bold text-slate-400 dark:text-slate-500">
                                        <div className="flex items-center gap-1"><Flag className="w-3.5 h-3.5" /> 데드라인: {selectedGoal.deadline}</div>
                                        <div className="flex items-center gap-1 cursor-pointer hover:text-rose-500 transition-colors" onClick={() => deleteGoal(selectedGoal.id)}><Trash2 className="w-3.5 h-3.5" /> 페이지 삭제</div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-100 dark:bg-white/5 w-full"></div>

                                {/* Progress/Checklist Area */}
                                {selectedGoal.tracker?.type === 'numeric' ? (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" /> 수치 기록 업데이트</h4>
                                        <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-5 shadow-inner">
                                            <div className="flex items-center justify-between">
                                                <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">{selectedGoal.tracker.current} <span className="text-sm font-bold text-slate-500">{selectedGoal.tracker.unit}</span></span>
                                                <div className="text-right">
                                                    <span className="block text-[11px] font-black text-slate-400 tracking-wider">목표 수치</span>
                                                    <span className="text-lg font-black text-slate-700 dark:text-slate-300">{selectedGoal.tracker.target}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={() => updateNumericProgress(selectedGoal.id, -1)} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold active:scale-95 transition-transform flex-1 shadow-sm">-1</button>
                                                <button onClick={() => updateNumericProgress(selectedGoal.id, 1)} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold active:scale-95 transition-transform flex-1 shadow-sm">+1</button>
                                                <button onClick={() => updateNumericProgress(selectedGoal.id, 5)} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold active:scale-95 transition-transform flex-1 shadow-sm">+5</button>
                                                <button onClick={() => updateNumericProgress(selectedGoal.id, 10)} className="p-3 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold active:scale-95 transition-transform flex-1 shadow-sm">+10</button>
                                            </div>
                                            <div className="pt-2">
                                                <input type="range" min="0" max={selectedGoal.tracker.target} value={selectedGoal.tracker.current} onChange={(e) => updateNumericProgress(selectedGoal.id, Number(e.target.value), true)} className="w-full accent-indigo-500 cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-500" /> 세부 체크리스트</h4>

                                        {/* Progress info if manual */}
                                        {(!selectedGoal.tasks || selectedGoal.tasks.length === 0) && (
                                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                                                <p className="text-xs font-bold text-slate-500 mb-2">체크리스트가 없습니다. 임의로 달성률 조절:</p>
                                                <input type="range" min="0" max="100" value={selectedGoal.progress} onChange={(e) => updateGoalItem(selectedGoal.id, { progress: Number(e.target.value) })} className="w-full accent-indigo-500 cursor-pointer" />
                                                <div className="text-right text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedGoal.progress}%</div>
                                            </div>
                                        )}

                                        {/* Tasks */}
                                        {selectedGoal.tasks && selectedGoal.tasks.length > 0 && (
                                            <div className="space-y-1">
                                                {selectedGoal.tasks.map(t => (
                                                    <div key={t.id} className="group/task flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                                        <label className="flex items-start gap-3 flex-1 cursor-pointer">
                                                            <div className="mt-0.5">
                                                                <input type="checkbox" checked={t.done} onChange={() => toggleTask(selectedGoal, t.id)} className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-white border-slate-300 dark:border-white/20 dark:bg-[#1a1c23] cursor-pointer" />
                                                            </div>
                                                            <span className={`text-[14px] font-medium transition-all ${t.done ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>{t.text}</span>
                                                        </label>
                                                        <button onClick={() => deleteTask(selectedGoal, t.id)} className="opacity-0 group-hover/task:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 transition-all"><X className="w-4 h-4" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Task Input */}
                                        <div className="flex gap-2">
                                            <input
                                                value={newTaskText}
                                                onChange={e => setNewTaskText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addTask(selectedGoal, newTaskText)}
                                                placeholder="할 일 추가... (Enter)"
                                                className="flex-1 bg-transparent border-b border-slate-200 dark:border-white/10 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500 outline-none placeholder:font-bold placeholder:text-slate-400"
                                            />
                                            <button onClick={() => addTask(selectedGoal, newTaskText)} className="text-indigo-500 text-sm font-black px-2 hover:text-indigo-600 transition-colors">추가</button>
                                        </div>
                                    </div>
                                )}

                                {/* Memo Area (Notion style rich placeholder) */}
                                <div className="space-y-3 pt-4">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2"><List className="w-4 h-4 text-emerald-500" /> 노트 / 기록</h4>
                                    <textarea
                                        value={selectedGoal.memo || ''}
                                        onChange={e => updateGoalItem(selectedGoal.id, { memo: e.target.value })}
                                        placeholder="슬래시(/)를 눌러 블록을 추가하세요. 목표를 달성하기 위한 구체적인 계획이나 다짐을 자유롭게 기록해보세요."
                                        rows={8}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-sm resize-none focus:ring-0 focus:outline-none focus:border-slate-300 dark:focus:border-white/20 text-slate-700 dark:text-slate-300 font-medium placeholder:font-medium placeholder:text-slate-400/70"
                                    ></textarea>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {/* Create New Goal Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></motion.div>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative glass-card bg-white dark:bg-[#13151a] w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-white/5"
                        >
                            <div className="p-7 space-y-6">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                                    <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">새 페이지 생성</h3>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="bg-slate-100 dark:bg-white/5 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10"><X className="w-5 h-5 text-slate-400" /></button>
                                </div>

                                <div className="space-y-4 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:hidden pb-4">
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider">유형</label>
                                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
                                            {['short', 'mid', 'long'].map(t => (
                                                <button key={t} onClick={() => setGoalForm({ ...goalForm, type: t })} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${goalForm.type === t ? 'bg-white dark:bg-[#1a1c23] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                                                    {t === 'short' ? '단기' : t === 'mid' ? '중기' : '장기'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider">페이지 제목 *</label>
                                        <input autoFocus value={goalForm.title} onChange={e => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="예: 토익 900점 완성, 이번주 팀플" className="w-full bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono" />
                                    </div>

                                    <div className="border-t border-b border-slate-100 dark:border-white/5 py-4 my-2">
                                        <label className="block text-[11px] font-black text-slate-500 mb-3 uppercase tracking-wider"><Target className="w-3 h-3 inline pb-0.5 text-indigo-400" /> 달성률 측정 방식</label>
                                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl mb-3">
                                            <button onClick={() => setGoalForm({ ...goalForm, trackerType: 'checklist' })} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${goalForm.trackerType === 'checklist' ? 'bg-white dark:bg-[#1a1c23] text-emerald-500 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                                                ✅ 체크리스트 (태스크)
                                            </button>
                                            <button onClick={() => setGoalForm({ ...goalForm, trackerType: 'numeric' })} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${goalForm.trackerType === 'numeric' ? 'bg-white dark:bg-[#1a1c23] text-indigo-500 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                                                📈 수치 기록 (30+종)
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {goalForm.trackerType === 'numeric' && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                    <div className="grid grid-cols-5 gap-3 bg-slate-50 dark:bg-[#0f1115] p-3 rounded-2xl border border-slate-200 dark:border-white/10 mt-2 shadow-inner">
                                                        <div className="col-span-3">
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 pl-1">단위 선택</label>
                                                            <select value={goalForm.trackerUnit} onChange={e => setGoalForm({ ...goalForm, trackerUnit: e.target.value })} className="w-full bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer">
                                                                {trackerUnits.map(cat => (
                                                                    <optgroup key={cat.category} label={cat.category}>
                                                                        {cat.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </optgroup>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 pl-1">목표 달성 수치</label>
                                                            <input type="number" min="1" value={goalForm.targetValue} onChange={e => setGoalForm({ ...goalForm, targetValue: e.target.value })} className="w-full bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider">아이콘</label>
                                            <div className="relative group cursor-pointer bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                                <span className="text-xl">{goalForm.icon}</span> <ChevronDown className="w-4 h-4 text-slate-400" />
                                                <div className="absolute top-10  left-0 w-[200px] bg-white dark:bg-[#13151a] border border-slate-200 dark:border-white/10 p-2 rounded-xl shadow-xl z-10 hidden group-hover:flex flex-wrap gap-2">
                                                    {emojiList.map(emj => (
                                                        <button key={emj} onClick={(e) => { e.preventDefault(); setGoalForm({ ...goalForm, icon: emj }); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-lg">{emj}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider">마감일 *</label>
                                            <input type="date" value={goalForm.deadline} onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value })} className="w-full h-12 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all [color-scheme:light] dark:[color-scheme:dark]" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wider">커버 색상</label>
                                        <div className="flex gap-2">
                                            {gradientList.map((g, idx) => (
                                                <button key={idx} onClick={() => setGoalForm({ ...goalForm, colorIdx: idx })} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.from} ${g.to} cursor-pointer transition-transform ${goalForm.colorIdx === idx ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#13151a]' : 'hover:scale-105 opacity-60'}`}></button>
                                            ))}
                                        </div>
                                    </div>

                                </div>

                                <button onClick={handleCreateGoal} className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg mt-2 active:scale-95 transition-transform">
                                    생성하기
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
