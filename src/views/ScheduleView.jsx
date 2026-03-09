/**
 * @fileoverview ScheduleView — refactored with accessibility and ConfirmModal.
 * Added: color labels (#2), monthly calendar view (#8), duration badge (#11)
 * Added: repeat field (#5), week grid view (#7), template save/load (#9),
 *         focus mode (#12), completion heatmap (#14)
 */
import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format, addDays, addWeeks, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, subWeeks } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { timeToMinutes, generateId } from '../utils/helpers';

const COLOR_OPTIONS = [
    { label: '빨강', value: '#ef4444' },
    { label: '파랑', value: '#3b82f6' },
    { label: '초록', value: '#22c55e' },
    { label: '노랑', value: '#eab308' },
    { label: '보라', value: '#a855f7' },
    { label: '분홍', value: '#ec4899' },
];

const REPEAT_OPTIONS = [
    { value: 'none', label: '반복 없음' },
    { value: 'daily', label: '매일' },
    { value: 'weekly', label: '매주' },
    { value: 'monthly', label: '매월' },
];

const TEMPLATES_KEY = 'scheduleTemplates';

function loadTemplates() {
    try {
        return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveTemplate(tpl) {
    const templates = loadTemplates();
    templates.push(tpl);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

function deleteTemplate(id) {
    const templates = loadTemplates().filter(t => t.id !== id);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// Duration badge helper (#11)
function getDurationBadge(time, endTime) {
    if (!time || !endTime) return null;
    const startMins = timeToMinutes(time);
    const endMins = timeToMinutes(endTime);
    if (endMins <= startMins) return null;
    const diff = endMins - startMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
}

export default function ScheduleView({ schedules, setSchedules, currentDate, setCurrentDate }) {
    const { Calendar, CheckCircle2, Circle, ChevronDown, Check, Trash2, Clock, MoveRight, RefreshCw, X } = IconMap;

    const [filterType, setFilterType] = useState('daily');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'timeline' | 'week-grid'
    const [expandedId, setExpandedId] = useState(null);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [confirmState, setConfirmState] = useState({ open: false, id: null, isGroup: false });
    // #5 Edit scope modal for recurring schedules
    const [editScopeModal, setEditScopeModal] = useState({ open: false, form: null });

    // #12 Focus Mode
    const [focusMode, setFocusMode] = useState(false);

    // #9 Template states
    const [templates, setTemplates] = useState(loadTemplates);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

    // Memoized filtered & sorted schedules
    const filteredSchedules = useMemo(() => {
        return schedules.filter((s) => {
            const sDate = parseISO(s.date);
            if (filterType === 'daily') return isSameDay(sDate, currentDate);
            if (filterType === 'weekly') return isSameWeek(sDate, currentDate);
            if (filterType === 'monthly' || filterType === 'monthly-cal') return isSameMonth(sDate, currentDate);
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

    // Monthly calendar data (#8)
    const monthCalData = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const startPad = getDay(monthStart);
        const schedulesByDate = {};
        schedules.filter(s => isSameMonth(parseISO(s.date), currentDate)).forEach(s => {
            if (!schedulesByDate[s.date]) schedulesByDate[s.date] = [];
            schedulesByDate[s.date].push(s);
        });
        return { days, startPad, schedulesByDate };
    }, [schedules, currentDate]);

    // #7 Week grid data
    const weekGridData = useMemo(() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Mon
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const schedulesByDate = {};
        days.forEach(d => {
            const ds = format(d, 'yyyy-MM-dd');
            schedulesByDate[ds] = schedules
                .filter(s => s.date === ds)
                .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        });
        return { days, schedulesByDate };
    }, [schedules, currentDate]);

    // #14 Heatmap data — last 10 weeks
    const heatmapData = useMemo(() => {
        const today = new Date();
        const weeks = [];
        for (let w = 9; w >= 0; w--) {
            const weekStart = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 });
            const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
            weeks.push(days.map(day => {
                const ds = format(day, 'yyyy-MM-dd');
                const daySchedules = schedules.filter(s => s.date === ds);
                const total = daySchedules.length;
                const completed = daySchedules.filter(s => s.completed).length;
                const rate = total === 0 ? null : completed / total;
                return { date: ds, rate, total, completed, day };
            }));
        }
        return weeks;
    }, [schedules]);

    // #12 Focus Mode — find current/nearest upcoming schedule
    const focusSchedule = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todaySchedules = schedules
            .filter(s => s.date === todayStr && !s.completed)
            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        return todaySchedules[0] || null;
    }, [schedules]);

    // #5 Toggle with recurring next occurrence
    const toggleSchedule = useCallback((e, id) => {
        e.stopPropagation();
        setSchedules((prev) => {
            const schedule = prev.find(s => s.id === id);
            if (!schedule) return prev;
            const isCompletingNow = !schedule.completed;
            const updated = prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s));

            // #5: create next occurrence for recurring schedules
            if (isCompletingNow && schedule.repeat && schedule.repeat !== 'none') {
                const currentDt = parseISO(schedule.date);
                let nextDt;
                if (schedule.repeat === 'daily') nextDt = addDays(currentDt, 1);
                else if (schedule.repeat === 'weekly') nextDt = addWeeks(currentDt, 1);
                else if (schedule.repeat === 'monthly') nextDt = addMonths(currentDt, 1);

                if (nextDt) {
                    const nextDateStr = format(nextDt, 'yyyy-MM-dd');
                    const nextOccurrence = {
                        ...schedule,
                        id: generateId(),
                        date: nextDateStr,
                        completed: false,
                    };
                    toast.success(`반복 일정이 ${nextDateStr}에 생성되었습니다.`, { icon: '🔄' });
                    return [...updated, nextOccurrence];
                }
            }

            if (isCompletingNow) toast.success('일정 완료!', { icon: '✨' });
            return updated;
        });
    }, [setSchedules]);

    const postponeToTomorrow = useCallback((e, id) => {
        e.stopPropagation();
        setSchedules(prev => prev.map(s => {
            if (s.id === id) {
                const nextDate = format(addDays(parseISO(s.date), 1), 'yyyy-MM-dd');
                return { ...s, date: nextDate };
            }
            return s;
        }));
        toast.success('일정이 내일로 미뤄졌습니다.', { icon: '➡️' });
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

    // #5 Edit scope handlers
    const handleEditSaveRequest = useCallback((e) => {
        e.stopPropagation();
        if (!editForm.title.trim()) return toast.error('일정 제목을 입력해주세요.');
        const original = schedules.find(s => s.id === editId);
        if (original?.groupId) {
            // Recurring schedule — ask scope
            setEditScopeModal({ open: true, form: editForm });
        } else {
            // Single schedule — save directly
            setSchedules(prev => prev.map(s => s.id === editId ? editForm : s));
            setEditId(null);
            toast.success('일정이 수정되었습니다.', { icon: '✏️' });
        }
    }, [editForm, editId, schedules, setSchedules]);

    const handleEditScopeConfirm = useCallback((scope) => {
        const { form } = editScopeModal;
        if (scope === 'this') {
            // Detach from group and update only this occurrence
            setSchedules(prev => prev.map(s =>
                s.id === form.id ? { ...form, groupId: undefined } : s
            ));
            toast.success('이 일정만 수정되었습니다.', { icon: '✏️' });
        } else {
            // Update all occurrences in the same group
            setSchedules(prev => prev.map(s =>
                s.groupId === form.groupId
                    ? { ...s, title: form.title, time: form.time, endTime: form.endTime, color: form.color, memo: form.memo, location: form.location, repeat: form.repeat }
                    : s
            ));
            toast.success('모든 반복 일정이 수정되었습니다.', { icon: '🔄' });
        }
        setEditScopeModal({ open: false, form: null });
        setEditId(null);
    }, [editScopeModal, setSchedules]);

    // #9 Save template handler
    const handleSaveTemplate = useCallback((schedule) => {
        const tpl = {
            id: generateId(),
            title: schedule.title,
            time: schedule.time,
            endTime: schedule.endTime || '',
            category: schedule.category,
            color: schedule.color || '',
        };
        saveTemplate(tpl);
        setTemplates(loadTemplates());
        toast.success(`"${schedule.title}" 템플릿으로 저장되었습니다.`, { icon: '📋' });
        setTemplateFromId(null);
    }, []);

    const handleDeleteTemplate = useCallback((id) => {
        deleteTemplate(id);
        setTemplates(loadTemplates());
    }, []);

    // #9 Add from template
    const handleAddFromTemplate = useCallback((tpl) => {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const newSchedule = {
            id: generateId(),
            title: tpl.title,
            time: tpl.time || '09:00 AM',
            endTime: tpl.endTime || '',
            category: tpl.category || '기타',
            color: tpl.color || '',
            date: dateStr,
            completed: false,
            repeat: 'none',
        };
        setSchedules(prev => [...prev, newSchedule]);
        toast.success(`"${tpl.title}" 일정이 추가되었습니다.`, { icon: '📋' });
        setShowTemplateDropdown(false);
    }, [currentDate, setSchedules]);

    return (
        <div className="glass-card p-4 md:p-5 min-h-[600px] mb-8 flex flex-col relative overflow-hidden">
            <ConfirmModal
                isOpen={confirmState.open}
                onClose={() => setConfirmState({ open: false, id: null, isGroup: false })}
                onConfirm={handleDeleteConfirm}
                title="일정 삭제"
                message={confirmState.isGroup ? '이 일정은 반복 일정입니다.\n연결된 모든 반복 일정을 함께 삭제합니다.' : '이 일정을 삭제하시겠습니까?'}
                confirmText="삭제"
                variant="danger"
            />

            {/* #5 Edit scope modal for recurring schedules */}
            {editScopeModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="반복 일정 수정 범위 선택">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditScopeModal({ open: false, form: null })} />
                    <div className="relative bg-[#111113] border border-white/10 rounded-2xl p-5 w-full max-w-xs shadow-2xl">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">🔄</span>
                            <h3 className="text-sm font-bold text-slate-100">반복 일정 수정</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">어느 범위까지 수정할까요?</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleEditScopeConfirm('this')}
                                className="w-full px-4 py-2.5 text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/20 transition-all text-left"
                            >
                                ✏️ 이 일정만 수정
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">이 날짜의 일정만 변경됩니다</span>
                            </button>
                            <button
                                onClick={() => handleEditScopeConfirm('all')}
                                className="w-full px-4 py-2.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-all text-left"
                            >
                                🔄 모든 반복 일정 수정
                                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">같은 그룹의 모든 일정에 적용됩니다</span>
                            </button>
                            <button
                                onClick={() => setEditScopeModal({ open: false, form: null })}
                                className="w-full px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="mb-6 border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 text-slate-400">
                    <Calendar className="w-7 h-7 text-indigo-500" aria-hidden="true" /> 종합 스케줄러
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* #12 Focus Mode button */}
                    <button
                        onClick={() => setFocusMode(f => !f)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${focusMode ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-[#111113] border-white/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50'}`}
                        aria-pressed={focusMode}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 집중 모드
                    </button>

                    {/* #9 Template button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplateDropdown(d => !d)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-[#111113] border-white/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all flex items-center gap-1.5"
                        >
                            📋 템플릿 불러오기
                        </button>
                        {showTemplateDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-64 bg-[#111113] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">저장된 템플릿</span>
                                    <button onClick={() => setShowTemplateDropdown(false)} className="text-slate-500 hover:text-slate-300">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {templates.length === 0 ? (
                                    <p className="text-xs text-slate-500 p-4 text-center">저장된 템플릿이 없습니다.<br />일정 카드에서 "템플릿으로 저장"을 클릭하세요.</p>
                                ) : (
                                    <div className="max-h-64 overflow-y-auto">
                                        {templates.map(tpl => (
                                            <div key={tpl.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 group">
                                                {tpl.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-300 truncate">{tpl.title}</p>
                                                    <p className="text-[10px] text-slate-500">{tpl.time} {tpl.endTime ? `~ ${tpl.endTime}` : ''} · {tpl.category}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleAddFromTemplate(tpl)}
                                                    className="text-[10px] font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 px-2 py-1 rounded-md transition-all shrink-0"
                                                >
                                                    추가
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                    className="text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* #12 Focus Mode overlay */}
            <AnimatePresence>
                {focusMode && (
                    <motion.div
                        key="focus-overlay"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col items-center justify-center py-12"
                    >
                        {focusSchedule ? (
                            <div className="w-full max-w-lg bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-8 text-center shadow-xl">
                                <p className="text-xs font-bold text-indigo-400 mb-3 tracking-widest uppercase">현재 집중 중</p>
                                <h3 className="text-2xl md:text-3xl font-bold text-slate-100 mb-3">{focusSchedule.title}</h3>
                                <p className="text-lg font-bold text-indigo-400 mb-6">{focusSchedule.time} {focusSchedule.endTime ? `~ ${focusSchedule.endTime}` : ''}</p>
                                {focusSchedule.location && (
                                    <p className="text-sm text-slate-500 mb-4">📍 {focusSchedule.location}</p>
                                )}
                                <button
                                    onClick={(e) => { toggleSchedule(e, focusSchedule.id); setFocusMode(false); }}
                                    className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-base transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
                                >
                                    ✅ 완료
                                </button>
                            </div>
                        ) : (
                            <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-300 mb-2">오늘 할 일정이 없습니다!</h3>
                                <p className="text-sm text-slate-500">모든 일정을 완료했거나 오늘 일정이 없어요.</p>
                            </div>
                        )}
                        <button
                            onClick={() => setFocusMode(false)}
                            className="mt-6 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
                        >
                            <X className="w-4 h-4" /> 집중 모드 종료
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {!focusMode && (
                <AnimatePresence mode="wait">
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex-1 flex flex-col"
                    >
                        <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="기간 필터">
                            {['daily', 'weekly', 'monthly', 'monthly-cal'].map((type) => (
                                <button
                                    key={type}
                                    role="tab"
                                    aria-selected={filterType === type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors border ${filterType === type ? 'bg-[#111113] border-white/10 text-indigo-400 shadow-none' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                >
                                    {type === 'daily' ? '일간' : type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : '월간 캘린더'}
                                </button>
                            ))}
                            {filterType === 'daily' && (
                                <div className="ml-2 flex bg-white/5 p-1 rounded-lg border border-white/10">
                                    <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-[#111113]-700 shadow-none text-indigo-500' : 'text-slate-400 hover:text-slate-600'}`}>리스트</button>
                                    <button onClick={() => setViewMode('timeline')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewMode === 'timeline' ? 'bg-[#111113]-700 shadow-none text-indigo-500 flex items-center gap-1' : 'text-slate-400 hover:text-slate-600 flex items-center gap-1'}`}>
                                        타임블록
                                    </button>
                                    {/* #7 Week grid button shown on daily filter */}
                                    <button onClick={() => { setViewMode('week-grid'); setFilterType('weekly'); }} className="px-3 py-1.5 text-[11px] font-bold rounded-md transition-all text-slate-400 hover:text-slate-600">
                                        주간 그리드
                                    </button>
                                </div>
                            )}
                            {filterType === 'weekly' && (
                                <div className="ml-2 flex bg-white/5 p-1 rounded-lg border border-white/10">
                                    <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewMode !== 'week-grid' ? 'text-indigo-500' : 'text-slate-400'}`}>리스트</button>
                                    <button onClick={() => setViewMode('week-grid')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewMode === 'week-grid' ? 'text-indigo-500' : 'text-slate-400'}`}>주간 그리드</button>
                                </div>
                            )}
                            <div className="ml-auto text-sm font-bold tracking-tight text-indigo-400 px-3 py-1.5 bg-indigo-500/10 rounded-lg" aria-live="polite">
                                {format(currentDate, 'M월 d일')} 기준 일정
                            </div>
                        </div>

                        {/* #8 Monthly Calendar View */}
                        {filterType === 'monthly-cal' ? (
                            <div className="flex flex-col gap-4">
                                <div className="text-sm font-bold text-slate-400 mb-2">{format(currentDate, 'yyyy년 M월')} 캘린더</div>
                                <div className="grid grid-cols-7 gap-1">
                                    {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                        <div key={d} className="text-[10px] font-bold text-slate-500 text-center py-1">{d}</div>
                                    ))}
                                    {Array.from({ length: monthCalData.startPad }).map((_, i) => (
                                        <div key={`pad-${i}`} />
                                    ))}
                                    {monthCalData.days.map(day => {
                                        const ds = format(day, 'yyyy-MM-dd');
                                        const daySchedules = monthCalData.schedulesByDate[ds] || [];
                                        const isToday = ds === format(new Date(), 'yyyy-MM-dd');
                                        const isSelected = ds === format(currentDate, 'yyyy-MM-dd');
                                        return (
                                            <button
                                                key={ds}
                                                onClick={() => {
                                                    if (setCurrentDate) setCurrentDate(day);
                                                    setFilterType('daily');
                                                }}
                                                className={`min-h-[52px] p-1.5 rounded-xl border text-left transition-all hover:border-indigo-500/50 ${isSelected ? 'bg-indigo-500/20 border-indigo-500/50' : isToday ? 'bg-white/5 border-indigo-400/30' : 'bg-white/[0.02] border-white/5'}`}
                                            >
                                                <span className={`text-[11px] font-bold block mb-1 ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {daySchedules.length > 0 && (
                                                    <div className="flex flex-col gap-0.5">
                                                        {daySchedules.slice(0, 2).map(s => (
                                                            <div key={s.id} className="flex items-center gap-1">
                                                                {s.color && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                                                                <span className="text-[9px] font-bold text-slate-500 truncate leading-tight">{s.title}</span>
                                                            </div>
                                                        ))}
                                                        {daySchedules.length > 2 && (
                                                            <span className="text-[9px] font-bold text-indigo-400">+{daySchedules.length - 2}개</span>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : viewMode === 'week-grid' && filterType === 'weekly' ? (
                            /* #7 Week Grid View */
                            <div className="flex flex-col gap-3">
                                <p className="text-sm font-bold text-slate-400">{format(weekGridData.days[0], 'M/d')} ~ {format(weekGridData.days[6], 'M/d')} 주간 일정</p>
                                <div className="grid grid-cols-7 gap-2">
                                    {weekGridData.days.map(day => {
                                        const ds = format(day, 'yyyy-MM-dd');
                                        const daySchedules = weekGridData.schedulesByDate[ds] || [];
                                        const isToday = ds === format(new Date(), 'yyyy-MM-dd');
                                        const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
                                        const dayIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
                                        return (
                                            <div key={ds} className={`flex flex-col gap-1.5 min-h-[120px] p-2 rounded-xl border ${isToday ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                                                <div className="text-center mb-1">
                                                    <p className={`text-[10px] font-bold ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>{dayNames[dayIdx]}</p>
                                                    <p className={`text-sm font-bold ${isToday ? 'text-indigo-300' : 'text-slate-400'}`}>{day.getDate()}</p>
                                                </div>
                                                {daySchedules.map(schedule => (
                                                    <button
                                                        key={schedule.id}
                                                        onClick={(e) => toggleSchedule(e, schedule.id)}
                                                        className={`w-full text-left px-1.5 py-1 rounded-lg text-[9px] font-bold transition-all border ${schedule.completed ? 'opacity-50 line-through bg-white/5 border-white/5 text-slate-500' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20'}`}
                                                        style={schedule.color ? { borderLeftColor: schedule.color, borderLeftWidth: '2px' } : {}}
                                                        title={`${schedule.title} — ${schedule.time}${schedule.endTime ? ` ~ ${schedule.endTime}` : ''}`}
                                                    >
                                                        <span className="block truncate">{schedule.title}</span>
                                                        <span className="block text-slate-500 mt-0.5">{schedule.time}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <>
                                {totalCount > 0 && (
                                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-4 sm:p-5 mb-6 text-white shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4" role="status" aria-label="달성률">
                                        <div>
                                            <h3 className="text-sm font-semibold text-indigo-100 flex items-center gap-1.5 mb-1">
                                                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                                {filterType === 'daily' ? '오늘의' : filterType === 'weekly' ? '이번 주' : '이번 달'} 일정 달성률
                                            </h3>
                                            <p className="text-xl md:text-2xl font-bold tracking-tight">
                                                {completionRate}% <span className="text-sm font-medium text-indigo-200 ml-1">({completedCount}/{totalCount}개 완료)</span>
                                            </p>
                                        </div>
                                        <div className="flex-1 w-full max-w-sm" role="progressbar" aria-valuenow={completionRate} aria-valuemin={0} aria-valuemax={100}>
                                            <div className="h-4 md:h-5 w-full bg-white/20 rounded-full overflow-hidden border border-white/30 shadow-none">
                                                <div className="h-full bg-white rounded-full transition-all duration-1000 shadow-none" style={{ width: `${Math.max(completionRate, completionRate > 0 ? 3 : 0)}%`, minWidth: completionRate > 0 ? '12px' : '0' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {filteredSchedules.length === 0 ? (
                                    <div className="text-center py-24 text-slate-400 bg-slate-50/50 dark:bg-[#0f1115]/50 rounded-xl border border-white/10 shadow-none">
                                        <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-200 dark:text-white/5" aria-hidden="true" />
                                        <p className="font-bold">조건에 맞는 일정이 없습니다.</p>
                                    </div>
                                ) : viewMode === 'timeline' && filterType === 'daily' ? (
                                    <div className="relative border-l border-slate-200 dark:border-[#333] ml-[60px] pb-10" style={{ height: '1440px' }}>
                                        {Array.from({ length: 24 }).map((_, i) => (
                                            <div key={i} className="absolute w-full border-t border-white/10" style={{ top: `${i * 60}px` }}>
                                                <span className="absolute -left-[50px] -top-3 text-xs font-bold text-slate-400 w-10 text-right pr-2">
                                                    {i.toString().padStart(2, '0')}:00
                                                </span>
                                            </div>
                                        ))}
                                        {filteredSchedules.map((schedule) => {
                                            const startMins = timeToMinutes(schedule.time);
                                            let endMins = schedule.endTime ? timeToMinutes(schedule.endTime) : startMins + 60;
                                            if (endMins <= startMins) endMins = startMins + 60;
                                            const durationMins = endMins - startMins;
                                            const isShort = durationMins < 45;

                                            return (
                                                <div
                                                    key={schedule.id}
                                                    className={`absolute left-2 right-4 rounded-xl p-2 md:p-3 overflow-hidden border shadow-none transition-all hover:scale-[1.01] hover:shadow-none hover:z-10 bg-indigo-50/90 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 ${schedule.completed ? 'opacity-60 grayscale' : ''}`}
                                                    style={{ top: `${startMins}px`, height: `${durationMins}px`, borderLeftColor: schedule.color || undefined, borderLeftWidth: schedule.color ? '3px' : undefined }}
                                                >
                                                    <div className={`flex ${isShort ? 'flex-row items-center gap-2' : 'flex-col'} w-full h-full`}>
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-sm text-indigo-400 truncate flex items-center gap-2">
                                                                {schedule.completed && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                                                                {/* #5 Repeat icon */}
                                                                {schedule.repeat && schedule.repeat !== 'none' && <RefreshCw className="w-3 h-3 text-indigo-300 shrink-0" />}
                                                                {schedule.title}
                                                            </p>
                                                            {!isShort && (
                                                                <div className="flex gap-1 z-20">
                                                                    <button aria-label="내일로 미루기" onClick={(e) => postponeToTomorrow(e, schedule.id)} className="p-1 w-6 h-6 flex items-center justify-center bg-white/20 rounded-md text-indigo-400 hover:text-white hover:bg-indigo-500 transition-colors">
                                                                        <MoveRight className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={(e) => toggleSchedule(e, schedule.id)} className="p-1 w-6 h-6 flex items-center justify-center bg-white/20 rounded-md text-indigo-400 hover:text-white hover:bg-emerald-500 transition-colors">
                                                                        <Check className="w-4 h-4 stroke-[3]" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className={`text-[10px] font-bold text-indigo-400 truncate ${isShort ? 'mt-0' : 'mt-1'}`}>
                                                            {schedule.time} ~ {schedule.endTime || ''} {schedule.location && `· 📍${schedule.location}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4 md:p-5 w-full">
                                        {Object.entries(groupedSchedules).map(([dateStr, schedulesForDate]) => (
                                            <div key={dateStr} className="w-full">
                                                <div className="text-sm font-bold tracking-tight text-slate-500 mb-3 bg-[#09090b] inline-block px-3 py-1 rounded-full border border-white/10">
                                                    {format(parseISO(dateStr), 'yyyy. MM. dd')}일 일정
                                                </div>
                                                <div className="relative border-l-[3px] border-slate-100 dark:border-[#1a1c23] ml-4 space-y-6 flex-1 pr-2">
                                                    {schedulesForDate.map((schedule) => {
                                                        const durationBadge = getDurationBadge(schedule.time, schedule.endTime);
                                                        return (
                                                            <div key={schedule.id} className="relative pl-6 flex flex-col group">
                                                                <div className="flex items-start justify-between">
                                                                    <div className={`absolute -left-[12px] top-1 rounded-full p-0.5 bg-[#111113] transition-colors duration-300 ${schedule.completed ? 'text-indigo-400' : 'text-slate-400'}`} aria-hidden="true">
                                                                        {schedule.color ? (
                                                                            <div className="w-[20px] h-[20px] rounded-full flex items-center justify-center" style={{ backgroundColor: schedule.color + '33', border: `2px solid ${schedule.color}` }}>
                                                                                {schedule.completed && <Check className="w-3 h-3" style={{ color: schedule.color }} />}
                                                                            </div>
                                                                        ) : (
                                                                            schedule.completed ? <CheckCircle2 className="w-[20px] h-[20px] fill-indigo-100 dark:fill-indigo-500/20" /> : <Circle className="w-[20px] h-[20px]" />
                                                                        )}
                                                                    </div>

                                                                    <div className="flex-1 cursor-pointer select-none" onClick={() => {
                                                                        const isExpanding = expandedId !== schedule.id;
                                                                        setExpandedId(isExpanding ? schedule.id : null);
                                                                        if (!isExpanding) setEditId(null);
                                                                    }} role="button" tabIndex={0} aria-expanded={expandedId === schedule.id} onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const isExpanding = expandedId !== schedule.id;
                                                                            setExpandedId(isExpanding ? schedule.id : null);
                                                                            if (!isExpanding) setEditId(null);
                                                                        }
                                                                    }}>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md text-slate-400 border border-slate-200/50 dark:border-white/5 shadow-none">{schedule.category}</span>
                                                                            {schedule.color && (
                                                                                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: schedule.color }} aria-label="색상 라벨" />
                                                                            )}
                                                                            {/* #5 Repeat badge */}
                                                                            {schedule.repeat && schedule.repeat !== 'none' && (
                                                                                <span className="text-[10px] font-bold flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                                                                                    <RefreshCw className="w-3 h-3" />
                                                                                    {schedule.repeat === 'daily' ? '매일' : schedule.repeat === 'weekly' ? '매주' : '매월'}
                                                                                </span>
                                                                            )}
                                                                            {schedule.priority && (
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-none ${schedule.priority === 'High' ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400' :
                                                                                    schedule.priority === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' :
                                                                                        'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-500/10 dark:border-slate-500/30 dark:text-slate-400'
                                                                                    }`}>
                                                                                    {schedule.priority === 'High' ? '🔥 높음' : schedule.priority === 'Medium' ? '보통' : '낮음'}
                                                                                </span>
                                                                            )}
                                                                            <p className={`text-base font-bold transition-all ${schedule.completed ? 'text-slate-400 line-through' : 'text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                                                                {schedule.title}
                                                                            </p>
                                                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedId === schedule.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                            <p className={`text-[13px] font-semibold ${schedule.completed ? 'text-slate-400' : 'text-indigo-400'}`}>
                                                                                {schedule.time} {schedule.endTime ? `~ ${schedule.endTime}` : ''}
                                                                            </p>
                                                                            {durationBadge && (
                                                                                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/5">
                                                                                    <Clock className="w-3 h-3" /> {durationBadge}
                                                                                </span>
                                                                            )}
                                                                            {schedule.location && (
                                                                                <span className="text-[11px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                    📍 {schedule.location}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col gap-1 ml-4 justify-center items-center h-full shrink-0 relative z-20">
                                                                        <button
                                                                            onClick={(e) => toggleSchedule(e, schedule.id)}
                                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-none border active:scale-95 ${schedule.completed ? 'bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-500/30 ' : 'bg-[#111113] text-slate-400 border-white/10 hover:border-emerald-300 hover:text-emerald-500 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400'}`}
                                                                            aria-label={schedule.completed ? '일정 완료 취소' : '일정 완료 처리'}
                                                                        >
                                                                            <Check className="w-5 h-5 stroke-[3]" aria-hidden="true" />
                                                                        </button>

                                                                        {!schedule.completed && filterType === 'daily' && (
                                                                            <button
                                                                                onClick={(e) => postponeToTomorrow(e, schedule.id)}
                                                                                className="w-10 h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] bg-[#111113] text-slate-400 border border-white/10 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors active:scale-95 group/postpone"
                                                                                aria-label="내일로 미루기"
                                                                                title="내일로 연기"
                                                                            >
                                                                                <MoveRight className="w-3.5 h-3.5 group-hover/postpone:translate-x-0.5 transition-transform" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <AnimatePresence>
                                                                    {expandedId === schedule.id && (
                                                                        <motion.div
                                                                            initial={{ height: 0, opacity: 0 }}
                                                                            animate={{ height: 'auto', opacity: 1 }}
                                                                            exit={{ height: 0, opacity: 0 }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            {editId === schedule.id && editForm ? (
                                                                                <div className="bg-[#09090b] p-4 rounded-xl border border-indigo-500/30 mt-3 relative">
                                                                                    <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 mb-2 focus:border-indigo-500 outline-none" placeholder="일정 제목" />
                                                                                    <div className="flex gap-2 mb-2">
                                                                                        <input type="time" value={editForm.time} onChange={e => setEditForm({ ...editForm, time: e.target.value })} className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none w-full" />
                                                                                        <input type="time" value={editForm.endTime || ''} onChange={e => setEditForm({ ...editForm, endTime: e.target.value })} className="bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none w-full" />
                                                                                    </div>
                                                                                    <input value={editForm.location || ''} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="w-full bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 mb-2 focus:border-indigo-500 outline-none" placeholder="장소 (선택)" />
                                                                                    <textarea value={editForm.memo || ''} onChange={e => setEditForm({ ...editForm, memo: e.target.value })} className="w-full bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 mb-2 focus:border-indigo-500 outline-none resize-none" placeholder="상세 메모" rows={2} />
                                                                                    {/* #2 Color picker in edit form */}
                                                                                    <div className="mb-2">
                                                                                        <p className="text-[10px] font-bold text-slate-500 mb-1.5">색상 라벨</p>
                                                                                        <div className="flex gap-2 flex-wrap">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => setEditForm({ ...editForm, color: undefined })}
                                                                                                className={`w-6 h-6 rounded-full border-2 bg-white/10 transition-all ${!editForm.color ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-[#09090b]' : 'border-white/20'}`}
                                                                                                aria-label="색상 없음"
                                                                                                title="없음"
                                                                                            />
                                                                                            {COLOR_OPTIONS.map(c => (
                                                                                                <button
                                                                                                    key={c.value}
                                                                                                    type="button"
                                                                                                    onClick={() => setEditForm({ ...editForm, color: c.value })}
                                                                                                    className={`w-6 h-6 rounded-full border-2 transition-all ${editForm.color === c.value ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-[#09090b] scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                                                                    style={{ backgroundColor: c.value }}
                                                                                                    aria-label={c.label}
                                                                                                    title={c.label}
                                                                                                />
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                    {/* #5 Repeat field in edit form */}
                                                                                    <div className="mb-2">
                                                                                        <p className="text-[10px] font-bold text-slate-500 mb-1.5">반복</p>
                                                                                        <select
                                                                                            value={editForm.repeat || 'none'}
                                                                                            onChange={e => setEditForm({ ...editForm, repeat: e.target.value })}
                                                                                            className="w-full bg-[#111113] border border-white/10 px-3 py-2 rounded-lg text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none"
                                                                                        >
                                                                                            {REPEAT_OPTIONS.map(o => (
                                                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </div>
                                                                                    <div className="flex justify-end gap-2 mt-2">
                                                                                        <button onClick={(e) => { e.stopPropagation(); setEditId(null); }} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 bg-[#111113] border border-white/10 rounded-lg hover:bg-white/10 transition-colors">취소</button>
                                                                                        <button onClick={handleEditSaveRequest} className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-500 rounded-lg shadow-none hover:bg-indigo-600 transition-colors">저장 완료</button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-sm text-slate-400 bg-[#09090b] p-4 rounded-xl border border-slate-200/60 dark:border-white/5 leading-relaxed shadow-none mt-3 mb-2 relative">
                                                                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: schedule.color ? `linear-gradient(to bottom, ${schedule.color}, ${schedule.color}88)` : 'linear-gradient(to bottom, #6366f1, #818cf8)' }} aria-hidden="true" />
                                                                                    <p className="pl-2">{schedule.memo || '작성된 상세 메모가 없습니다.'}</p>
                                                                                    <div className="mt-4 flex gap-2 pl-2 relative z-10 flex-wrap">
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); setEditForm({ ...schedule }); setEditId(schedule.id); }}
                                                                                            className="text-[11px] font-bold flex items-center gap-1 text-slate-400 bg-[#111113] px-3 py-1.5 rounded-lg border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 shadow-none transition-all"
                                                                                        >
                                                                                            ✏️ 수정하기
                                                                                        </button>
                                                                                        {/* #9 Save as template button */}
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleSaveTemplate(schedule); }}
                                                                                            className="text-[11px] font-bold flex items-center gap-1 text-slate-400 bg-[#111113] px-3 py-1.5 rounded-lg border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 shadow-none transition-all"
                                                                                        >
                                                                                            📋 템플릿으로 저장
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(schedule.id); }}
                                                                                            className="text-[11px] font-bold flex items-center gap-1 text-rose-500 dark:text-rose-400 bg-[#111113] px-3 py-1.5 rounded-lg border border-white/10 hover:border-rose-200 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-none transition-all"
                                                                                            aria-label={`${schedule.title} 삭제`}
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> 삭제하기
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* #14 Completion Heatmap */}
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-indigo-400" /> 일정 완료율 히트맵 (최근 10주)
                            </h3>
                            <div className="overflow-x-auto">
                                <div className="flex gap-1 min-w-max">
                                    {heatmapData.map((week, wi) => (
                                        <div key={wi} className="flex flex-col gap-1">
                                            {week.map((cell) => {
                                                const isToday = cell.date === format(new Date(), 'yyyy-MM-dd');
                                                let bg = 'bg-white/5';
                                                if (cell.rate !== null) {
                                                    if (cell.rate === 0) bg = 'bg-rose-500/30';
                                                    else if (cell.rate < 0.5) bg = 'bg-indigo-500/30';
                                                    else if (cell.rate < 1) bg = 'bg-indigo-500/60';
                                                    else bg = 'bg-indigo-500';
                                                }
                                                return (
                                                    <div
                                                        key={cell.date}
                                                        title={`${cell.date}${cell.total > 0 ? ` — ${cell.completed}/${cell.total} 완료` : ' — 일정 없음'}`}
                                                        className={`w-4 h-4 rounded-sm ${bg} ${isToday ? 'ring-1 ring-white/50' : ''} cursor-default transition-all hover:scale-110`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <span className="text-[10px] text-slate-600 font-bold">적음</span>
                                    {['bg-white/5', 'bg-indigo-500/30', 'bg-indigo-500/60', 'bg-indigo-500'].map(c => (
                                        <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
                                    ))}
                                    <span className="text-[10px] text-slate-600 font-bold">많음</span>
                                    <div className="w-3 h-3 rounded-sm bg-rose-500/30 ml-2" />
                                    <span className="text-[10px] text-slate-600 font-bold">0% 완료</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}

ScheduleView.propTypes = {
    schedules: PropTypes.array.isRequired,
    setSchedules: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    setCurrentDate: PropTypes.func,
};
