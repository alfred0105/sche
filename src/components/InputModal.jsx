/**
 * @fileoverview InputModal — extracted from App.jsx's massive modal code.
 * Handles creation of expenses, income, schedules, and goals.
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-hot-toast';
import { IconMap } from './IconMap';
import { TRACKER_UNITS, DEFAULT_RECURRING_COUNT } from '../constants';
import { sanitizeRecurringCount } from '../utils/helpers';
import { addMonths, parseISO, format } from 'date-fns';
import { generateRecurringTransactions, generateRecurringSchedules } from '../utils/recurringGenerator';
import { generateId } from '../utils/helpers';

export default function InputModal({
    isOpen,
    onClose,
    filterDateStr,
    displayDate,
    expenseCategories,
    incomeCategories,
    scheduleCategories,
    accounts,
    setTransactions,
    setSchedules,
    setGoals,
    goals,
}) {
    const { Plus, X, Check } = IconMap;
    const modalRef = useRef(null);

    const [inputMode, setInputMode] = useState('expense');
    const [activeCategoryId, setActiveCategoryId] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [formDate, setFormDate] = useState(filterDateStr);
    const [formTitle, setFormTitle] = useState('');
    const [formMemo, setFormMemo] = useState('');
    const [formAccount, setFormAccount] = useState('cash');
    const [formLocation, setFormLocation] = useState('');
    const [scheduleEndTime, setScheduleEndTime] = useState('10:00');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringType, setRecurringType] = useState('weekly');
    const [recurringCount, setRecurringCount] = useState(DEFAULT_RECURRING_COUNT);
    const [excludeHolidays, setExcludeHolidays] = useState(false);
    const [customRecurringDays, setCustomRecurringDays] = useState([{ id: generateId(), val: 1, time: '09:00', endTime: '10:00' }]);
    const [goalType, setGoalType] = useState('short');
    const [goalTrackerType, setGoalTrackerType] = useState('checklist');
    const [goalTrackerUnit, setGoalTrackerUnit] = useState('% (수동 퍼센트)');
    const [goalTargetValue, setGoalTargetValue] = useState(100);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Advanced features
    const [schedulePriority, setSchedulePriority] = useState('Medium');
    const [taxDeductible, setTaxDeductible] = useState(false);
    const [installmentMonths, setInstallmentMonths] = useState(1);

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setInputMode('expense');
            setInputValue('');
            setFormDate(filterDateStr);
            setScheduleTime('09:00');
            setScheduleEndTime('10:00');
            setFormTitle('');
            setFormMemo('');
            setFormLocation('');
            setFormAccount(accounts[0]?.id || 'cash');
            setActiveCategoryId(expenseCategories[0]?.id || '');
            setIsRecurring(false);
            setExcludeHolidays(false);
            setCustomRecurringDays([{ id: generateId(), val: 1, time: '09:00', endTime: '10:00' }]);
            setHasInteracted(false);
            setSchedulePriority('Medium');
            setTaxDeductible(false);
            setInstallmentMonths(1);
        }
    }, [isOpen, filterDateStr, accounts, expenseCategories]);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const activeCategories = inputMode === 'expense' ? expenseCategories : inputMode === 'income' ? incomeCategories : scheduleCategories;

    const handleModeChange = (mode) => {
        setInputMode(mode);
        setInputValue('');
        setFormTitle('');
        setFormMemo('');
        setFormLocation('');
        setIsRecurring(false);
        setExcludeHolidays(false);
        setCustomRecurringDays([{ id: generateId(), val: 1, time: '09:00', endTime: '10:00' }]);
        setHasInteracted(false);
        setSchedulePriority('Medium');
        setTaxDeductible(false);
        setInstallmentMonths(1);
        if (mode === 'expense') setActiveCategoryId(expenseCategories[0]?.id || '');
        if (mode === 'income') setActiveCategoryId(incomeCategories[0]?.id || '');
        if (mode === 'schedule') setActiveCategoryId(scheduleCategories[0]?.id || '');
    };

    const handleAmountChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setInputValue(val);
    };

    const handleConfirmSave = () => {
        setHasInteracted(true);
        if (!formTitle.trim()) return toast.error('제목/요약을 입력해주세요!');
        if (!formDate) return toast.error('날짜를 지정해주세요!');

        const cat = activeCategories.find((c) => c.id === activeCategoryId);
        const catLabel = cat ? cat.label : '기타';

        let count = 1;
        if (isRecurring && inputMode !== 'goal') {
            count = sanitizeRecurringCount(recurringCount);
        }

        if (inputMode === 'goal') {
            const tgtVal = Number(goalTargetValue);
            if (goalTrackerType === 'numeric' && (!tgtVal || tgtVal <= 0)) {
                return toast.error('올바른 목표 수치를 입력해주세요.');
            }
            setGoals((prev) => [...prev, {
                id: generateId(),
                type: goalType,
                title: formTitle,
                progress: 0,
                deadline: formDate,
                icon: '🎯',
                colorFrom: 'from-indigo-500',
                colorTo: 'to-purple-500',
                tasks: [],
                memo: formMemo,
                tracker: { type: goalTrackerType, unit: goalTrackerUnit, current: 0, target: tgtVal || 100 },
            }]);
            toast.success('새로운 목표가 생성되었습니다!', { icon: '🎯' });
        } else if (inputMode === 'expense' || inputMode === 'income') {
            const totalAmt = Number(inputValue);
            if (!totalAmt || totalAmt <= 0) return toast.error('올바른 금액을 입력해주세요!');

            const config = { formDate, recurringType, count, excludeHolidays, customRecurringDays };
            const baseTxData = { type: inputMode, title: formTitle, category: catLabel, memo: formMemo, accountId: formAccount, taxDeductible };

            let newTx = [];
            if (inputMode === 'expense' && installmentMonths > 1 && !isRecurring) {
                const amtPerMonth = Math.floor(totalAmt / installmentMonths);
                const remainder = totalAmt - (amtPerMonth * installmentMonths);
                const groupId = generateId();
                for (let i = 0; i < installmentMonths; i++) {
                    const iDate = format(addMonths(parseISO(formDate), i), 'yyyy-MM-dd');
                    newTx.push({
                        id: generateId(),
                        ...baseTxData,
                        amount: i === 0 ? amtPerMonth + remainder : amtPerMonth,
                        date: iDate,
                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        title: `${formTitle} (${i + 1}/${installmentMonths}개월 할부)`,
                        groupId,
                        installment: installmentMonths,
                    });
                }
            } else {
                newTx = generateRecurringTransactions(config, { ...baseTxData, amount: totalAmt, installment: 1 });
            }

            setTransactions((prev) => [...prev, ...newTx]);
            toast.success(inputMode === 'expense'
                ? `지출 내역 ${count > 1 ? `(${count}회 반복) ` : ''}저장 완료!`
                : `수입 내역 ${count > 1 ? `(${count}회 반복) ` : ''}저장 완료!`, { icon: '📝' });
        } else {
            // Schedule — 종료 시간이 시작 시간보다 빠르면 오류 (분 단위 숫자 비교)
            const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            if (toMinutes(scheduleEndTime) <= toMinutes(scheduleTime)) {
                return toast.error('종료 시간은 시작 시간보다 늦어야 합니다.');
            }
            const config = { formDate, recurringType, count, excludeHolidays, customRecurringDays };
            const scData = {
                title: formTitle,
                category: catLabel,
                memo: formMemo,
                location: formLocation,
                scheduleTime,
                scheduleEndTime,
                priority: schedulePriority,
            };
            const newSc = generateRecurringSchedules(config, scData);

            setSchedules((prev) => [...prev, ...newSc]);
            toast.success(`상세 일정 ${count > 1 ? `(${count}회 반복) ` : ''}등록 성공!`, { icon: '📅' });
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-3 fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="input-modal-title"
        >
            <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden="true" />
            <div
                ref={modalRef}
                className="relative bg-[#111113] w-full max-w-md overflow-hidden flex flex-col border border-white/20 dark:border-white/5 my-8 max-h-[90vh]"
                style={{ borderRadius: '6px' }}
            >
                <header className="glass px-3 py-3 border-b border-white/10 flex justify-between items-center z-10 shrink-0">
                    <div className="flex flex-col">
                        <h3 id="input-modal-title" className="text-lg font-bold tracking-tight text-slate-100">새로운 기록 추가</h3>
                        <p className="text-[11px] text-slate-400 font-bold">{displayDate}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 transition-colors" style={{ borderRadius: '3px' }} aria-label="닫기">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </header>

                <div className="p-3 md:p-3 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-[#0f1115]/50 flex-1 [&::-webkit-scrollbar]:hidden">
                    {/* Mode Selector */}
                    <div className="flex border-b border-white/10" role="tablist" aria-label="입력 모드 선택">
                        {[
                            { mode: 'expense', label: '지출', activeColor: 'text-rose-500' },
                            { mode: 'income', label: '수입', activeColor: 'text-blue-500' },
                            { mode: 'schedule', label: '일정', activeColor: 'text-indigo-500' },
                            { mode: 'goal', label: '목표 등록', activeColor: 'text-purple-500' },
                        ].map(({ mode, label, activeColor }) => (
                            <button
                                key={mode}
                                role="tab"
                                aria-selected={inputMode === mode}
                                onClick={() => handleModeChange(mode)}
                                className={`flex-1 py-2 text-xs font-bold transition-all ${inputMode === mode ? `border-b-2 border-indigo-400 ${activeColor}` : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <div>
                        <label htmlFor="input-title" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                            제목 ({inputMode === 'goal' ? '어떤 목표인가요?' : '무엇을 기록할까요?'}) *
                        </label>
                        <input
                            id="input-title"
                            type="text"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            placeholder={inputMode === 'schedule' ? '예: 전공 필수 멘토링 회의' : inputMode === 'goal' ? '달성하고자 하는 주요 과제' : '사용처 (예: 네이버 페이 - 서적)'}
                            className={`w-full bg-[#0d0d0f] px-0 py-2 text-lg font-bold tracking-tight text-slate-400 outline-none transition-all border-b ${hasInteracted && !formTitle.trim() ? 'border-red-500' : 'border-white/10 focus:border-indigo-500'}`}
                            aria-required="true"
                            aria-invalid={hasInteracted && !formTitle.trim()}
                        />
                    </div>

                    {/* Date & Time */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label htmlFor="input-date" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                                {inputMode === 'goal' ? '목표 마감일' : '기준 날짜'} *
                            </label>
                            <input
                                id="input-date"
                                type="date"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                className={`w-full bg-[#0d0d0f] px-0 py-2 text-sm font-bold tracking-tight text-indigo-600 outline-none transition-all border-b ${hasInteracted && !formDate ? 'border-red-500' : 'border-white/10 focus:border-indigo-500'}`}
                                aria-required="true"
                            />
                        </div>
                        {inputMode === 'schedule' && (
                            <>
                                <div className="flex-1">
                                    <label htmlFor="input-start-time" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">시작 시간</label>
                                    <input id="input-start-time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-bold tracking-tight text-indigo-600 outline-none transition-all" />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="input-end-time" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">종료 시간</label>
                                    <input id="input-end-time" type="time" value={scheduleEndTime} onChange={(e) => setScheduleEndTime(e.target.value)} className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-bold tracking-tight text-indigo-600 outline-none transition-all" />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Amount */}
                    {(inputMode === 'expense' || inputMode === 'income') && (
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="input-amount" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">가치 금액 *</label>
                                <div className={`flex items-center bg-[#0d0d0f] border-b overflow-hidden transition-all outline-none ${hasInteracted && (!inputValue || Number(inputValue) <= 0) ? 'border-red-500' : 'border-white/10 focus-within:border-indigo-500'}`}>
                                    <input
                                        id="input-amount"
                                        type="text"
                                        autoFocus
                                        value={inputValue ? Number(inputValue).toLocaleString() : ''}
                                        onChange={handleAmountChange}
                                        placeholder="0"
                                        className="w-full bg-transparent py-2.5 text-xl md:text-2xl font-bold tracking-tight text-rose-500 outline-none"
                                        aria-required="true"
                                        aria-label="금액"
                                    />
                                    <span className="font-bold text-slate-400 pl-2 select-none">원</span>
                                </div>
                            </div>

                            {/* #34 Quick amount buttons */}
                            <div className="flex gap-2 flex-wrap">
                                {[1, 5, 10, 30, 50].map(wan => (
                                    <button
                                        key={wan}
                                        type="button"
                                        onClick={() => setInputValue(prev => String((Number(prev) || 0) + wan * 10000))}
                                        className="flex-1 min-w-0 py-2 text-xs font-bold bg-[#111113] border border-white/10 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                                        style={{ borderRadius: '3px' }}
                                    >
                                        +{wan}만
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2.5 border-b border-white/10 py-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={taxDeductible} onChange={(e) => setTaxDeductible(e.target.checked)} className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500" />
                                    <span className="text-xs font-bold text-slate-400">연말정산/증빙 포함 (영수증)</span>
                                </label>
                                {inputMode === 'expense' && !isRecurring && (
                                    <div className="flex items-center gap-2 ml-auto">
                                        <span className="text-xs font-bold text-slate-500">할부</span>
                                        <select value={installmentMonths} onChange={(e) => setInstallmentMonths(parseInt(e.target.value))} className="bg-[#111113] border border-white/10 text-xs font-bold p-1 rounded">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                                <option key={m} value={m}>{m === 1 ? '일시불' : `${m}개월`}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Goal Type Selector */}
                    {inputMode === 'goal' && (
                        <div className="border-b border-white/6 py-3 space-y-2.5">
                            <div className="flex gap-2" role="group" aria-label="목표 유형">
                                {[{ value: 'short', label: '단기 수립' }, { value: 'mid', label: '중기 플랜' }, { value: 'long', label: '장기 비전' }].map(({ value, label }) => (
                                    <button key={value} onClick={() => setGoalType(value)} className={`flex-1 py-2 text-xs font-bold border transition-colors ${goalType === value ? 'bg-purple-500 text-white border-purple-500' : 'bg-[#111113] text-purple-400 border-white/10'}`} style={{ borderRadius: '3px' }}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2" role="group" aria-label="추적 방식">
                                <button onClick={() => setGoalTrackerType('checklist')} className={`flex-1 py-2 text-xs font-bold border transition-colors ${goalTrackerType === 'checklist' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-[#111113] text-indigo-400 border-white/10'}`} style={{ borderRadius: '3px' }}>체크리스트 기반</button>
                                <button onClick={() => setGoalTrackerType('numeric')} className={`flex-1 py-2 text-xs font-bold border transition-colors ${goalTrackerType === 'numeric' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-[#111113] text-indigo-400 border-white/10'}`} style={{ borderRadius: '3px' }}>수치 도달 (30+종)</button>
                            </div>
                            {goalTrackerType === 'numeric' && (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <select value={goalTrackerUnit} onChange={(e) => setGoalTrackerUnit(e.target.value)} className="w-full p-2.5 border border-white/10 outline-none text-xs font-bold text-slate-200 bg-[#111113]" style={{ borderRadius: '3px' }} aria-label="단위 선택">
                                            {TRACKER_UNITS.map((g) => (
                                                <optgroup key={g.category} label={g.category}>
                                                    {g.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <input type="number" value={goalTargetValue} onChange={(e) => setGoalTargetValue(e.target.value)} placeholder="목표 수치" className="w-full text-center bg-[#0d0d0f] border-b border-white/10 px-0 py-2 outline-none text-xs font-bold text-indigo-400 font-mono tabular-nums" aria-label="목표 수치" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Categories */}
                    {inputMode !== 'goal' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">카테고리 선택 *</label>
                                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="카테고리">
                                    {activeCategories.map((cat) => {
                                        const CatIconNode = IconMap[cat.icon] || IconMap['Check'];
                                        const isSelected = activeCategoryId === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => setActiveCategoryId(cat.id)}
                                                className={`flex flex-col items-center justify-center p-3 border transition-all ${isSelected ? (inputMode === 'expense' ? 'border-rose-500 bg-rose-500/20 text-rose-400' : inputMode === 'income' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-indigo-500 bg-indigo-500/10 text-indigo-400') : 'bg-[#111113] border-white/10 text-slate-500 hover:bg-white/10'}`}
                                                style={{ borderRadius: '3px' }}
                                            >
                                                <CatIconNode className="w-5 h-5 mb-1" aria-hidden="true" />
                                                <span className="text-[10px] font-bold truncate w-full text-center">{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {inputMode !== 'schedule' && (
                                <div>
                                    <label htmlFor="input-account" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">출금/수금 계좌 선택</label>
                                    <select id="input-account" value={formAccount} onChange={(e) => setFormAccount(e.target.value)} className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-bold text-slate-400 focus:border-rose-500 outline-none transition-colors">
                                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {inputMode === 'schedule' && (
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label htmlFor="input-location" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">장소 (선택)</label>
                                <input id="input-location" type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="예: 미래관 301호" className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-bold text-slate-400 focus:border-indigo-500 outline-none transition-all" />
                            </div>
                            <div className="w-1/3">
                                <label htmlFor="input-priority" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">중요도</label>
                                <select id="input-priority" value={schedulePriority} onChange={(e) => setSchedulePriority(e.target.value)} className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-bold text-slate-400 focus:border-indigo-500 outline-none transition-all">
                                    <option value="Low">낮음</option>
                                    <option value="Medium">보통</option>
                                    <option value="High">높음 (중요!)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor="input-memo" className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">추가 상세 기록 (선택)</label>
                        <textarea id="input-memo" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder={inputMode === 'schedule' ? '회의 준비물, 참고 문헌 등을 자세히 적어두세요.' : '구체적인 지출 내역이나 영수증 메모를 적어보세요.'} rows={2} className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm font-medium text-slate-400 resize-none focus:border-indigo-500 outline-none transition-all" />
                    </div>

                    {/* Recurring */}
                    {inputMode !== 'goal' && (
                        <div className="border-b border-white/10 py-3 flex flex-col gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 text-indigo-500 rounded border-slate-300 focus:ring-indigo-500" />
                                <span className="text-sm font-bold text-slate-200">정기적으로 반복되는 일정/가계부입니다 (자동 다수 생성)</span>
                            </label>
                            {isRecurring && (
                                <div className="flex flex-col gap-3 mt-1">
                                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="반복 주기">
                                        {['daily', 'weekdays', 'weekends', 'weekly', 'biweekly', 'custom_weekly', 'monthly', 'custom_monthly', 'yearly'].map((t) => (
                                            <button key={t} role="radio" aria-checked={recurringType === t} onClick={() => setRecurringType(t)} className={`flex-1 min-w-[30%] text-xs py-2 font-bold border transition ${recurringType === t ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' : 'border-white/10 text-slate-400'}`} style={{ borderRadius: '3px' }}>
                                                {t === 'daily' ? '매일' : t === 'weekdays' ? '평일' : t === 'weekends' ? '주말' : t === 'weekly' ? '매주' : t === 'biweekly' ? '격주' : t === 'monthly' ? '매월' : t === 'yearly' ? '매년' : t === 'custom_weekly' ? '주간 여러개' : '월간 여러개'}
                                            </button>
                                        ))}
                                    </div>

                                    {(recurringType === 'custom_weekly' || recurringType === 'custom_monthly') && (
                                        <div className="border-b border-white/10 py-3 space-y-2 mt-2">
                                            <span className="text-[10px] font-bold text-slate-400">조건 추가 갯수 제한은 없습니다. 자유롭게 등록하세요!</span>
                                            {customRecurringDays.map((item) => (
                                                <div key={item.id} className="flex gap-2 items-center flex-wrap">
                                                    {recurringType === 'custom_weekly' ? (
                                                        <select value={item.val} onChange={(e) => { const nd = [...customRecurringDays]; const found = nd.find((x) => x.id === item.id); if (found) found.val = e.target.value; setCustomRecurringDays(nd); }} className="p-2 rounded border border-white/10 bg-[#111113] text-xs font-bold w-20 outline-none text-slate-400" aria-label="요일 선택">
                                                            <option value={0}>일요일</option><option value={1}>월요일</option><option value={2}>화요일</option><option value={3}>수요일</option><option value={4}>목요일</option><option value={5}>금요일</option><option value={6}>토요일</option>
                                                        </select>
                                                    ) : (
                                                        <select value={item.val} onChange={(e) => { const nd = [...customRecurringDays]; const found = nd.find((x) => x.id === item.id); if (found) found.val = e.target.value; setCustomRecurringDays(nd); }} className="p-2 rounded border border-white/10 bg-[#111113] text-xs font-bold w-20 outline-none text-slate-400" aria-label="날짜 선택">
                                                            {[...Array(31)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
                                                        </select>
                                                    )}
                                                    {inputMode === 'schedule' && (
                                                        <div className="flex items-center gap-1">
                                                            <input type="time" value={item.time} onChange={(e) => { const nd = [...customRecurringDays]; const found = nd.find((x) => x.id === item.id); if (found) found.time = e.target.value; setCustomRecurringDays(nd); }} className="p-2 rounded border border-white/10 bg-[#111113] text-xs font-bold text-slate-400" aria-label="시작 시간" />
                                                            <span className="text-xs font-bold text-slate-400" aria-hidden="true">-</span>
                                                            <input type="time" value={item.endTime} onChange={(e) => { const nd = [...customRecurringDays]; const found = nd.find((x) => x.id === item.id); if (found) found.endTime = e.target.value; setCustomRecurringDays(nd); }} className="p-2 rounded border border-white/10 bg-[#111113] text-xs font-bold text-slate-400" aria-label="종료 시간" />
                                                        </div>
                                                    )}
                                                    <button onClick={() => setCustomRecurringDays(customRecurringDays.filter((x) => x.id !== item.id))} className="text-rose-500 font-bold ml-auto text-xs active:scale-95" aria-label="조건 삭제">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => setCustomRecurringDays([...customRecurringDays, { id: generateId(), val: 1, time: '09:00', endTime: '10:00' }])} className="w-full text-xs font-bold bg-indigo-500 text-white py-2 hover:bg-indigo-400 active:scale-95 transition mt-2" style={{ borderRadius: '3px' }}>
                                                + 리스트 추가
                                            </button>
                                        </div>
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                                        <input type="checkbox" checked={excludeHolidays} onChange={(e) => setExcludeHolidays(e.target.checked)} className="w-4 h-4 text-indigo-500 rounded border-slate-300 focus:ring-indigo-500" />
                                        <span className="text-xs font-bold text-slate-400">법정 공휴일은 건너뛰기</span>
                                    </label>
                                    <div className="flex items-center gap-2 border-b border-white/10 py-2">
                                        <span className="text-xs font-bold text-slate-400">총 생성 횟수</span>
                                        <input type="number" min="2" max="365" value={recurringCount} onChange={(e) => setRecurringCount(e.target.value)} className="w-16 bg-[#111113] border border-white/10 text-center py-1 rounded text-sm font-bold tracking-tight text-indigo-500 outline-none" aria-label="반복 횟수" />
                                        <span className="text-xs font-bold text-slate-400">회 ({recurringType === 'daily' ? '일' : recurringType === 'weekly' ? '주' : '개월'} 동안)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-3 bg-[#111113] border-t border-white/10 shrink-0">
                    <button onClick={handleConfirmSave} className={`w-full py-2.5 font-bold tracking-tight text-white text-base transition-all active:scale-[0.98] ${inputMode === 'expense' ? 'bg-rose-500 hover:bg-rose-400' : inputMode === 'income' ? 'bg-blue-500 hover:bg-blue-400' : inputMode === 'goal' ? 'bg-purple-500 hover:bg-purple-400' : 'bg-indigo-500 hover:bg-indigo-400'}`} style={{ borderRadius: '3px' }}>
                        기록 추가 등록하기
                    </button>
                </div>
            </div>
        </div>
    );
}

InputModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    filterDateStr: PropTypes.string.isRequired,
    displayDate: PropTypes.string.isRequired,
    expenseCategories: PropTypes.array.isRequired,
    incomeCategories: PropTypes.array.isRequired,
    scheduleCategories: PropTypes.array.isRequired,
    accounts: PropTypes.array.isRequired,
    setTransactions: PropTypes.func.isRequired,
    setSchedules: PropTypes.func.isRequired,
    setGoals: PropTypes.func.isRequired,
    goals: PropTypes.array.isRequired,
};
