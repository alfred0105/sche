import React, { useState } from 'react';
import { IconMap } from '../components/IconMap';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function StudyView({ studies, setStudies, currentDate }) {
    const { BookOpen, CheckCircle2, TrendingUp, Calendar: CalIcon, Trash2, Plus } = IconMap;

    const [isAddMode, setIsAddMode] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState(30);

    const handleAdd = () => {
        if (!newTitle.trim()) return toast.error('공부 목표 텍스트를 입력해주세요.');
        if (newTarget < 1) return toast.error('목표 일수는 1일 이상이어야 합니다.');

        const newStudy = {
            id: Date.now(),
            title: newTitle,
            icon: 'BookOpen',
            totalDays: parseInt(newTarget),
            logs: []
        };
        setStudies([...studies, newStudy]);
        setNewTitle('');
        setIsAddMode(false);
        toast.success('새로운 공부 목표가 추가되었습니다.', { icon: '🎯' });
    };

    const handleDelete = (id) => {
        if (window.confirm('이 공부 목표를 삭제하시겠습니까?')) {
            setStudies(studies.filter(s => s.id !== id));
            toast.success('삭제 완료');
        }
    };

    const handleCheckIn = (study) => {
        const todayStr = format(currentDate, 'yyyy-MM-dd');
        const alreadyChecked = study.logs.includes(todayStr);

        let newLogs;
        if (alreadyChecked) {
            newLogs = study.logs.filter(l => l !== todayStr);
            toast.success('출석을 취소했습니다.', { icon: '🔄' });
        } else {
            newLogs = [...study.logs, todayStr];
            toast.success('오늘의 출석 완료! 화이팅!', { icon: '🔥' });
        }

        setStudies(studies.map(s => s.id === study.id ? { ...s, logs: newLogs } : s));
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 animate-fade-in-up pb-20">

            <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-500" />
                    공부 및 출석부
                </h2>
                <button
                    onClick={() => setIsAddMode(!isAddMode)}
                    className="px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-transform"
                >
                    {isAddMode ? '취소' : '+ 목표 추가'}
                </button>
            </div>

            {isAddMode && (
                <div className="bg-white dark:bg-[#1a1c23] p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">새로운 공부/습관 트래커 추가</h3>
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-1 block">목표 내용</label>
                        <input
                            type="text"
                            placeholder="예: 매일 알고리즘 1문제 풀기"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm font-bold text-slate-700 dark:text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-1 block">목표 달성 출석일수 (일)</label>
                        <input
                            type="number"
                            value={newTarget}
                            onChange={e => setNewTarget(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm font-bold text-slate-700 dark:text-slate-200"
                        />
                    </div>
                    <button onClick={handleAdd} className="w-full mt-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-xl shadow-md transition-colors">
                        트래커 생성하기
                    </button>
                </div>
            )}

            {(!studies || studies.length === 0) ? (
                <div className="bg-white/50 dark:bg-[#13151a]/50 border border-slate-100 dark:border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-3">
                    <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">등록된 공부 목표가 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studies.map(study => {
                        const todayStr = format(currentDate, 'yyyy-MM-dd');
                        const isCheckedToday = study.logs.includes(todayStr);
                        const progress = Math.min(100, Math.round((study.logs.length / study.totalDays) * 100));

                        return (
                            <div key={study.id} className="bg-white dark:bg-[#1a1c23] p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-4 relative overflow-hidden group">
                                <button onClick={() => handleDelete(study.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                <div className="flex items-start gap-4 pr-8">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${isCheckedToday ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500'}`}>
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">{study.title}</h3>
                                        <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-1">
                                            <CalIcon className="w-3 h-3" /> 목표 {study.totalDays}일 중 {study.logs.length}일 출석
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-2">
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-slate-500">진행률</span>
                                        <span className="text-indigo-500 text-sm">{progress}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out relative"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-[#0f1115] rounded-2xl p-4 mt-2 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(currentDate, 'MMM dd')} 오늘의 출석</span>
                                        <span className={`text-sm font-black ${isCheckedToday ? 'text-indigo-500' : 'text-slate-500 dark:text-slate-300'}`}>
                                            {isCheckedToday ? '출석 완료 🎉' : '아직 늦지 않았어요!'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleCheckIn(study)}
                                        className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isCheckedToday ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-500 shadow-inner scale-95' : 'bg-slate-900 dark:bg-indigo-600 text-white hover:scale-105 shadow-md'}`}
                                    >
                                        <CheckCircle2 className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
