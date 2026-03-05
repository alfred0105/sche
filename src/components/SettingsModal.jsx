import React, { useState } from 'react';
import { IconMap } from './IconMap';

import { supabase } from '../supabaseClient';

export default function SettingsModal({
    close, expenseCategories, incomeCategories, scheduleCategories,
    addCategory, deleteCategory, accounts, addAccount, updateAccount, deleteAccount,
    userProfile, setUserProfile, session
}) {
    const { Settings, X, Trash2, Plus } = IconMap;
    const [activeTab, setActiveTab] = useState('categories');
    const [catType, setCatType] = useState('expense');
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('Check');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('cash'); // cash, bank, savings, investment

    const iconOptions = ['Briefcase', 'BookOpen', 'Coffee', 'ShoppingBag', 'Utensils', 'Train', 'Target', 'Calendar', 'Flag', 'PieChart', 'Check', 'Wallet'];

    const cats = catType === 'expense' ? expenseCategories : catType === 'income' ? incomeCategories : scheduleCategories;

    const handleAddCat = () => {
        if (!newCatName.trim()) return;
        addCategory(catType, { id: Date.now().toString(), label: newCatName, icon: newCatIcon });
        setNewCatName('');
    };

    const handleAddAccount = () => {
        if (!newAccountName.trim()) return;
        addAccount({ id: `bank_${Date.now()}`, name: newAccountName, type: newAccountType });
        setNewAccountName('');
        setNewAccountType('cash');
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 fade-in">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={close}></div>
            <div className="relative glass-card bg-white dark:bg-darkCard w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:h-[650px] h-[85vh]">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5 z-10 glass">
                    <h3 className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-white"><Settings className="w-6 h-6 text-indigo-500" /> 화면 및 맞춤 설정</h3>
                    <button onClick={close} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="flex border-b border-slate-100 dark:border-white/5">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>프로필/테마</button>
                    <button onClick={() => setActiveTab('categories')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'categories' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>카테고리 설정</button>
                    <button onClick={() => setActiveTab('accounts')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'accounts' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>자산 계좌</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-[#0f1115]">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 slide-up">
                            <div className="glass-card p-5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">사용자 이름 설정</h4>
                                <input value={userProfile.name} onChange={e => setUserProfile(p => ({ ...p, name: e.target.value }))} placeholder="이름을 입력하세요" className="w-full bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-colors" />
                            </div>

                            <div className="glass-card p-5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">디스플레이 테마</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {['light', 'dark', 'system'].map(t => (
                                        <button key={t} onClick={() => setUserProfile(p => ({ ...p, theme: t }))} className={`py-3 rounded-xl text-sm font-bold border transition-all ${userProfile.theme === t ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0f1115] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                                            {t === 'light' ? '밝은 화면' : t === 'dark' ? '어두운 화면' : '시스템 설정'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {session && (
                                <div className="glass-card p-5 space-y-4">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">계정 관리</h4>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0f1115] rounded-xl border border-slate-200 dark:border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                                                {session.user.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">연결된 계정</span>
                                                <span className="text-xs text-slate-500">{session.user.email}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (supabase) await supabase.auth.signOut();
                                            }}
                                            className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors"
                                        >
                                            로그아웃
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'categories' && (
                        <div className="space-y-6">
                            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl">
                                {['expense', 'income', 'schedule'].map(t => (
                                    <button key={t} onClick={() => setCatType(t)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${catType === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>
                                        {t === 'expense' ? '지출' : t === 'income' ? '수입' : '일정'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {cats.map(c => {
                                    const IconNode = IconMap[c.icon] || IconMap['Check'];
                                    return (
                                        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <IconNode className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="text-xs font-bold text-slate-700 truncate">{c.label}</span>
                                            </div>
                                            <button onClick={() => deleteCategory(catType, c.id)} className="text-rose-300 hover:text-rose-500 shrink-0 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="text-sm font-bold text-slate-800">새 카테고리 추가</h4>
                                <div className="grid grid-cols-6 gap-2">
                                    {iconOptions.map(ico => {
                                        const IcoNode = IconMap[ico] || IconMap['Check'];
                                        return (
                                            <button key={ico} onClick={() => setNewCatIcon(ico)} className={`p-2 rounded-lg flex justify-center border transition-all ${newCatIcon === ico ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                <IcoNode className="w-4 h-4" />
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="카테고리 이름" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                                    <button onClick={handleAddCat} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition flex items-center gap-1"><Plus className="w-4 h-4" /> 추가</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'accounts' && (
                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h4 className="text-sm font-bold text-slate-800">새 자산 계좌 추가</h4>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full">
                                    {[
                                        { id: 'cash', label: '현금' },
                                        { id: 'bank', label: '입출금' },
                                        { id: 'savings', label: '예/적금' },
                                        { id: 'investment', label: '투자' }
                                    ].map(t => (
                                        <button key={t.id} onClick={() => setNewAccountType(t.id)} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${newAccountType === t.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="예: 토스뱅크 파킹통장" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                                    <button onClick={handleAddAccount} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-indigo-700 transition flex items-center gap-1 shrink-0"><Plus className="w-4 h-4" /> 추가</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-slate-800 px-1 pt-2">등록된 자산 계좌 <span className="text-xs text-slate-400 font-normal ml-2 tracking-tighter">유형 변경은 불가합니다.</span></h4>
                                {accounts.map(acc => (
                                    <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black tracking-tighter text-indigo-500 bg-indigo-50 px-2 flex items-center justify-center py-0.5 rounded-lg border border-indigo-100">
                                                        {acc.type === 'savings' ? '저축/청약' : acc.type === 'investment' ? '투자' : acc.type === 'bank' ? '입출금' : '현금'}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-800">{acc.name}</span>
                                                </div>

                                                {/* Investment Specific Settings */}
                                                {acc.type === 'investment' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input
                                                            value={acc.ticker || ''}
                                                            onChange={e => updateAccount(acc.id, { ticker: e.target.value.toUpperCase() })}
                                                            placeholder="티커 (예: AAPL, BTC)"
                                                            className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none"
                                                        />
                                                        <span className="text-xs text-slate-400">×</span>
                                                        <input
                                                            type="number"
                                                            value={acc.holdings || ''}
                                                            onChange={e => updateAccount(acc.id, { holdings: Number(e.target.value) })}
                                                            placeholder="보유량"
                                                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                )}

                                                {/* Savings Specific Settings */}
                                                {acc.type === 'savings' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <select
                                                            value={acc.interestCycle || 'daily'}
                                                            onChange={e => updateAccount(acc.id, { interestCycle: e.target.value })}
                                                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none"
                                                        >
                                                            <option value="daily">매일 지급</option>
                                                            <option value="monthly">매월 지급</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={acc.interestRate || ''}
                                                            onChange={e => updateAccount(acc.id, { interestRate: Number(e.target.value) })}
                                                            placeholder="연 이자율(%)"
                                                            className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            {!acc.default && (
                                                <button onClick={() => deleteAccount(acc.id)} className="text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-50 p-1.5 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
