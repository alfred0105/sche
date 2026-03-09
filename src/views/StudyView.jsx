/**
 * @fileoverview StudyView — redesigned with:
 *  - GitHub-style attendance heatmap calendar
 *  - Streak counter with fire animation
 *  - ConfirmModal instead of window.confirm
 *  - Stats cards (total days, streak, completion rate)
 *  - Pomodoro timer (#51)
 *  - Subject pie chart (#52)
 *  - Daily quote (#56)
 *  - Rest alert after 60min (#61)
 *  - Weekly study report bar chart (#62)
 *  - Flashcards Anki-style (#57)
 *  - Exam scores (#59)
 *  - Streak share (#65)
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from '../components/IconMap';
import ConfirmModal from '../components/ConfirmModal';
import { format, subDays, startOfMonth, endOfMonth, getDay, eachDayOfInterval, getDayOfYear, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { generateId } from '../utils/helpers';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line } from 'recharts';

const STUDY_QUOTES = [
    '지식은 힘이다. 오늘도 한 걸음 더.',
    '천 리 길도 한 걸음부터. 오늘의 공부가 내일을 만든다.',
    '포기하지 마. 시작이 반이다.',
    '공부는 배신하지 않는다.',
    '오늘 배운 것이 내일의 무기가 된다.',
    '어려울수록 더 집중하라. 성장은 불편함 속에 있다.',
    '반복이 실력이 된다.',
    '완벽한 준비보다 불완전한 시작이 낫다.',
    '지금 이 순간의 집중이 미래를 바꾼다.',
    '모르는 것을 아는 것이 앎의 시작이다.',
    '느리더라도 꾸준히. 토끼보다 거북이가 이긴다.',
    '오늘의 복습이 내일의 자신감이다.',
    '공부는 마라톤이다. 속도보다 지속이 중요하다.',
    '집중의 질이 시간의 양을 이긴다.',
    '배움에 끝은 없다. 오늘도 성장하자.',
    '어제보다 1% 더 알게 된 오늘.',
    '실수는 배움의 기회다.',
    '노력은 결코 배신하지 않는다.',
    '지금 힘든 것이 나중에 쉬워진다.',
    '공부한 시간은 절대 낭비가 아니다.',
];

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

// Mini heatmap calendar component
function AttendanceHeatmap({ logs, currentDate }) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPad = getDay(monthStart);

    const logSet = useMemo(() => new Set(logs), [logs]);
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

    return (
        <div className="w-full">
            <p className="text-[10px] font-bold tracking-tight text-slate-400 mb-2 uppercase tracking-wider">
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
                                    ? 'bg-indigo-500 dark:bg-indigo-400 text-white shadow-none'
                                    : isPast
                                        ? 'bg-white/5 text-slate-400'
                                        : 'bg-white/3 text-slate-400'
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

export default function StudyView({ studies, setStudies, currentDate, studyTimes = {}, setStudyTimes, authPhotos = {}, setAuthPhotos, session, userProfile }) {
    const { BookOpen, CheckCircle2, Trash2, Plus, Target, TrendingUp, Calendar: CalIcon, Flame, Trophy, Camera, Users, ImageIcon, BarChart3, PieChart: PieIcon, Share2, X } = IconMap;

    const [isAddMode, setIsAddMode] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState(30);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
    const [activeSubTab, setActiveSubTab] = useState('tracker'); // 'tracker' | 'stats' | 'report' | 'flashcards' | 'scores' | 'planner'

    // 공부 플래너 state
    const [studyPlans, setStudyPlans] = useState(() => {
        try { return JSON.parse(localStorage.getItem('studyPlans') || '[]'); } catch { return []; }
    });
    const [planAddMode, setPlanAddMode] = useState(false);
    const [planForm, setPlanForm] = useState({ studyId: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', endTime: '10:00', note: '' });
    const [planWeekOffset, setPlanWeekOffset] = useState(0);

    // #57 Flashcards state
    const [flashcards, setFlashcards] = useState(() => {
        try { return JSON.parse(localStorage.getItem('flashcards') || '[]'); } catch { return []; }
    });
    const [fcAddMode, setFcAddMode] = useState(false);
    const [fcFront, setFcFront] = useState('');
    const [fcBack, setFcBack] = useState('');
    const [fcSubjectId, setFcSubjectId] = useState('');
    const [fcReviewIdx, setFcReviewIdx] = useState(0);
    const [fcRevealed, setFcRevealed] = useState(false);

    useEffect(() => {
        try { localStorage.setItem('flashcards', JSON.stringify(flashcards)); } catch { }
    }, [flashcards]);

    useEffect(() => {
        try { localStorage.setItem('studyPlans', JSON.stringify(studyPlans)); } catch { }
    }, [studyPlans]);

    const addStudyPlan = useCallback(() => {
        if (!planForm.studyId) return toast.error('과목을 선택하세요.');
        if (!planForm.date) return toast.error('날짜를 선택하세요.');
        const subject = studies.find(s => s.id === planForm.studyId);
        setStudyPlans(prev => [...prev, {
            id: generateId(),
            studyId: planForm.studyId,
            subjectTitle: subject?.title || '알 수 없음',
            date: planForm.date,
            time: planForm.time,
            endTime: planForm.endTime,
            note: planForm.note.trim(),
            done: false,
        }]);
        setPlanAddMode(false);
        setPlanForm(p => ({ ...p, note: '', studyId: '' }));
        toast.success('공부 계획이 추가되었습니다!', { icon: '📅' });
    }, [planForm, studies]);

    const togglePlanDone = useCallback((id) => {
        setStudyPlans(prev => prev.map(p => p.id === id ? { ...p, done: !p.done } : p));
    }, []);

    const deletePlan = useCallback((id) => {
        setStudyPlans(prev => prev.filter(p => p.id !== id));
    }, []);

    const todayStr2 = format(currentDate, 'yyyy-MM-dd');
    const dueFlashcards = useMemo(() =>
        flashcards.filter(c => !c.nextReview || c.nextReview <= todayStr2),
        [flashcards, todayStr2]
    );

    const addFlashcard = useCallback(() => {
        if (!fcFront.trim() || !fcBack.trim()) return toast.error('앞면과 뒷면을 모두 입력하세요.');
        const newCard = { id: generateId(), front: fcFront.trim(), back: fcBack.trim(), studyId: fcSubjectId, nextReview: todayStr2 };
        setFlashcards(prev => [...prev, newCard]);
        setFcFront(''); setFcBack(''); setFcAddMode(false);
        toast.success('플래시카드가 추가되었습니다!', { icon: '🃏' });
    }, [fcFront, fcBack, fcSubjectId, todayStr2]);

    const rateFlashcard = useCallback((cardId, rating) => {
        // 😊=7d, 😐=3d, 😔=1d
        const days = rating === '😊' ? 7 : rating === '😐' ? 3 : 1;
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + days);
        const nextStr = format(nextDate, 'yyyy-MM-dd');
        setFlashcards(prev => prev.map(c => c.id === cardId ? { ...c, nextReview: nextStr } : c));
        setFcRevealed(false);
        setFcReviewIdx(prev => prev + 1);
    }, [currentDate]);

    // #59 Exam scores state
    const [examScores, setExamScores] = useState(() => {
        try { return JSON.parse(localStorage.getItem('examScores') || '[]'); } catch { return []; }
    });
    const [scoreAddMode, setScoreAddMode] = useState(false);
    const [scoreForm, setScoreForm] = useState({ subject: '', score: '', maxScore: 100, date: todayStr2, memo: '' });

    useEffect(() => {
        try { localStorage.setItem('examScores', JSON.stringify(examScores)); } catch { }
    }, [examScores]);

    const addExamScore = useCallback(() => {
        if (!scoreForm.subject || !scoreForm.score) return toast.error('과목과 점수를 입력하세요.');
        setExamScores(prev => [...prev, { id: generateId(), ...scoreForm, score: Number(scoreForm.score), maxScore: Number(scoreForm.maxScore) }]);
        setScoreForm({ subject: '', score: '', maxScore: 100, date: todayStr2, memo: '' });
        setScoreAddMode(false);
        toast.success('성적이 기록되었습니다!', { icon: '📊' });
    }, [scoreForm, todayStr2]);

    // #51 Pomodoro state
    const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
    const [pomodoroPhase, setPomodoroPhase] = useState('focus'); // 'focus' | 'break'
    const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
    const pomodoroRef = useRef(null);

    // Timer & Photo & Subject & Leaderboard State
    const [timerState, setTimerState] = useState(() => {
        try {
            const saved = sessionStorage.getItem('timerState');
            return saved ? JSON.parse(saved) : { activeId: null, isRunning: false };
        } catch { return { activeId: null, isRunning: false }; }
    });
    const [currentSubjects, setCurrentSubjects] = useState({});
    const timerRef = useRef(null);
    const syncRef = useRef(null);
    const [liveUsers, setLiveUsers] = useState([]);

    // #61 Rest alert — track cumulative session seconds
    const sessionSecsRef = useRef(0);
    const restAlertShownRef = useRef(false);

    const toggleTimer = useCallback((studyId) => {
        setTimerState(prev => {
            const next = prev.activeId === studyId
                ? { activeId: studyId, isRunning: !prev.isRunning }
                : { activeId: studyId, isRunning: true };
            try { sessionStorage.setItem('timerState', JSON.stringify(next)); } catch { }
            return next;
        });
    }, []);

    useEffect(() => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (timerState.isRunning && timerState.activeId) {
            timerRef.current = window.setInterval(() => {
                setStudyTimes(prev => ({ ...prev, [timerState.activeId]: (prev[timerState.activeId] || 0) + 1 }));
                // #61 Accumulate session time
                sessionSecsRef.current += 1;
                if (sessionSecsRef.current >= 3600 && !restAlertShownRef.current) {
                    restAlertShownRef.current = true;
                    sessionSecsRef.current = 0;
                    toast('60분 동안 공부하셨어요! 잠깐 휴식을 취해보세요 ☕', {
                        duration: 6000,
                        icon: '⏰',
                        style: { background: '#1e1b4b', color: '#a5b4fc' }
                    });
                    setTimeout(() => { restAlertShownRef.current = false; }, 5000);
                }
            }, 1000);
        } else {
            // Reset session counter when timer paused
            if (!timerState.isRunning) sessionSecsRef.current = 0;
        }
        return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    }, [timerState.isRunning, timerState.activeId, setStudyTimes]);

    // #51 Pomodoro timer effect
    useEffect(() => {
        if (pomodoroRef.current) window.clearInterval(pomodoroRef.current);
        if (pomodoroEnabled && timerState.isRunning) {
            pomodoroRef.current = window.setInterval(() => {
                setPomodoroSeconds(prev => {
                    if (prev <= 1) {
                        // Switch phase
                        setPomodoroPhase(ph => {
                            const next = ph === 'focus' ? 'break' : 'focus';
                            toast(next === 'break' ? '집중 시간 완료! 5분 휴식을 취하세요 🎉' : '휴식 완료! 다시 집중할 시간이에요 💪', {
                                duration: 4000, icon: next === 'break' ? '☕' : '🔥'
                            });
                            return next;
                        });
                        return pomodoroPhase === 'focus' ? 5 * 60 : 25 * 60;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (pomodoroRef.current) window.clearInterval(pomodoroRef.current); };
    }, [pomodoroEnabled, timerState.isRunning, pomodoroPhase]);

    // Reset pomodoro when disabled
    useEffect(() => {
        if (!pomodoroEnabled) {
            setPomodoroPhase('focus');
            setPomodoroSeconds(25 * 60);
        }
    }, [pomodoroEnabled]);

    // Live sync to/from Supabase public_leaderboard
    const totalUserTime = Object.values(studyTimes).reduce((sum, val) => sum + val, 0);
    const activeSubject = Object.values(currentSubjects).find(s => s?.trim()) || '열공 중 🔥';
    const channelRef = useRef(null);

    // Effect 1: Subscribe to realtime channel ONCE per session (not re-created on timer ticks)
    useEffect(() => {
        if (!session?.user || !supabase) return;

        const loadLeaderboard = async () => {
            try {
                const { data, error } = await supabase
                    .from('public_leaderboard')
                    .select('*')
                    .order('study_time', { ascending: false })
                    .limit(10);
                if (!error && data) {
                    setLiveUsers(data.filter(u => u.user_id !== session.user.id));
                }
            } catch (err) {
                console.error('[Leaderboard] 조회 오류:', err);
            }
        };

        loadLeaderboard();

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }
        channelRef.current = supabase
            .channel('leaderboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'public_leaderboard' }, () => {
                loadLeaderboard();
            })
            .subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [session]);

    // Effect 2: Upsert my data periodically — allowed to re-run when time/subject changes
    useEffect(() => {
        if (!session?.user || !supabase) return;

        const syncMyData = async () => {
            try {
                const { error } = await supabase.from('public_leaderboard').upsert({
                    user_id: session.user.id,
                    name: userProfile?.name || '익명 유저',
                    study_time: totalUserTime,
                    subject: activeSubject,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                if (error) console.error('[Leaderboard] Upsert 실패:', error.message);
            } catch (err) {
                console.error('[Leaderboard] Upsert 예외:', err);
            }
        };

        if (syncRef.current) window.clearInterval(syncRef.current);
        syncRef.current = window.setInterval(syncMyData, 15000);

        return () => {
            if (syncRef.current) window.clearInterval(syncRef.current);
        };
    }, [session, userProfile, totalUserTime, activeSubject]);

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        if (h > 0) return `${h}:${m}:${s}`;
        return `${m}:${s}`;
    };

    const formatPomodoroTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handlePhotoUpload = (e, studyId) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setAuthPhotos(prev => ({ ...prev, [studyId]: ev.target.result }));
            toast.success('공부 인증 사진이 등록되었습니다!', { icon: '📸' });
        };
        reader.readAsDataURL(file);
    };

    const leaderboard = useMemo(() => {
        const others = liveUsers.map(u => ({
            id: u.user_id,
            name: u.name || '익명',
            time: u.study_time || 0,
            subject: u.subject || '비공개',
            isMe: false
        }));
        const combined = [...others, { id: 'me', name: `${userProfile?.name || '나'} (현재)`, time: totalUserTime, subject: activeSubject, isMe: true }];
        return combined.sort((a, b) => b.time - a.time);
    }, [liveUsers, totalUserTime, activeSubject, userProfile]);

    // #52 Subject pie chart data
    const pieData = useMemo(() => {
        return studies
            .map(s => ({
                name: s.title,
                value: studyTimes[s.id] || 0,
                hours: ((studyTimes[s.id] || 0) / 3600).toFixed(1),
            }))
            .filter(d => d.value > 0);
    }, [studies, studyTimes]);

    // #62 Weekly study report — last 7 days per-subject total
    const weeklyBarData = useMemo(() => {
        return studies.map(s => ({
            name: s.title.slice(0, 8) + (s.title.length > 8 ? '…' : ''),
            시간: parseFloat(((studyTimes[s.id] || 0) / 3600).toFixed(2)),
        }));
    }, [studies, studyTimes]);

    // #56 Daily quote
    const dailyQuote = useMemo(() => {
        const dayOfYear = getDayOfYear(currentDate);
        return STUDY_QUOTES[dayOfYear % STUDY_QUOTES.length];
    }, [currentDate]);

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
        <section className="flex flex-col gap-4 md:gap-4 md:p-5 pb-20" aria-label="공부 및 출석부">
            <ConfirmModal
                isOpen={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false, id: null })}
                onConfirm={handleDeleteConfirm}
                title="공부 목표 삭제"
                message="이 공부 목표와 모든 출석 기록을 삭제하시겠습니까?"
                confirmText="삭제"
                variant="danger"
            />

            {/* #56 Daily quote banner */}
            <div className="glass-card px-4 py-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">오늘의 한마디</p>
                <p className="text-sm italic text-slate-300">"{dailyQuote}"</p>
            </div>

            <header className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                    <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl" aria-hidden="true">
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

            {/* Sub-tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" role="tablist">
                {[
                    { id: 'tracker', label: '트래커', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                    { id: 'planner', label: '플래너', icon: <span className="text-xs">📆</span> },
                    { id: 'stats', label: '통계', icon: <PieIcon className="w-3.5 h-3.5" /> },
                    { id: 'report', label: '리포트', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                    { id: 'flashcards', label: '플래시카드', icon: <span className="text-xs">🃏</span> },
                    { id: 'scores', label: '성적', icon: <span className="text-xs">📊</span> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeSubTab === tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${activeSubTab === tab.id ? 'bg-[#111113] border-white/10 text-indigo-400' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-300'}`}
                    >
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            {/* #52 Subject Pie Chart tab */}
            {activeSubTab === 'stats' && (
                <div className="glass-card p-4 md:p-5 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-indigo-400" /> 과목별 공부 시간 통계
                    </h3>
                    {pieData.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-8">아직 기록된 공부 시간이 없습니다. 타이머를 시작해보세요!</p>
                    ) : (
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-48 h-48 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `${(v / 3600).toFixed(1)}시간`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: '#1e1b4b', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-2 w-full">
                                {pieData.map((d, i) => (
                                    <div key={d.name} className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        <span className="text-xs font-bold text-slate-300 flex-1 truncate">{d.name}</span>
                                        <span className="text-xs font-bold text-indigo-400">{d.hours}시간</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* #62 Weekly study report tab */}
            {activeSubTab === 'report' && (
                <div className="glass-card p-4 md:p-5 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" /> 과목별 총 공부 시간 (시간)
                    </h3>
                    {weeklyBarData.every(d => d.시간 === 0) ? (
                        <p className="text-sm text-slate-500 text-center py-8">아직 기록된 공부 시간이 없습니다.</p>
                    ) : (
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip formatter={(v) => `${v}시간`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: '#1e1b4b', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                    <Bar dataKey="시간" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* #57 Flashcards tab */}
            {activeSubTab === 'flashcards' && (
                <div className="glass-card p-4 md:p-5 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                            🃏 플래시카드
                            {dueFlashcards.length > 0 && (
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    오늘 {dueFlashcards.length}장
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => setFcAddMode(p => !p)}
                            className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors"
                        >
                            {fcAddMode ? '취소' : '+ 카드 추가'}
                        </button>
                    </div>

                    {/* Add card form */}
                    <AnimatePresence>
                        {fcAddMode && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="bg-[#09090b] p-4 rounded-xl border border-white/10 space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">앞면 (질문)</label>
                                        <textarea value={fcFront} onChange={e => setFcFront(e.target.value)} placeholder="개념, 단어, 질문..." rows={2} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">뒷면 (정답)</label>
                                        <textarea value={fcBack} onChange={e => setFcBack(e.target.value)} placeholder="정답, 설명..." rows={2} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">과목 연결</label>
                                        <select value={fcSubjectId} onChange={e => setFcSubjectId(e.target.value)} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none">
                                            <option value="">-- 선택 안함 --</option>
                                            {studies.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={addFlashcard} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors">카드 추가하기</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Review mode */}
                    {dueFlashcards.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-500">복습 모드 — {Math.min(fcReviewIdx + 1, dueFlashcards.length)} / {dueFlashcards.length}</p>
                            {fcReviewIdx < dueFlashcards.length ? (
                                <div className="bg-[#09090b] p-6 rounded-xl border border-white/10 text-center space-y-4">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">앞면</p>
                                    <p className="text-lg font-bold text-slate-100">{dueFlashcards[fcReviewIdx].front}</p>
                                    {!fcRevealed ? (
                                        <button onClick={() => setFcRevealed(true)} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors">보기</button>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="bg-[#111113] p-4 rounded-xl border border-white/10">
                                                <p className="text-xs font-bold text-slate-500 mb-2">뒷면</p>
                                                <p className="text-base font-bold text-emerald-400">{dueFlashcards[fcReviewIdx].back}</p>
                                            </div>
                                            <div className="flex gap-3 justify-center">
                                                {['😔', '😐', '😊'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => rateFlashcard(dueFlashcards[fcReviewIdx].id, emoji)}
                                                        className="flex flex-col items-center gap-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
                                                    >
                                                        <span className="text-2xl">{emoji}</span>
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            {emoji === '😔' ? '1일' : emoji === '😐' ? '3일' : '7일'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-2xl mb-2">🎉</p>
                                    <p className="text-sm font-bold text-emerald-400">오늘의 복습 완료!</p>
                                    <button onClick={() => setFcReviewIdx(0)} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-bold">다시 복습하기</button>
                                </div>
                            )}
                        </div>
                    ) : flashcards.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <p className="text-3xl mb-3">🃏</p>
                            <p className="text-sm font-bold">아직 카드가 없습니다.</p>
                            <p className="text-xs mt-1">위의 "카드 추가" 버튼으로 첫 카드를 만들어보세요!</p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <p className="text-2xl mb-2">✅</p>
                            <p className="text-sm font-bold text-slate-400">오늘 복습할 카드가 없습니다.</p>
                        </div>
                    )}

                    {/* All cards list */}
                    {flashcards.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/10">
                            <p className="text-xs font-bold text-slate-500">전체 카드 ({flashcards.length}장)</p>
                            {flashcards.map(card => (
                                <div key={card.id} className="flex items-center gap-3 bg-[#09090b] p-3 rounded-xl border border-white/5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-300 truncate">{card.front}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{card.back}</p>
                                    </div>
                                    <div className="text-[10px] text-slate-500 shrink-0">{card.nextReview}</div>
                                    <button onClick={() => setFlashcards(prev => prev.filter(c => c.id !== card.id))} className="text-slate-600 hover:text-rose-500 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 공부 플래너 탭 */}
            {activeSubTab === 'planner' && (() => {
                const weekStart = startOfWeek(addDays(currentDate, planWeekOffset * 7), { weekStartsOn: 1 });
                const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
                const weekPlans = studyPlans.filter(p => {
                    const d = parseISO(p.date);
                    return d >= weekStart && d < addDays(weekStart, 7);
                });
                const totalPlanMins = weekPlans.reduce((sum, p) => {
                    const [sh, sm] = (p.time || '00:00').split(':').map(Number);
                    const [eh, em] = (p.endTime || '00:00').split(':').map(Number);
                    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
                }, 0);
                return (
                    <div className="glass-card p-4 md:p-5 rounded-xl space-y-4">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-400">📆 공부 플래너</h3>
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                    이번 주 {Math.floor(totalPlanMins / 60)}h {totalPlanMins % 60}m 계획
                                </span>
                            </div>
                            <button onClick={() => setPlanAddMode(p => !p)} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors">
                                {planAddMode ? '취소' : '+ 추가'}
                            </button>
                        </div>

                        {/* 주 이동 */}
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                            <button onClick={() => setPlanWeekOffset(p => p - 1)} className="px-2 py-1 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">← 이전 주</button>
                            <span className="text-slate-300">
                                {format(weekStart, 'M/d')} ~ {format(addDays(weekStart, 6), 'M/d')}
                            </span>
                            <button onClick={() => setPlanWeekOffset(p => p + 1)} className="px-2 py-1 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">다음 주 →</button>
                        </div>

                        {/* 추가 폼 */}
                        <AnimatePresence>
                            {planAddMode && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="bg-[#09090b] p-4 rounded-xl border border-white/10 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">과목</label>
                                                <select value={planForm.studyId} onChange={e => setPlanForm(p => ({ ...p, studyId: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500">
                                                    <option value="">-- 과목 선택 --</option>
                                                    {studies.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">날짜</label>
                                                <input type="date" value={planForm.date} onChange={e => setPlanForm(p => ({ ...p, date: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 outline-none [color-scheme:dark]" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">시작</label>
                                                    <input type="time" value={planForm.time} onChange={e => setPlanForm(p => ({ ...p, time: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-2 py-2 text-xs font-bold text-slate-400 outline-none [color-scheme:dark]" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">종료</label>
                                                    <input type="time" value={planForm.endTime} onChange={e => setPlanForm(p => ({ ...p, endTime: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-2 py-2 text-xs font-bold text-slate-400 outline-none [color-scheme:dark]" />
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">메모</label>
                                                <input type="text" value={planForm.note} onChange={e => setPlanForm(p => ({ ...p, note: e.target.value }))} placeholder="공부 내용, 목표 페이지 등..." className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500" onKeyDown={e => e.key === 'Enter' && addStudyPlan()} />
                                            </div>
                                        </div>
                                        <button onClick={addStudyPlan} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors">계획 저장</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 주간 날짜별 플랜 목록 */}
                        <div className="space-y-2">
                            {weekDays.map((day, idx) => {
                                const ds = format(day, 'yyyy-MM-dd');
                                const dayPlans = studyPlans.filter(p => p.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div key={ds}>
                                        <div className={`flex items-center gap-2 px-1 mb-1`}>
                                            <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isToday ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>{DAY_LABELS[idx]}</span>
                                            <span className={`text-[10px] font-bold ${isToday ? 'text-indigo-400' : 'text-slate-600'}`}>{format(day, 'M/d')}</span>
                                            {dayPlans.length > 0 && (
                                                <span className="text-[9px] font-bold text-slate-600">
                                                    {dayPlans.reduce((sum, p) => {
                                                        const [sh, sm] = (p.time || '00:00').split(':').map(Number);
                                                        const [eh, em] = (p.endTime || '00:00').split(':').map(Number);
                                                        return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
                                                    }, 0)}분
                                                </span>
                                            )}
                                        </div>
                                        {dayPlans.length === 0 ? (
                                            <div className="ml-7 text-[10px] text-slate-700 py-1">계획 없음</div>
                                        ) : (
                                            <div className="ml-7 space-y-1.5">
                                                {dayPlans.map(plan => {
                                                    const subject = studies.find(s => s.id === plan.studyId);
                                                    return (
                                                        <div key={plan.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${plan.done ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-[#09090b] border-white/10'}`}>
                                                            <button onClick={() => togglePlanDone(plan.id)} className="shrink-0 active:scale-90 transition-transform">
                                                                {plan.done
                                                                    ? <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                                                    : <Target className="w-4 h-4 text-slate-600" />}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`text-xs font-bold truncate ${plan.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{subject?.title || plan.subjectTitle}</span>
                                                                    <span className="text-[10px] text-slate-500 shrink-0">{plan.time}{plan.endTime ? ` ~ ${plan.endTime}` : ''}</span>
                                                                </div>
                                                                {plan.note && <p className="text-[10px] text-slate-500 truncate mt-0.5">{plan.note}</p>}
                                                            </div>
                                                            <button onClick={() => deletePlan(plan.id)} className="text-slate-700 hover:text-rose-500 transition-colors shrink-0">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {weekPlans.length === 0 && !planAddMode && (
                            <div className="text-center py-8 text-slate-600">
                                <p className="text-3xl mb-2">📆</p>
                                <p className="text-sm font-bold">이번 주 공부 계획이 없습니다.</p>
                                <p className="text-xs mt-1">+ 추가 버튼으로 계획을 세워보세요!</p>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* #59 Exam scores tab */}
            {activeSubTab === 'scores' && (
                <div className="glass-card p-4 md:p-5 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">📊 시험 성적 기록</h3>
                        <button
                            onClick={() => setScoreAddMode(p => !p)}
                            className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors"
                        >
                            {scoreAddMode ? '취소' : '+ 성적 추가'}
                        </button>
                    </div>

                    <AnimatePresence>
                        {scoreAddMode && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="bg-[#09090b] p-4 rounded-xl border border-white/10 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">과목</label>
                                            <select value={scoreForm.subject} onChange={e => setScoreForm(p => ({ ...p, subject: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none">
                                                <option value="">-- 선택 --</option>
                                                {studies.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                                                <option value="기타">기타</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">날짜</label>
                                            <input type="date" value={scoreForm.date} onChange={e => setScoreForm(p => ({ ...p, date: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 outline-none [color-scheme:dark]" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">점수</label>
                                            <input type="number" value={scoreForm.score} onChange={e => setScoreForm(p => ({ ...p, score: e.target.value }))} placeholder="예: 87" className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">만점</label>
                                            <input type="number" value={scoreForm.maxScore} onChange={e => setScoreForm(p => ({ ...p, maxScore: e.target.value }))} className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">메모</label>
                                        <input type="text" value={scoreForm.memo} onChange={e => setScoreForm(p => ({ ...p, memo: e.target.value }))} placeholder="간단한 메모..." className="w-full bg-[#111113] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500" />
                                    </div>
                                    <button onClick={addExamScore} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors">성적 저장</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {examScores.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <p className="text-3xl mb-3">📝</p>
                            <p className="text-sm font-bold">아직 기록된 성적이 없습니다.</p>
                        </div>
                    ) : (
                        <>
                            {/* Scores table */}
                            <div className="space-y-2">
                                {[...examScores].sort((a, b) => b.date.localeCompare(a.date)).map(s => {
                                    const pct = Math.round((s.score / s.maxScore) * 100);
                                    const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-rose-400';
                                    const bg = pct >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : pct >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';
                                    return (
                                        <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-200">{s.subject}</p>
                                                {s.memo && <p className="text-[10px] text-slate-500 truncate">{s.memo}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`text-base font-bold ${color}`}>{pct}%</p>
                                                <p className="text-[10px] text-slate-500">{s.score}/{s.maxScore} · {s.date}</p>
                                            </div>
                                            <button onClick={() => setExamScores(prev => prev.filter(e => e.id !== s.id))} className="text-slate-600 hover:text-rose-500 transition-colors shrink-0">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Line chart per subject */}
                            {(() => {
                                const subjects = [...new Set(examScores.map(s => s.subject))];
                                const chartData = subjects.slice(0, 1).map(sub => {
                                    return [...examScores]
                                        .filter(s => s.subject === sub)
                                        .sort((a, b) => a.date.localeCompare(b.date))
                                        .map(s => ({ date: s.date.slice(5), pct: Math.round((s.score / s.maxScore) * 100), name: sub }));
                                })[0] || [];
                                if (chartData.length < 2) return null;
                                return (
                                    <div className="pt-2 border-t border-white/10">
                                        <p className="text-xs font-bold text-slate-500 mb-3">성적 추이 — {subjects[0]}</p>
                                        <div className="h-36">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '0.75rem', border: 'none', background: '#1e1b4b', fontSize: '12px', fontWeight: 'bold', color: '#a5b4fc' }} />
                                                    <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            )}

            {activeSubTab === 'tracker' && (
                <>
                    {/* Live Leaderboard */}
                    <div className="glass-card px-4 py-4 rounded-xl mb-2 bg-[#09090b] border border-white/10 shadow-none">
                        <h3 className="text-[14px] font-bold tracking-tight text-white mb-3 flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-orange-500" /> 오늘의 공부 라이브 랭킹
                        </h3>
                        <div className="flex flex-col gap-1.5">
                            {leaderboard.map((user, idx) => (
                                <div key={user.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border shadow-none ${user.isMe ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-[#111113]/50 border-white/5'}`}>
                                    <div className="flex items-center gap-3 w-1/2">
                                        <span className={`text-[12px] font-black w-4 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}`}>{idx + 1}</span>
                                        <span className={`text-[13px] font-bold tracking-tight truncate ${user.isMe ? 'text-indigo-400' : 'text-slate-400'}`}>{user.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className={`text-[11px] font-bold truncate max-w-[100px] border border-white/5 px-2 py-0.5 rounded-full ${user.isMe ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 bg-white/5'}`}>{user.subject}</span>
                                        <span className={`text-sm font-mono tracking-wider font-bold w-16 text-right ${user.isMe ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            {formatTime(user.time)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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
                                    <h3 className="text-sm font-bold tracking-tight text-slate-400">새로운 공부/습관 트래커 추가</h3>
                                    <div>
                                        <label htmlFor="study-title" className="text-xs font-bold text-slate-400 mb-1 block">목표 내용</label>
                                        <input id="study-title" type="text" placeholder="예: 매일 알고리즘 1문제 풀기" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-200" />
                                    </div>
                                    <div>
                                        <label htmlFor="study-target" className="text-xs font-bold text-slate-400 mb-1 block">목표 달성 출석일수 (일)</label>
                                        <input id="study-target" type="number" min="1" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="w-full bg-[#09090b] border border-white/10 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-200" />
                                    </div>
                                    <button onClick={handleAdd} className="w-full mt-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold tracking-tight rounded-xl shadow-none transition-colors">트래커 생성하기</button>
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

                                        <div className="p-5 md:p-4 md:p-5">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-none transition-all ${isCheckedToday ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`} aria-hidden="true">
                                                        <BookOpen className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold tracking-tight text-slate-100 leading-tight">{study.title}</h3>
                                                        <p className="text-[12px] font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                                                            <CalIcon className="w-3 h-3" aria-hidden="true" /> 목표 {study.totalDays}일 중 {study.logs.length}일 출석
                                                            {remaining > 0 && <span className="text-indigo-400">· 남은 {remaining}일</span>}
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
                                                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">출석일</p>
                                                    <p className="text-xl font-bold tracking-tight text-slate-100">{study.logs.length}<span className="text-xs font-bold text-slate-400 ml-0.5">일</span></p>
                                                </div>
                                                <div className={`rounded-xl p-3 text-center border ${streak >= 3 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/10'}`}>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">연속 출석</p>
                                                    <p className={`text-xl font-bold tracking-tight ${streak >= 3 ? 'text-orange-400' : 'text-slate-100'}`}>
                                                        {streak >= 3 && '🔥'}{streak}<span className="text-xs font-bold text-slate-400 ml-0.5">일</span>
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">달성률</p>
                                                    <p className={`text-xl font-bold tracking-tight ${completionRate >= 100 ? 'text-emerald-500' : 'text-indigo-400'}`}>{completionRate}<span className="text-xs font-bold text-slate-400 ml-0.5">%</span></p>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
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

                                            {/* Main Content: Check-in + Heatmap */}
                                            <div className="flex flex-col md:flex-row gap-4">
                                                {/* Left: Today's check-in */}
                                                <div className="flex-1 bg-[#09090b] rounded-xl p-4 border border-white/10 flex items-center justify-between">
                                                    <div className="flex flex-col w-full">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(currentDate, 'MMM dd')} 오늘의 출석</span>
                                                        <span className={`text-sm font-bold tracking-tight mt-1 ${isCheckedToday ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                            {isCheckedToday ? '출석 완료 🎉' : '아직 늦지 않았어요!'}
                                                        </span>
                                                        {streak >= 7 && <span className="text-[11px] font-bold text-orange-500 mt-1">🔥 {streak}일 연속 출석 중!</span>}

                                                        {/* Timer UI */}
                                                        <div className="mt-3 bg-[#111113] p-3 rounded-xl flex flex-col gap-3 shadow-none border border-white/10">
                                                            {/* #51 Pomodoro toggle */}
                                                            <div className="flex items-center justify-between">
                                                                <button
                                                                    onClick={() => setPomodoroEnabled(p => !p)}
                                                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${pomodoroEnabled ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-white/5 text-slate-500 border-white/10 hover:border-indigo-500/30'}`}
                                                                >
                                                                    🍅 뽀모도로 {pomodoroEnabled ? 'ON' : 'OFF'}
                                                                </button>
                                                                {pomodoroEnabled && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pomodoroPhase === 'focus' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                                                                            {pomodoroPhase === 'focus' ? '집중 중' : '휴식 중'}
                                                                        </span>
                                                                        <span className="text-base font-mono font-bold text-indigo-400">
                                                                            {formatPomodoroTime(pomodoroSeconds)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">집중 스톱워치</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold tracking-tight text-indigo-500 font-mono tracking-wider min-w-[3.5rem] text-right inline-block">
                                                                        {formatTime(studyTimes[study.id] || 0)}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => toggleTimer(study.id)}
                                                                        className={`px-3 py-1 rounded-lg text-[10px] font-bold active:scale-95 transition-all w-16 text-center ${timerState.activeId === study.id && timerState.isRunning
                                                                            ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                                                            : 'bg-indigo-500 text-white shadow-none'
                                                                            }`}
                                                                    >
                                                                        {timerState.activeId === study.id && timerState.isRunning ? '일시정지 ⏸' : '시작 ▶'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center border border-white/10 bg-[#09090b] rounded-lg px-2">
                                                                <span className="text-[10px] font-bold text-slate-500 shrink-0 mr-2">현재 공부 중:</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="예: 영어 단어 1단원 암기"
                                                                    value={currentSubjects[study.id] || ''}
                                                                    onChange={(e) => setCurrentSubjects(prev => ({ ...prev, [study.id]: e.target.value }))}
                                                                    className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-300 py-1.5 placeholder-slate-600"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Photo Auth UI */}
                                                        <div className="mt-2 text-left w-full">
                                                            {authPhotos[study.id] ? (
                                                                <div className="relative inline-block mt-2 group border border-indigo-500/30 rounded-lg p-1 bg-[#111113]">
                                                                    <div className="flex flex-col gap-1 items-center justify-center relative">
                                                                        <img src={authPhotos[study.id]} alt="인증" className="w-full max-w-[120px] max-h-[120px] object-cover rounded shadow-none opacity-90" />
                                                                        <span className="absolute bottom-0 bg-black/70 w-full text-center text-[9px] py-1 text-white font-bold tracking-tight rounded-b">오늘 인증 완료 🎉</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setAuthPhotos(prev => { const n = { ...prev }; delete n[study.id]; return n; })}
                                                                        className="absolute -top-2 -right-2 bg-rose-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-none"
                                                                        aria-label="사진 삭제"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <label className="inline-flex cursor-pointer mt-2 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-2.5 rounded-xl transition-colors gap-1.5 items-center w-full justify-center">
                                                                    <Camera className="w-4 h-4" /> 오늘의 공부 인증 사진 등록
                                                                    <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, study.id)} className="hidden" />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleCheckIn(study)}
                                                        className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ml-3 transition-all ${isCheckedToday ? 'bg-indigo-500/10 text-indigo-500 shadow-none scale-95' : 'bg-slate-900 dark:bg-indigo-600 text-white hover:scale-105 shadow-none'}`}
                                                        aria-label={isCheckedToday ? '출석 취소' : '출석 체크'}
                                                    >
                                                        <CheckCircle2 className="w-6 h-6" />
                                                    </button>
                                                </div>

                                                {/* Right: Heatmap Calendar */}
                                                <div className="flex-1 bg-[#09090b] rounded-xl p-4 border border-white/10">
                                                    <AttendanceHeatmap logs={study.logs} currentDate={currentDate} />
                                                    {/* #65 Streak share button */}
                                                    <button
                                                        onClick={() => {
                                                            const thisMonthLogs = study.logs.filter(l => l.startsWith(format(currentDate, 'yyyy-MM')));
                                                            const text = `📚 올라운더 공부 스트릭\n🔥 ${streak}일 연속\n📅 이번 달 ${thisMonthLogs.length}일 출석\n\n열심히 공부 중! 💪`;
                                                            navigator.clipboard.writeText(text).then(() => toast.success('클립보드에 복사되었습니다!', { icon: '📋' })).catch(() => toast.error('복사 실패'));
                                                        }}
                                                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                                                    >
                                                        <Share2 className="w-3 h-3" /> 스트릭 공유
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}

StudyView.propTypes = {
    studies: PropTypes.array.isRequired,
    setStudies: PropTypes.func.isRequired,
    currentDate: PropTypes.instanceOf(Date).isRequired,
    studyTimes: PropTypes.object,
    setStudyTimes: PropTypes.func,
    authPhotos: PropTypes.object,
    setAuthPhotos: PropTypes.func,
    session: PropTypes.object,
    userProfile: PropTypes.object,
};