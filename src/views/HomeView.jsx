import React from 'react';
import { IconMap } from '../components/IconMap';

export default function HomeView({ schedules, transactions, setCurrentTab, currentDate, goals }) {
    const { Calendar, ArrowRight, TrendingDown, Target, CheckCircle2, Circle } = IconMap;

    // filtering for today
    const filterDateStr = currentDate.toISOString().split('T')[0];
    const todaySchedules = schedules.filter(s => s.date === filterDateStr).sort((a, b) => a.time.localeCompare(b.time));
    const todayTransactions = transactions.filter(t => t.date === filterDateStr);
    const todayExpense = todayTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const todayIncome = todayTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);

    const completedSchedules = todaySchedules.filter(s => s.completed).length;
    const totalSchedules = todaySchedules.length;
    const completionRate = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

    // Goal calculation (find the first goal or use fallback)
    const mainGoal = goals && goals.length > 0 ? goals[0] : null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 fade-in pb-8">
            {/* Schedule Widget */}
            <div className="md:col-span-12 lg:col-span-5 glass-card bg-white dark:bg-[#1a1c23] border border-slate-100 dark:border-white/5 rounded-[1.5rem] p-6 flex flex-col hover:-translate-y-1 transition-transform min-h-[220px]">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <Calendar className="w-5 h-5 text-indigo-500" /> 오늘의 일정
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg">
                            <span className="text-xs font-bold text-indigo-500">{completedSchedules}/{totalSchedules} 완료</span>
                            <div className="w-16 h-1.5 bg-indigo-200 dark:bg-indigo-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                            </div>
                        </div>
                        <button onClick={() => setCurrentTab('schedule')} className="text-[13px] font-bold text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center transition-colors">
                            더 보기 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                    </div>
                </div>
                <div className="space-y-3 flex-1 flex flex-col">
                    {todaySchedules.length > 0 ? (
                        <>
                            {todaySchedules.slice(0, 3).map((schedule) => (
                                <div key={schedule.id} className="flex items-start justify-between bg-white dark:bg-[#1a1c23] p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            {schedule.completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 mb-1 inline-block w-fit">
                                                {schedule.category}
                                            </span>
                                            <p className={`text-sm font-bold truncate max-w-[150px] md:max-w-[200px] ${schedule.completed ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {schedule.title}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end text-right">
                                        <p className="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 mt-1">{schedule.time}</p>
                                        {schedule.endTime && <p className="text-[10px] font-semibold text-slate-400">~ {schedule.endTime}</p>}
                                    </div>
                                </div>
                            ))}
                            {todaySchedules.length > 3 && (
                                <div className="text-center pt-2">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">+ {todaySchedules.length - 3}개의 일정이 더 있습니다</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-center py-6 bg-slate-50 dark:bg-[#0f1115]/50 rounded-xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-3">
                                <Calendar className="w-6 h-6 text-indigo-300 dark:text-indigo-500" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-1">오늘 남은 일정이 없습니다!</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">휴식을 취하거나 우측 하단 ➕ 버튼으로 일정을 추가해보세요.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Finance Widget */}
            <div className="md:col-span-12 lg:col-span-7 glass-card bg-white dark:bg-[#1a1c23] border border-slate-100 dark:border-white/5 rounded-[1.5rem] p-6 flex flex-col hover:-translate-y-1 transition-transform min-h-[220px]">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 p-1.5 rounded-lg">
                            <TrendingDown className="w-4 h-4" />
                        </span>
                        오늘의 재정 브리핑
                    </h2>
                    <button onClick={() => setCurrentTab('finance')} className="text-[13px] font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 flex items-center transition-colors">
                        세부 내역 및 자산 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-rose-50/50 dark:bg-rose-500/5 p-4 rounded-xl border border-rose-100 dark:border-rose-500/10">
                            <p className="text-xs font-bold text-rose-500 dark:text-rose-400 mb-1">하루 지출액</p>
                            <h3 className="text-3xl lg:text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tight leading-none">
                                {todayExpense > 0 ? todayExpense.toLocaleString() : '0'}원
                            </h3>
                        </div>
                        <div className="bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-xl border border-blue-100 dark:border-blue-500/10">
                            <p className="text-xs font-bold text-blue-500 dark:text-blue-400 mb-1">하루 수입액</p>
                            <h3 className="text-3xl lg:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                                {todayIncome > 0 ? todayIncome.toLocaleString() : '0'}원
                            </h3>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <div className="flex justify-between text-[13px] mb-2 items-end">
                            <span className="font-bold text-slate-500 dark:text-slate-400">이번 달 예산 소모율</span>
                            {todayExpense > 0 ? (
                                <span className="text-rose-500 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">지출 발생</span>
                            ) : (
                                <span className="text-slate-700 dark:text-slate-300 font-bold bg-slate-50 dark:bg-white/10 px-2 py-0.5 rounded">지출 없음</span>
                            )}
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-[#0f1115] rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-white/5">
                            <div className={`h-full rounded-full transition-all duration-1000 ${todayExpense > 0 ? 'bg-gradient-to-r from-orange-400 to-rose-400' : 'bg-slate-300 dark:bg-slate-700'}`} style={{ width: todayExpense > 0 ? '15%' : '0%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Goal Widget */}
            <div className="md:col-span-12 bg-indigo-600 dark:bg-[#1a1c23] lg:rounded-[2rem] rounded-[1.5rem] p-6 md:p-8 shadow-[0_8px_30px_-10px_rgba(79,70,229,0.5)] dark:shadow-2xl text-white overflow-hidden relative border border-indigo-500 dark:border-indigo-500/20 group hover:shadow-[0_8px_40px_-10px_rgba(79,70,229,0.7)] transition-shadow mt-2">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400 dark:bg-indigo-600 rounded-full blur-[80px] opacity-40 dark:opacity-20 translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10 md:flex md:items-center md:justify-between">
                    <div className="md:w-2/3">
                        <div className="inline-flex items-center gap-1.5 bg-indigo-500/50 dark:bg-indigo-500/20 backdrop-blur-md px-3 py-1 rounded-full text-indigo-100 dark:text-indigo-300 border border-indigo-400/30 text-xs font-bold mb-4 shadow-sm">
                            <Target className="w-3.5 h-3.5" /> {mainGoal ? '현재 집중 목표' : '새로운 목표 설정'}
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black mb-3 tracking-tight text-white">{mainGoal ? mainGoal.title : '아직 설정된 목표가 없어요'}</h3>
                        <p className="text-indigo-200 dark:text-indigo-300 text-sm font-medium mb-6 md:mb-0">
                            {mainGoal
                                ? (mainGoal.tracker?.type === 'numeric' ? `현재 ${mainGoal.tracker.current.toLocaleString()}${mainGoal.tracker.unit.split(' ')[0]} 달성 (${Math.floor((mainGoal.tracker.current / mainGoal.tracker.target) * 100)}%) • 계속 파이팅!` : `전체 ${mainGoal.tasks?.length || 0}개 작업 중 ${mainGoal.tasks?.filter(t => t.completed).length || 0}개 완료`)
                                : "우측 하단의 ➕ 버튼을 눌러 나만의 멋진 목표를 세워보세요!"
                            }
                        </p>
                    </div>
                    <div className="md:w-1/3 flex flex-col items-end">
                        <button onClick={() => setCurrentTab('goal')} className="text-sm font-bold text-indigo-100 bg-white/10 dark:bg-indigo-500/20 hover:bg-white/20 dark:hover:bg-indigo-500/40 px-5 py-2.5 rounded-xl border border-white/20 dark:border-indigo-500/30 flex items-center transition-colors mb-4 w-full md:w-auto justify-center backdrop-blur-md">
                            다양한 목표 확인 <ArrowRight className="w-4 h-4 ml-1.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
