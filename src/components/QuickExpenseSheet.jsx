/**
 * @fileoverview QuickExpenseSheet — iPhone 최적화 빠른 지출/수입 입력
 * 바텀 시트 + 커스텀 숫자 패드 방식으로 3초 내 입력 완료
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { generateId } from '../utils/helpers';
import { IconMap } from './IconMap';

// 계좌 타입 이모지
const ACCOUNT_EMOJI = { cash: '💵', bank: '🏦', savings: '🐷', investment: '📈' };

// 자주 쓰는 빠른 금액
const QUICK_AMOUNTS = [1000, 3000, 5000, 10000, 30000, 50000];

// 숫자패드 배열
const NUMPAD_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['⌫', '0', '00'],
];

export default function QuickExpenseSheet({
    isOpen,
    onClose,
    onOpenDetail,        // 상세 입력 모달 열기 콜백
    setTransactions,
    accounts,
    expenseCategories,
    incomeCategories,
}) {
    const { X } = IconMap;

    const [type, setType] = useState('expense');   // 'expense' | 'income' | 'transfer'
    const [amount, setAmount] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [transferToAccountId, setTransferToAccountId] = useState('');
    const [memo, setMemo] = useState('');
    const [showMemo, setShowMemo] = useState(false);

    const activeCategories = type === 'expense' ? expenseCategories : incomeCategories;

    // 열릴 때 초기화
    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setMemo('');
            setShowMemo(false);
            setType('expense');
            setSelectedAccountId(accounts[0]?.id || 'cash');
            setTransferToAccountId(accounts[1]?.id || accounts[0]?.id || 'cash');
        }
    }, [isOpen, accounts]);

    // 카테고리 초기값: type 바뀔 때마다 첫 번째로
    useEffect(() => {
        setSelectedCat(activeCategories[0]?.id || '');
    }, [type, activeCategories]);

    // ── 숫자패드 ──────────────────────────────────────────────────────────────
    const handleNumpad = useCallback((key) => {
        if (key === '⌫') {
            setAmount(prev => prev.slice(0, -1));
        } else if (key === '00') {
            setAmount(prev => (prev ? prev + '00' : ''));
        } else {
            setAmount(prev => {
                const next = prev + key;
                return next.length > 9 ? prev : next; // 최대 9자리
            });
        }
    }, []);

    // ── 빠른 금액 추가 ────────────────────────────────────────────────────────
    const handleQuickAmount = useCallback((val) => {
        setAmount(prev => {
            const sum = (Number(prev) || 0) + val;
            return sum > 999999999 ? prev : String(sum);
        });
    }, []);

    // ── 저장 ──────────────────────────────────────────────────────────────────
    const handleSave = useCallback(() => {
        const amt = Number(amount);
        if (!amt || amt <= 0) { toast.error('금액을 입력해주세요'); return; }

        const now = format(new Date(), 'yyyy-MM-dd');
        const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        if (type === 'transfer') {
            if (selectedAccountId === transferToAccountId) { toast.error('출금·입금 계좌가 같습니다'); return; }
            const fromAcc = accounts.find(a => a.id === selectedAccountId);
            const toAcc = accounts.find(a => a.id === transferToAccountId);
            const label = `이체: ${fromAcc?.name || ''} → ${toAcc?.name || ''}`;
            const transferId = generateId();
            setTransactions(prev => [...prev,
                { id: generateId(), type: 'transfer_out', title: label, amount: amt, date: now, time: timeStr, category: '계좌이체', accountId: selectedAccountId, transferId, memo },
                { id: generateId(), type: 'transfer_in', title: label, amount: amt, date: now, time: timeStr, category: '계좌이체', accountId: transferToAccountId, transferId, memo },
            ]);
            toast.success(`₩${amt.toLocaleString()} 이체 완료!`, { icon: '↔️', duration: 2000 });
        } else {
            const cat = activeCategories.find(c => c.id === selectedCat);
            const catLabel = cat?.label || '기타';
            setTransactions(prev => [{ id: generateId(), type, title: catLabel, category: catLabel, amount: amt, memo, date: now, time: timeStr, accountId: selectedAccountId || accounts[0]?.id || 'cash', taxDeductible: false }, ...prev]);
            toast.success(`${catLabel} ${amt.toLocaleString()}원 저장됨`, { icon: type === 'expense' ? '💸' : '💰', duration: 2000 });
        }

        setAmount('');
        setMemo('');
        setShowMemo(false);
        onClose();
    }, [amount, type, selectedCat, memo, accounts, activeCategories, selectedAccountId, transferToAccountId, setTransactions, onClose]);

    const displayAmount = amount ? Number(amount).toLocaleString('ko-KR') : '0';
    const amtColorClass = type === 'expense' ? 'text-rose-400' : type === 'transfer' ? 'text-amber-400' : 'text-blue-400';

    if (!isOpen) return null;

    return (
        <>
                    {/* 배경 딤 */}
                    <div
                        onClick={onClose}
                        className="fixed inset-0 z-[90] bg-black/60"
                    />

                    {/* 시트 */}
                    <div
                        className="fixed bottom-0 left-0 right-0 z-[100] bg-[#111113] border-t border-white/10 overflow-hidden"
                        style={{ borderRadius: '8px 8px 0 0', maxWidth: '480px', margin: '0 auto' }}
                    >
                        {/* 드래그 핸들 */}
                        <div className="flex justify-center pt-3">
                            <div className="w-10 h-1 bg-white/20" style={{ borderRadius: '2px' }} />
                        </div>

                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-3 pt-3 pb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">빠른 입력</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { onClose(); onOpenDetail?.(); }}
                                    className="text-xs text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                                >
                                    상세 입력 →
                                </button>
                                <button onClick={onClose} className="p-1.5 hover:bg-white/10" style={{ borderRadius: '3px' }}>
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* 지출 / 수입 / 이체 토글 */}
                        <div className="flex gap-2 px-3 pt-2 pb-3">
                            {[
                                { id: 'expense', label: '💸 지출', active: 'bg-rose-500 text-white', inactive: 'bg-white/5 text-slate-400' },
                                { id: 'income', label: '💰 수입', active: 'bg-blue-500 text-white', inactive: 'bg-white/5 text-slate-400' },
                                { id: 'transfer', label: '↔ 이체', active: 'bg-amber-500 text-white', inactive: 'bg-white/5 text-slate-400' },
                            ].map(({ id, label, active, inactive }) => (
                                <button
                                    key={id}
                                    onClick={() => setType(id)}
                                    className={`flex-1 py-2.5 text-sm font-bold transition-all active:scale-95 ${type === id ? active : inactive}`}
                                    style={{ borderRadius: '3px' }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* 금액 표시 */}
                        <div className="px-3 py-2 text-center">
                            <div className={`text-5xl font-black tracking-tight ${amtColorClass} ${!amount ? 'opacity-30' : ''}`}>
                                {displayAmount}
                                <span className="text-2xl font-bold ml-2 text-slate-500">원</span>
                            </div>
                        </div>

                        {/* 빠른 금액 버튼 */}
                        <div className="flex gap-2 px-3 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                            {QUICK_AMOUNTS.map(val => (
                                <button
                                    key={val}
                                    onClick={() => handleQuickAmount(val)}
                                    className="flex-shrink-0 px-3 py-1.5 bg-white/5 text-xs font-bold text-slate-400 hover:bg-white/10 active:scale-95 transition-all border border-white/10"
                                    style={{ borderRadius: '3px' }}
                                >
                                    +{val >= 10000 ? `${val / 10000}만` : val.toLocaleString()}
                                </button>
                            ))}
                        </div>

                        {type === 'transfer' ? (
                            /* 이체: 출금 → 입금 계좌 선택 */
                            <div className="px-3 pb-3 space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">출금 계좌 (보내는 곳)</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                                        {accounts.map(acc => (
                                            <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
                                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-all active:scale-95 ${selectedAccountId === acc.id ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                style={{ borderRadius: '3px' }}>
                                                <span>{ACCOUNT_EMOJI[acc.type] || '🏦'}</span>
                                                <span className="max-w-[80px] truncate">{acc.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">입금 계좌 (받는 곳)</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                                        {accounts.map(acc => (
                                            <button key={acc.id} onClick={() => setTransferToAccountId(acc.id)}
                                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-all active:scale-95 ${transferToAccountId === acc.id ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                style={{ borderRadius: '3px' }}>
                                                <span>{ACCOUNT_EMOJI[acc.type] || '🏦'}</span>
                                                <span className="max-w-[80px] truncate">{acc.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* 계좌 선택 칩 */}
                                <div className="px-3 pb-1">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">계좌</p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                                        {accounts.map(acc => {
                                            const emoji = ACCOUNT_EMOJI[acc.type] || '🏦';
                                            const isSelected = selectedAccountId === acc.id;
                                            return (
                                                <button key={acc.id} onClick={() => setSelectedAccountId(acc.id)}
                                                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-all active:scale-95 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                    style={{ borderRadius: '3px' }}>
                                                    <span>{emoji}</span>
                                                    <span className="max-w-[80px] truncate">{acc.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 카테고리 칩 */}
                                <div className="px-3 pb-1">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">카테고리</p>
                                </div>
                                <div className="flex gap-2 px-3 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                                    {activeCategories.map(cat => {
                                        const CatIcon = IconMap[cat.icon] || IconMap['Check'];
                                        const isSelected = selectedCat === cat.id;
                                        return (
                                            <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                                                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-bold transition-all active:scale-95 ${isSelected ? type === 'expense' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                                style={{ borderRadius: '3px' }}>
                                                <CatIcon size={13} />
                                                <span>{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* 메모 */}
                        <div className="px-3 pb-2">
                            {showMemo ? (
                                <input
                                    type="text"
                                    value={memo}
                                    onChange={e => setMemo(e.target.value)}
                                    placeholder="메모 (선택)"
                                    className="w-full bg-[#0d0d0f] border-b border-white/10 px-0 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                                    autoFocus
                                />
                            ) : (
                                <button
                                    onClick={() => setShowMemo(true)}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
                                >
                                    + 메모 추가
                                </button>
                            )}
                        </div>

                        {/* 숫자 패드 */}
                        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                            {NUMPAD_ROWS.flat().map((key, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleNumpad(key)}
                                    className={`h-14 font-bold text-xl transition-all active:scale-95 select-none ${
                                        key === '⌫'
                                            ? 'bg-white/5 text-rose-400 text-2xl'
                                            : 'bg-white/8 text-white hover:bg-white/15'
                                    }`}
                                    style={{ borderRadius: '3px' }}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>

                        {/* 저장 버튼 */}
                        <div className="px-3 pb-10">
                            <button
                                onClick={handleSave}
                                disabled={!amount}
                                className={`w-full py-2.5 text-lg font-bold text-white transition-all active:scale-[0.98] disabled:opacity-30 ${
                                    type === 'expense' ? 'bg-rose-500 hover:bg-rose-400'
                                    : type === 'transfer' ? 'bg-amber-500 hover:bg-amber-400'
                                    : 'bg-blue-500 hover:bg-blue-400'
                                }`}
                                style={{ borderRadius: '3px' }}
                            >
                                {amount
                                    ? `${Number(amount).toLocaleString()}원 ${type === 'transfer' ? '이체' : '저장'}`
                                    : '금액을 입력하세요'}
                            </button>
                        </div>
                    </div>
        </>
    );
}
