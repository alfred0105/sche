/**
 * @fileoverview StudyView — completely redesigned with:
 *  - GitHub-style attendance heatmap calendar (fills right side)  
 *  - Streak counter with fire animation
 *  - ConfirmModal instead of window.confirm
 *  - Better progress bar (thicker, min-width)
 *  - Stats cards (total days, streak, completion rate)
 *  - PropTypes, useMemo, useCallback, ARIA
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { format, subDays, parseISO, differenceInDays, startOfMonth, endOfMonth, getDay, eachDayOfInterval, isSameMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { generateId } from '../utils/helpers';

// Mini heatmap calendar component
function AttendanceHeatmap({ logs, currentDate }) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPad = getDay(monthStart); // 0=Sun

    const logSet = useMemo(() => new Set(logs), [logs]);
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    return (
        <div className="w-full">
            <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider">
                {format(currentDate, 'yyyy년 M월')} 출석 현황
            </p>
            <div className="grid grid-cols-7 gap-[3px]">
                {weekDays.map((d) => (
                    <div key={d} className="text-[9px] font-bold text-slate-400 text-center pb-1">{d}</div>
                ))}
                {Array.from({ length: startPad }).map((_, i) => (
                    <div key={`pad-${i}`} />
                ))}
                {days.map((day) => {
                    const ds = format(day, 'yyyy-MM-dd');
                    const isToday = ds === format(currentDate, 'yyyy-MM-dd');
                    const checked = logSet.has(ds);
                    const isPast = day <= currentDate;
                    return (
                        <div
                            key={ds}
                            className={`aspect-square rounded-[4px] text-[9px] font-bold flex items-center justify-center transition-all
                ${checked
                                    ? 'bg-indigo-500 dark:bg-indigo-400 text-white shadow-none shadow-none-500/30'
                                    : isPast
                                        ? 'bg-white/5 text-slate-400'
                                        : 'bg-[#09090b][0.02] text-slate-400'
                                }
                ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-[#1a1c23]' : ''}
              `}
                            title={`${ds} ${checked ? '✅ 출석' : ''}`}
                        >
                            {day.getDate()}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Calculate consecutive streak
function getStreak(logs, currentDate) {
    if (!logs || logs.length === 0) return 0;
    const sorted = [...logs].sort().reverse();
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(currentDate, 1), 'yyyy-MM-dd');

    // Must include today or yesterday to have an active streak
    if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) return 0;

    let streak = 0;
    let checkDate = sorted[0] === todayStr ? currentDate : subDays(currentDate, 1);
    const logSet = new Set(logs);

    while (logSet.has(format(checkDate, 'yyyy-MM-dd'))) {
        streak++;
        checkDate = subDays(checkDate, 1);
    }
    return streak;
}

export default function StudyView({ studies, setStudies, currentDate }) {
    const { BookOpen, CheckCircle2, Trash2, Plus, Target, TrendingUp, Calendar: CalIcon, Flame } = IconMap;

    const [isAddMode, setIsAddMode] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState(30);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

    // === Timer State Setup ===
    const [timerState, setTimerState] = useState({ activeId: null, seconds: 0, isRunning: false });
    const timerRef = useRef(null);

    const toggleTimer = useCallback((studyId) => {
        setTimerState(prev => {
            if (prev.activeId === studyId) {
                return { ...prev, isRunning: !prev.isRunning };
            } else {
                return { activeId: studyId, seconds: 0, isRunning: true };
            }
        });
    }, []);

    useEffect(() => {
        if (timerState.isRunning) {
            timerRef.current = window.setInterval(() => {
                setTimerState(prev => ({ ...prev, seconds: prev.seconds + 1 }));
            }, 1000);
        } else if (timerRef.current) {
            window.clearInterval(timerRef.current);
        }
        return () => window.clearInterval(timerRef.current);
    }, [timerState.isRunning]);

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        if (h > 0) return `${h}:${m}:${s}`;
        return `${m}:${s}`;
    };
    // ===========================

    const handleAdd = useCallback(() => {
        if (!newTitle.trim()) return toast.error('공부 목표 텍스트를 입력해주세요.');
        if (newTarget < 1) return toast.error('목표 일수는 1일 이상이어야 합니다.');
        setStudies((prev) => [...prev, {
            id: generateId(),
            title: newTitle,
            icon: 'BookOpen',
            totalDays: parseInt(newTarget),
            logs: [],
        }]);
        setNewTitle('');
        setIsAddMode(false);
        toast.success('새로운 공부 목표가 추가되었습니다.', { icon: '🎯' });
    }, [newTitle, newTarget, setStudies]);

    const handleDeleteConfirm = useCallback(() => {
        setStudies((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
        setDeleteConfirm({ open: false, id: null });
        toast.success('삭제 완료', { icon: '🗑️' });
    }, [deleteConfirm.id, setStudies]);

    const handleCheckIn = useCallback((study) => {
        const todayStr = format(currentDate, 'yyyy-MM-dd');
        const alreadyChecked = study.logs.includes(todayStr);
        const newLogs = alreadyChecked
            ? study.logs.filter((l) => l !== todayStr)
            : [...study.logs, todayStr];
        if (!alreadyChecked) toast.success('오늘의 출석 완료! 화이팅!', { icon: '🔥' });
        else toast('출석을 취소했습니다.', { icon: '🔄' });
        setStudies((prev) => prev.map((s) => (s.id === study.id ? { ...s, logs: newLogs } : s)));
    }, [currentDate, setStudies]);

    return (
        <section className="flex flex-col gap-4 md:gap-6 pb-20" aria-label="공부 및 출석부">
            <ConfirmModal
                isOpen={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false, id: null })}
                onConfirm={handleDeleteConfirm}
                title="공부 목표 삭제"
                message="이 공부 목표와 모든 출석 기록을 삭제하시겠습니까?"
                confirmText="삭제"
                variant="danger"
            />

            <header className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                    <div className="bg-indigo-500/10 text-text-indigo-400 p-2 rounded-xl" aria-hidden="true">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    공부 및 출석부
                </h2>
                <button
                    onClick={() => setIsAddMode(!isAddMode)}
                    className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-none active:scale-95 transition-transform flex items-center gap-1.5"
                    aria-label={isAddMode ? '추가 취소' : '새 목표 추가'}
                >
                    {isAddMode ? '취소' : <><Plus className="w-4 h-4 stroke-[3]" aria-hidden="true" /> 목표 추가</>}
                </button>
            </header>

            {/* Add New Study Form */}
            <AnimatePresence>
                {isAddMode && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-card p-5 rounded-xl flex flex-col gap-4">
                            <h3 className="text-sm font-black text-slate-400">새로운 공부/습관 트래커 추가</h3>
                            <div>
                                <label htmlFor="study-title" className="text-xs font-bold text-slate-400 mb-1 block">목표 내용</label>
                                <input id="study-title" type="text" placeholder="예: 매일 알고리즘 1문제 풀기" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-200" />
                            </div>
                            <div>
                                <label htmlFor="study-target" className="text-xs font-bold text-slate-400 mb-1 block">목표 달성 출석일수 (일)</label>
                                <input id="study-target" type="number" min="1" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-200" />
                            </div>
                            <button onClick={handleAdd} className="w-full mt-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-xl shadow-none transition-colors">트래커 생성하기</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {(!studies || studies.length === 0) ? (
                <div className="glass-card rounded-xl p-10 flex flex-col items-center justify-center gap-3">
                    <BookOpen className="w-12 h-12 text-slate-400" aria-hidden="true" />
                    <p className="text-slate-400 font-bold text-sm">등록된 공부 목표가 없습니다.</p>
                    <button onClick={() => setIsAddMode(true)} className="text-indigo-500 text-sm font-bold hover:underline">+ 첫 번째 목표 추가하기</button>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {studies.map((study) => {
                        const todayStr = format(currentDate, 'yyyy-MM-dd');
                        const isCheckedToday = study.logs.includes(todayStr);
                        const progress = Math.min(100, Math.round((study.logs.length / study.totalDays) * 100));
                        const streak = getStreak(study.logs, currentDate);
                        const remaining = Math.max(0, study.totalDays - study.logs.length);
                        const completionRate = study.totalDays > 0 ? Math.round((study.logs.length / study.totalDays) * 100) : 0;

                        return (
                            <motion.div
                                key={study.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card p-0 rounded-xl overflow-hidden relative group"
                            >
                                {/* Top gradient bar */}
                                <div className={`h-1.5 w-full bg-gradient-to-r ${progress >= 100 ? 'from-emerald-400 to-emerald-500' : 'from-indigo-500 to-purple-500'}`} aria-hidden="true" />

                                <div className="p-5 md:p-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-none transition-all ${isCheckedToday ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`} aria-hidden="true">
                                                <BookOpen className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-100 leading-tight">{study.title}</h3>
                                                <p className="text-[12px] font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                                                    <CalIcon className="w-3 h-3" aria-hidden="true" /> 목표 {study.totalDays}일 중 {study.logs.length}일 출석
                                                    {remaining > 0 && <span className="text-text-indigo-400">· 남은 {remaining}일</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setDeleteConfirm({ open: true, id: study.id })}
                                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            aria-label={`${study.title} 삭제`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-[#09090b][0.03] rounded-xl p-3 text-center border border-white/10">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">출석일</p>
                                            <p className="text-xl font-black text-slate-100">{study.logs.length}<span className="text-xs font-bold text-slate-400 ml-0.5">일</span></p>
                                        </div>
                                        <div className={`rounded-xl p-3 text-center border ${streak >= 3 ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' : 'bg-[#09090b][0.03] border-white/10'}`}>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">연속 출석</p>
                                            <p className={`text-xl font-black ${streak >= 3 ? 'text-orange-500 dark:text-orange-400' : 'text-slate-100'}`}>
                                                {streak >= 3 && '🔥'}{streak}<span className="text-xs font-bold text-slate-400 ml-0.5">일</span>
                                            </p>
                                        </div>
                                        <div className="bg-[#09090b][0.03] rounded-xl p-3 text-center border border-white/10">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">달성률</p>
                                            <p className={`text-xl font-black ${completionRate >= 100 ? 'text-emerald-500' : 'text-text-indigo-400'}`}>{completionRate}<span className="text-xs font-bold text-slate-400 ml-0.5">%</span></p>
                                        </div>
                                    </div>

                                    {/* Progress Bar — thicker */}
                                    <div className="mb-5">
                                        <div className="flex justify-between text-xs font-bold mb-1.5">
                                            <span className="text-slate-500">진행률</span>
                                            <span className={`${progress >= 100 ? 'text-emerald-500' : 'text-indigo-500'} text-sm`}>{progress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(progress, 2)}%` }}
                                                transition={{ duration: 1, ease: 'easeOut' }}
                                                className={`h-full rounded-full relative overflow-hidden ${progress >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                                                style={{ minWidth: progress > 0 ? '8px' : '0' }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer" aria-hidden="true" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Main Content: Check-in + Heatmap side by side */}
                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Left: Today's check-in */}
                                        <div className="flex-1 bg-[#09090b] rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(currentDate, 'MMM dd')} 오늘의 출석</span>
                                                <span className={`text-sm font-black mt-1 ${isCheckedToday ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                    {isCheckedToday ? '출석 완료 🎉' : '아직 늦지 않았어요!'}
                                                </span>
                                                {streak >= 7 && <span className="text-[11px] font-bold text-orange-500 mt-1">🔥 {streak}일 연속 출석 중!</span>}

                                                {/* Timer UI */}
                                                <div className="mt-3 bg-[#111113] p-2 rounded-xl flex items-center justify-between shadow-none border border-white/10">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">집중 스톱워치</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-indigo-500 font-mono tracking-wider min-w-[3rem] text-center">
                                                            {timerState.activeId === study.id ? formatTime(timerState.seconds) : '00:00'}
                                                        </span>
                                                        <button
                                                            onClick={() => toggleTimer(study.id)}
                                                            className={`px-3 py-1 rounded-lg text-[10px] font-bold active:scale-95 transition-all ${timerState.activeId === study.id && timerState.isRunning
                                                                    ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                                                    : 'bg-indigo-500 text-white shadow-none'
                                                                }`}
                                                        >
                                                            {timerState.activeId === study.id && timerState.isRunning ? '일시정지' : '▶ 시작'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCheckIn(study)}
                                                className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isCheckedToday ? 'bg-indigo-500/10 text-indigo-500 shadow-none scale-95' : 'bg-slate-900 dark:bg-indigo-600 text-white hover:scale-105 shadow-none'}`}
                                                aria-label={isCheckedToday ? '출석 취소' : '출석 체크'}
                                            >
                                                <CheckCircle2 className="w-6 h-6" />
                                            </button>
                                        </div>

                                        {/* Right: Heatmap Calendar */}
                                        <div className="flex-1 bg-[#09090b] rounded-xl p-4 border border-white/10">
                                            <AttendanceHeatmap logs={study.logs} currentDate={currentDate} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

StudyView.propTypes = {
    studies: PropTypes.array.isRequired,
    setStudies: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
};
