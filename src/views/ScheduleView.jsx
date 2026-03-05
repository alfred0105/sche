/**
 * @fileoverview ScheduleView — refactored with accessibility and ConfirmModal.
 */
import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { timeToMinutes } from '../utils/helpers';

export default function ScheduleView({ schedules, setSchedules, currentDate }) {
    const { Calendar, CheckCircle2, Circle, ChevronDown, Check, Trash2 } = IconMap;

    const [filterType, setFilterType] = useState('daily');
    const [expandedId, setExpandedId] = useState(null);
    const [confirmState, setConfirmState] = useState({ open: false, id: null, isGroup: false });

    // Memoized filtered & sorted schedules
    const filteredSchedules = useMemo(() => {
        return schedules.filter((s) => {
            const sDate = parseISO(s.date);
            if (filterType === 'daily') return isSameDay(sDate, currentDate);
            if (filterType === 'weekly') return isSameWeek(sDate, currentDate);
            if (filterType === 'monthly') return isSameMonth(sDate, currentDate);
            return true;
        }).sort((a, b) => {
            const dateCmp = a.date.localeCompare(b.date);
            if (dateCmp !== 0) return dateCmp;
            return timeToMinutes(a.time) - timeToMinutes(b.time);
        });
    }, [schedules, filterType, currentDate]);

    const groupedSchedules = useMemo(() => {
        return filteredSchedules.reduce((acc, schedule) => {
            if (!acc[schedule.date]) acc[schedule.date] = [];
            acc[schedule.date].push(schedule);
            return acc;
        }, {});
    }, [filteredSchedules]);

    const completedCount = useMemo(() => filteredSchedules.filter((s) => s.completed).length, [filteredSchedules]);
    const totalCount = filteredSchedules.length;
    const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const toggleSchedule = useCallback((e, id) => {
        e.stopPropagation();
        setSchedules((prev) => {
            const updated = prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s));
            const isCompletedNow = updated.find((s) => s.id === id)?.completed;
            if (isCompletedNow) toast.success('일정 완료!', { icon: '✨' });
            return updated;
        });
    }, [setSchedules]);

    const handleDeleteRequest = useCallback((id) => {
        const sc = schedules.find((s) => s.id === id);
        if (!sc) return;
        if (sc.groupId) {
            setConfirmState({ open: true, id, isGroup: true });
        } else {
            setConfirmState({ open: true, id, isGroup: false });
        }
    }, [schedules]);

    const handleDeleteConfirm = useCallback(() => {
        const { id, isGroup } = confirmState;
        const sc = schedules.find((s) => s.id === id);
        if (isGroup && sc?.groupId) {
            setSchedules((prev) => prev.filter((s) => s.groupId !== sc.groupId));
            toast('연결된 반복 일정이 모두 삭제되었습니다.', { icon: '🗑️' });
        } else {
            setSchedules((prev) => prev.filter((s) => s.id !== id));
            toast('일정이 삭제되었습니다', { icon: '🗑️' });
        }
        setConfirmState({ open: false, id: null, isGroup: false });
    }, [confirmState, schedules, setSchedules]);

    return (
        <div className="glass-card p-6 min-h-[600px] mb-8 flex flex-col relative overflow-hidden">
            <ConfirmModal
                isOpen={confirmState.open}
                onClose={() => setConfirmState({ open: false, id: null, isGroup: false })}
                onConfirm={handleDeleteConfirm}
                title="일정 삭제"
                message={confirmState.isGroup ? '이 일정은 반복 일정입니다.\n연결된 모든 반복 일정을 함께 삭제합니다.' : '이 일정을 삭제하시겠습니까?'}
                confirmText="삭제"
                variant="danger"
            />

            <header className="mb-6 border-b border-slate-100 dark:border-white/5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <Calendar className="w-7 h-7 text-indigo-500" aria-hidden="true" /> 종합 스케줄러
                </h2>
            </header>

            <AnimatePresence mode="wait">
                <motion.div
                    key="list"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 flex flex-col"
                >
                    <div className="flex gap-2 mb-6" role="tablist" aria-label="기간 필터">
                        {['daily', 'weekly', 'monthly'].map((type) => (
                            <button
                                key={type}
                                role="tab"
                                aria-selected={filterType === type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors border ${filterType === type ? 'bg-white dark:bg-[#1a1c23] border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                {type === 'daily' ? '일간' : type === 'weekly' ? '주간' : '월간'}
                            </button>
                        ))}
                        <div className="ml-auto text-sm font-black text-indigo-600 dark:text-indigo-400 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg" aria-live="polite">
                            {format(currentDate, 'M월 d일')} 기준 일정
                        </div>
                    </div>

                    {totalCount > 0 && (
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 sm:p-5 mb-6 text-white shadow-lg shadow-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4" role="status" aria-label="달성률">
                            <div>
                                <h3 className="text-sm font-semibold text-indigo-100 flex items-center gap-1.5 mb-1">
                                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                    {filterType === 'daily' ? '오늘의' : filterType === 'weekly' ? '이번 주' : '이번 달'} 일정 달성률
                                </h3>
                                <p className="text-2xl font-black">
                                    {completionRate}% <span className="text-sm font-medium text-indigo-200 ml-1">({completedCount}/{totalCount}개 완료)</span>
                                </p>
                            </div>
                            <div className="flex-1 w-full max-w-sm" role="progressbar" aria-valuenow={completionRate} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-4 md:h-5 w-full bg-white/20 rounded-full overflow-hidden border border-white/30 shadow-inner">
                                    <div className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(255,255,255,0.6)]" style={{ width: `${Math.max(completionRate, completionRate > 0 ? 3 : 0)}%`, minWidth: completionRate > 0 ? '12px' : '0' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredSchedules.length === 0 ? (
                        <div className="text-center py-24 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#0f1115]/50 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-200 dark:text-white/5" aria-hidden="true" />
                            <p className="font-bold">조건에 맞는 일정이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 w-full">
                            {Object.entries(groupedSchedules).map(([dateStr, schedulesForDate]) => (
                                <div key={dateStr} className="w-full">
                                    <div className="text-sm font-black text-slate-500 mb-3 bg-slate-50 dark:bg-white/5 inline-block px-3 py-1 rounded-full border border-slate-100 dark:border-white/10">
                                        {format(parseISO(dateStr), 'yyyy. MM. dd')}일 일정
                                    </div>
                                    <div className="relative border-l-[3px] border-slate-100 dark:border-[#1a1c23] ml-4 space-y-6 flex-1 pr-2">
                                        {schedulesForDate.map((schedule) => (
                                            <div key={schedule.id} className="relative pl-6 flex flex-col group">
                                                <div className="flex items-start justify-between">
                                                    <div className={`absolute -left-[12px] top-1 rounded-full p-0.5 bg-white dark:bg-[#0f1115] transition-colors duration-300 ${schedule.completed ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`} aria-hidden="true">
                                                        {schedule.completed ? <CheckCircle2 className="w-[20px] h-[20px] fill-indigo-100 dark:fill-indigo-500/20" /> : <Circle className="w-[20px] h-[20px]" />}
                                                    </div>

                                                    <div className="flex-1 cursor-pointer select-none" onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)} role="button" tabIndex={0} aria-expanded={expandedId === schedule.id} onKeyDown={(e) => e.key === 'Enter' && setExpandedId(expandedId === schedule.id ? null : schedule.id)}>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/5 shadow-sm">{schedule.category}</span>
                                                            <p className={`text-base font-bold transition-all ${schedule.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                                                {schedule.title}
                                                            </p>
                                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedId === schedule.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                            <p className={`text-[13px] font-semibold ${schedule.completed ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-500 dark:text-indigo-400'}`}>
                                                                {schedule.time} {schedule.endTime ? `~ ${schedule.endTime}` : ''}
                                                            </p>
                                                            {schedule.location && (
                                                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                    📍 {schedule.location}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => toggleSchedule(e, schedule.id)}
                                                        className={`ml-4 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm border active:scale-95 ${schedule.completed ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 shadow-indigo-500/20' : 'bg-white dark:bg-[#1a1c23] text-slate-300 dark:text-slate-500 border-slate-200 dark:border-white/20 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400'}`}
                                                        aria-label={schedule.completed ? '일정 완료 취소' : '일정 완료 처리'}
                                                    >
                                                        <Check className="w-5 h-5 stroke-[3]" aria-hidden="true" />
                                                    </button>
                                                </div>

                                                <AnimatePresence>
                                                    {expandedId === schedule.id && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200/60 dark:border-white/5 leading-relaxed shadow-inner mt-3 mb-2 relative">
                                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-xl" aria-hidden="true" />
                                                                <p className="pl-2">{schedule.memo || '작성된 상세 메모가 없습니다.'}</p>
                                                                <div className="mt-4 flex gap-2 pl-2">
                                                                    <button
                                                                        onClick={() => handleDeleteRequest(schedule.id)}
                                                                        className="text-[11px] font-bold flex items-center gap-1 text-rose-500 dark:text-rose-400 bg-white dark:bg-[#1a1c23] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-sm transition-all"
                                                                        aria-label={`${schedule.title} 삭제`}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> 삭제하기
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

ScheduleView.propTypes = {
    schedules: PropTypes.array.isRequired,
    setSchedules: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
};
