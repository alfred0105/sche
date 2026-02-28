import React, { useState } from 'react';
import { IconMap } from '../components/IconMap';
import { isSameDay, isSameWeek, isSameMonth, parseISO, format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function ScheduleView({ schedules, setSchedules, currentDate }) {
    const { Calendar, CheckCircle2, Circle, ChevronDown, Check, Trash2 } = IconMap;

    const [filterType, setFilterType] = useState('daily'); // daily, weekly, monthly, all
    const [expandedId, setExpandedId] = useState(null);

    // Filter logic for List View
    const filteredSchedules = schedules.filter(s => {
        const sDate = parseISO(s.date);
        if (filterType === 'daily') return isSameDay(sDate, currentDate);
        if (filterType === 'weekly') return isSameWeek(sDate, currentDate);
        if (filterType === 'monthly') return isSameMonth(sDate, currentDate);
        return true;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));


    const completedCount = filteredSchedules.filter(s => s.completed).length;
    const totalCount = filteredSchedules.length;
    const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const toggleSchedule = (e, id) => {
        e.stopPropagation();
        setSchedules(prev => {
            const updated = prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s);
            const isCompletedNow = updated.find(s => s.id === id)?.completed;
            if (isCompletedNow) toast.success('일정 완료!', { icon: '✨' });
            return updated;
        });
    };

    const deleteSchedule = (id) => {
        setSchedules(prev => prev.filter(s => s.id !== id));
        toast('일정이 삭제되었습니다', { icon: '🗑️', style: { border: '1px solid #fee2e2' } });
    };

    return (
        <div className="glass-card p-6 min-h-[600px] mb-8 flex flex-col relative overflow-hidden">
            <header className="mb-6 border-b border-slate-100 dark:border-white/5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <Calendar className="w-7 h-7 text-indigo-500" /> 종합 스케줄러
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
                    {/* List Filters */}
                    <div className="flex gap-2 mb-6">
                        {['daily', 'weekly', 'monthly'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors border ${filterType === type ? 'bg-white dark:bg-[#1a1c23] border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                {type === 'daily' ? '일간' : type === 'weekly' ? '주간' : type === 'monthly' ? '월간' : '전체'}
                            </button>
                        ))}
                        <div className="ml-auto text-sm font-black text-indigo-600 dark:text-indigo-400 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg">{format(currentDate, 'M월 d일')} 기준 일정</div>
                    </div>

                    {/* Completion Rate Summary Widget */}
                    {totalCount > 0 && (
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 sm:p-5 mb-6 text-white shadow-lg shadow-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-semibold text-indigo-100 flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-4 h-4" /> {filterType === 'daily' ? '오늘의' : filterType === 'weekly' ? '이번 주' : filterType === 'monthly' ? '이번 달' : '전체'} 일정 달성률</h3>
                                <p className="text-2xl font-black">
                                    {completionRate}% <span className="text-sm font-medium text-indigo-200 ml-1">({completedCount}/{totalCount}개 완료)</span>
                                </p>
                            </div>
                            <div className="flex-1 w-full max-w-sm">
                                <div className="h-3 md:h-4 w-full bg-indigo-900/30 rounded-full overflow-hidden border border-indigo-400/20">
                                    <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {filteredSchedules.length === 0 ? (
                        <div className="text-center py-24 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#0f1115]/50 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-200 dark:text-white/5" />
                            <p className="font-bold">조건에 맞는 일정이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="relative border-l-[3px] border-slate-100 dark:border-[#1a1c23] ml-4 space-y-6 flex-1 pr-2">
                            {filteredSchedules.map((schedule) => (
                                <div key={schedule.id} className="relative pl-6 flex flex-col group">
                                    <div className="flex items-start justify-between">
                                        {/* Node */}
                                        <div className={`absolute -left-[12px] top-1 rounded-full p-0.5 bg-white dark:bg-[#0f1115] transition-colors duration-300 ${schedule.completed ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                            {schedule.completed ? <CheckCircle2 className="w-[20px] h-[20px] fill-indigo-100 dark:fill-indigo-500/20" /> : <Circle className="w-[20px] h-[20px]" />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 cursor-pointer select-none" onClick={() => setExpandedId(expandedId === schedule.id ? null : schedule.id)}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/5 shadow-sm">{schedule.category}</span>
                                                <p className={`text-base font-bold transition-all ${schedule.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                                    {schedule.title}
                                                </p>
                                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10 px-1.5 rounded bg-white dark:bg-[#1a1c23]">{schedule.date}</span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedId === schedule.id ? 'rotate-180' : ''}`} />
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

                                        <button onClick={(e) => toggleSchedule(e, schedule.id)} className={`ml-4 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm border active:scale-95 ${schedule.completed ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 shadow-indigo-500/20' : 'bg-white dark:bg-[#1a1c23] text-slate-300 dark:text-slate-500 border-slate-200 dark:border-white/20 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400'}`}>
                                            <Check className="w-5 h-5 stroke-[3]" />
                                        </button>
                                    </div>

                                    {/* Expanded Detail */}
                                    <AnimatePresence>
                                        {expandedId === schedule.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200/60 dark:border-white/5 leading-relaxed shadow-inner mt-3 mb-2 relative">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-xl"></div>
                                                    <p className="pl-2">{schedule.memo || '작성된 상세 메모가 없습니다.'}</p>
                                                    <div className="mt-4 flex gap-2 pl-2">
                                                        <button onClick={() => deleteSchedule(schedule.id)} className="text-[11px] font-bold flex items-center gap-1 text-rose-500 dark:text-rose-400 bg-white dark:bg-[#1a1c23] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 shadow-sm transition-all">
                                                            <Trash2 className="w-3.5 h-3.5" /> 삭제하기
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
