import { useState, useMemo, useRef } from 'react';
import { IconMap } from './IconMap';
import { toast } from 'react-hot-toast';
import { supabase } from '../supabaseClient';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

const ACCENT_COLORS = [
    { id: 'indigo', label: '인디고', hex: '#6366f1' },
    { id: 'violet', label: '바이올렛', hex: '#8b5cf6' },
    { id: 'blue', label: '블루', hex: '#3b82f6' },
    { id: 'emerald', label: '에메랄드', hex: '#10b981' },
    { id: 'rose', label: '로즈', hex: '#f43f5e' },
    { id: 'amber', label: '앰버', hex: '#f59e0b' },
];

export default function SettingsModal({
    close,
    expenseCategories, incomeCategories, scheduleCategories,
    addCategory, deleteCategory,
    accounts, addAccount, updateAccount, deleteAccount,
    userProfile, setUserProfile,
    session,
    transactions = [], schedules = [], goals = [],
    studies = [], reviews = [], budgets = {},
    setTransactions, setSchedules, setGoals, setStudies, setReviews, setBudgets,
}) {
    const { Settings, X, Trash2, Plus, Download, Upload, MessageCircle, HardDrive } = IconMap;
    const [activeTab, setActiveTab] = useState('profile');
    const [catType, setCatType] = useState('expense');
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('Check');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('cash');
    const [telegramLoading, setTelegramLoading] = useState(false);
    const importRef = useRef(null);

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

    // #86: Real Telegram API
    const handleTelegramTest = async () => {
        const token = userProfile?.telegramToken?.trim();
        const chatId = userProfile?.telegramChatId?.trim();
        if (!token || !chatId) {
            toast.error('Bot Token과 Chat ID를 모두 입력해주세요.', { icon: '⚠️' });
            return;
        }
        setTelegramLoading(true);
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '✅ 올라운더 텔레그램 알림 연동 테스트 메시지입니다!\n\n일정 리마인더 및 예산 초과 알림이 이 채널로 전송됩니다.',
                    parse_mode: 'HTML',
                }),
            });
            const data = await res.json();
            if (data.ok) {
                toast.success('텔레그램 메시지 발송 성공!', { icon: '✈️' });
            } else {
                toast.error(`발송 실패: ${data.description || '알 수 없는 오류'}`, { icon: '⚠️' });
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다. CORS 설정을 확인하세요.', { icon: '⚠️' });
        } finally {
            setTelegramLoading(false);
        }
    };

    // #90: JSON Export
    const handleJsonExport = () => {
        const payload = {
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            data: { transactions, schedules, goals, studies, reviews, budgets, accounts, userProfile },
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `allrounder_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('JSON 백업 파일이 다운로드되었습니다!', { icon: '💾' });
    };

    // #90: JSON Import
    const handleJsonImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed.data) throw new Error('올바른 백업 파일 형식이 아닙니다.');
                const d = parsed.data;
                if (d.transactions) setTransactions(d.transactions);
                if (d.schedules) setSchedules(d.schedules);
                if (d.goals) setGoals(d.goals);
                if (d.studies) setStudies(d.studies);
                if (d.reviews) setReviews(d.reviews);
                if (d.budgets) setBudgets(d.budgets);
                toast.success('데이터가 성공적으로 복원되었습니다!', { icon: '✅' });
            } catch (err) {
                toast.error(`복원 실패: ${err.message}`, { icon: '⚠️' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // #99: Storage usage
    const storageInfo = useMemo(() => {
        try {
            let totalBytes = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const val = localStorage.getItem(key) || '';
                totalBytes += (key.length + val.length) * 2; // UTF-16
            }
            const kb = (totalBytes / 1024).toFixed(1);
            const maxKb = 5120; // 5MB typical localStorage limit
            const pct = Math.min(100, ((totalBytes / 1024) / maxKb) * 100);
            return { kb, pct };
        } catch {
            return { kb: '?', pct: 0 };
        }
    }, []);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 fade-in">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={close} />
            <div className="relative glass-card bg-[#111113] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:h-[680px] h-[88vh]">
                <div className="flex justify-between items-center p-4 md:p-5 border-b border-white/10 z-10 glass">
                    <h3 className="font-bold tracking-tight text-xl flex items-center gap-2 text-slate-100">
                        <Settings className="w-6 h-6 text-indigo-500" /> 화면 및 맞춤 설정
                    </h3>
                    <button onClick={close} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex border-b border-white/10 overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0">
                    {['profile', 'categories', 'accounts', 'integration'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 text-xs md:text-sm font-bold whitespace-nowrap px-2 transition-colors ${activeTab === tab ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-white/5'}`}
                        >
                            {tab === 'profile' ? '프로필/테마' : tab === 'categories' ? '카테고리' : tab === 'accounts' ? '자산 계좌' : '외부연동'}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-[#09090b]">

                    {/* ====== PROFILE / THEME ====== */}
                    {activeTab === 'profile' && (
                        <div className="space-y-5 slide-up">
                            {/* Name */}
                            <div className="glass-card p-5 space-y-3">
                                <h4 className="text-sm font-bold text-slate-400">사용자 이름</h4>
                                <input
                                    value={userProfile.name}
                                    onChange={e => setUserProfile(p => ({ ...p, name: e.target.value }))}
                                    placeholder="이름을 입력하세요"
                                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none transition-colors"
                                />
                            </div>

                            {/* Theme */}
                            <div className="glass-card p-5 space-y-3">
                                <h4 className="text-sm font-bold text-slate-400">디스플레이 테마</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {['light', 'dark', 'system'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setUserProfile(p => ({ ...p, theme: t }))}
                                            className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${userProfile.theme === t ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-white/10 bg-[#09090b] text-slate-500 hover:bg-white/5'}`}
                                        >
                                            {t === 'light' ? '☀️ 밝은 화면' : t === 'dark' ? '🌙 어두운 화면' : '⚙️ 시스템'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* #87: Accent Color */}
                            <div className="glass-card p-5 space-y-3">
                                <h4 className="text-sm font-bold text-slate-400">포인트 컬러</h4>
                                <div className="flex gap-3 flex-wrap">
                                    {ACCENT_COLORS.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setUserProfile(p => ({ ...p, accent: c.id }))}
                                            title={c.label}
                                            className={`w-10 h-10 rounded-full transition-all ${(userProfile.accent || 'indigo') === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111113] scale-110' : 'opacity-50 hover:opacity-90 hover:scale-105'}`}
                                            style={{ backgroundColor: c.hex }}
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-600">선택: {ACCENT_COLORS.find(c => c.id === (userProfile.accent || 'indigo'))?.label}</p>
                            </div>

                            {/* Account */}
                            {session && (
                                <div className="glass-card p-5 space-y-3">
                                    <h4 className="text-sm font-bold text-slate-400">계정 관리</h4>
                                    <div className="flex items-center justify-between p-3 bg-[#09090b] rounded-xl border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400">
                                                {session.user.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-400">연결된 계정</span>
                                                <span className="text-xs text-slate-500">{session.user.email}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => { if (supabase) await supabase.auth.signOut(); }}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold rounded-lg transition-colors"
                                        >
                                            로그아웃
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* #99 + #100: Storage + Version */}
                            <div className="glass-card p-5 space-y-3">
                                <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <HardDrive className="w-4 h-4" /> 데이터 사용량
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                                        <span>로컬 저장 공간 사용</span>
                                        <span>{storageInfo.kb} KB / 5,120 KB</span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-2 rounded-full bg-indigo-500 transition-all duration-700"
                                            style={{ width: `${storageInfo.pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-600">{storageInfo.pct.toFixed(1)}% 사용 중</p>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[11px] text-slate-600">앱 버전</span>
                                    <span className="text-[11px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">v{APP_VERSION}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ====== CATEGORIES ====== */}
                    {activeTab === 'categories' && (
                        <div className="space-y-6">
                            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl">
                                {['expense', 'income', 'schedule'].map(t => (
                                    <button key={t} onClick={() => setCatType(t)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${catType === t ? 'bg-white shadow-none text-indigo-600' : 'text-slate-500'}`}>
                                        {t === 'expense' ? '지출' : t === 'income' ? '수입' : '일정'}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {cats.map(c => {
                                    const IconNode = IconMap[c.icon] || IconMap['Check'];
                                    return (
                                        <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-none">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <IconNode className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="text-xs font-bold text-slate-700 truncate">{c.label}</span>
                                            </div>
                                            <button onClick={() => deleteCategory(catType, c.id)} className="text-rose-300 hover:text-rose-500 shrink-0 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-none space-y-4">
                                <h4 className="text-sm font-bold text-slate-800">새 카테고리 추가</h4>
                                <div className="grid grid-cols-6 gap-2">
                                    {iconOptions.map(ico => {
                                        const IcoNode = IconMap[ico] || IconMap['Check'];
                                        return (
                                            <button key={ico} onClick={() => setNewCatIcon(ico)} className={`p-2 rounded-lg flex justify-center border transition-all ${newCatIcon === ico ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                <IcoNode className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCat()} placeholder="카테고리 이름" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                                    <button onClick={handleAddCat} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition flex items-center gap-1"><Plus className="w-4 h-4" /> 추가</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ====== ACCOUNTS ====== */}
                    {activeTab === 'accounts' && (
                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-none space-y-4">
                                <h4 className="text-sm font-bold text-slate-800">새 자산 계좌 추가</h4>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full">
                                    {[
                                        { id: 'cash', label: '현금' },
                                        { id: 'bank', label: '입출금' },
                                        { id: 'savings', label: '예/적금' },
                                        { id: 'investment', label: '투자' }
                                    ].map(t => (
                                        <button key={t.id} onClick={() => setNewAccountType(t.id)} className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${newAccountType === t.id ? 'bg-white shadow-none text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={newAccountName} onChange={e => setNewAccountName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAccount()} placeholder="예: 토스뱅크 파킹통장" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                                    <button onClick={handleAddAccount} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-indigo-700 transition flex items-center gap-1 shrink-0"><Plus className="w-4 h-4" /> 추가</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-slate-800 px-1 pt-2">등록된 자산 계좌 <span className="text-xs text-slate-400 font-normal ml-2 tracking-tighter">유형 변경은 불가합니다.</span></h4>
                                {accounts.map(acc => (
                                    <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-none flex flex-col gap-3 group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold tracking-tighter text-indigo-500 bg-indigo-50 px-2 flex items-center justify-center py-0.5 rounded-lg border border-indigo-100">
                                                        {acc.type === 'savings' ? '저축/청약' : acc.type === 'investment' ? '투자' : acc.type === 'bank' ? '입출금' : '현금'}
                                                    </span>
                                                    <span className="text-sm font-bold text-slate-800">{acc.name}</span>
                                                </div>
                                                {acc.type === 'investment' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <input value={acc.ticker || ''} onChange={e => updateAccount(acc.id, { ticker: e.target.value.toUpperCase() })} placeholder="티커 (예: AAPL)" className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none" />
                                                        <span className="text-xs text-slate-400">×</span>
                                                        <input type="number" value={acc.holdings || ''} onChange={e => updateAccount(acc.id, { holdings: Number(e.target.value) })} placeholder="보유량" className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none" />
                                                    </div>
                                                )}
                                                {acc.type === 'savings' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <select value={acc.interestCycle || 'daily'} onChange={e => updateAccount(acc.id, { interestCycle: e.target.value })} className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none">
                                                            <option value="daily">매일 지급</option>
                                                            <option value="monthly">매월 지급</option>
                                                        </select>
                                                        <input type="number" value={acc.interestRate || ''} onChange={e => updateAccount(acc.id, { interestRate: Number(e.target.value) })} placeholder="연 이자율(%)" className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-500 outline-none" />
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

                    {/* ====== INTEGRATION / DATA ====== */}
                    {activeTab === 'integration' && (
                        <div className="space-y-5 slide-up">
                            {/* #86: Telegram */}
                            <div className="glass-card p-5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-indigo-500" /> 텔레그램 (Telegram) 알림
                                </h4>
                                <p className="text-xs font-medium text-slate-500 bg-[#111113] p-3 rounded-xl border border-white/10">
                                    @BotFather에서 발급받은 봇 토큰과 Chat ID를 입력하세요. 일정 리마인더 및 예산 초과 시 알림을 받습니다.
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Bot Token</label>
                                        <input
                                            value={userProfile?.telegramToken || ''}
                                            onChange={e => setUserProfile(p => ({ ...p, telegramToken: e.target.value }))}
                                            placeholder="예: 123456789:ABCDefGHIJKlmNOPQrsTUVwxyZ"
                                            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-500 outline-none transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Chat ID</label>
                                        <input
                                            value={userProfile?.telegramChatId || ''}
                                            onChange={e => setUserProfile(p => ({ ...p, telegramChatId: e.target.value }))}
                                            placeholder="예: 987654321"
                                            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-500 outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleTelegramTest}
                                    disabled={telegramLoading}
                                    className="w-full bg-[#111113] border border-white/10 hover:border-indigo-500/50 hover:bg-white/5 text-indigo-400 font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {telegramLoading ? (
                                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <MessageCircle className="w-4 h-4" />
                                    )}
                                    {telegramLoading ? '발송 중...' : '테스트 메시지 발송'}
                                </button>
                            </div>

                            {/* #90: JSON Backup/Restore */}
                            <div className="glass-card p-5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <HardDrive className="w-5 h-5 text-violet-400" /> JSON 데이터 백업 및 복원
                                </h4>
                                <p className="text-xs font-medium text-slate-500 bg-[#111113] p-3 rounded-xl border border-white/10">
                                    모든 데이터를 JSON 파일로 백업하고, 나중에 복원할 수 있습니다. 기기 이전 시 유용합니다.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleJsonExport}
                                        className="flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-400 font-bold py-3 rounded-xl text-sm transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> 백업 (.json)
                                    </button>
                                    <button
                                        onClick={() => importRef.current?.click()}
                                        className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 rounded-xl text-sm transition-colors"
                                    >
                                        <Upload className="w-4 h-4" /> 복원 (.json)
                                    </button>
                                    <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />
                                </div>
                            </div>

                            {/* CSV Export (existing) */}
                            <div className="glass-card p-5 space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-emerald-500" /> CSV 데이터 내보내기
                                </h4>
                                <p className="text-xs font-medium text-slate-500 bg-[#111113] p-3 rounded-xl border border-white/10">
                                    모든 지출, 수입, 일정을 엑셀에서 열 수 있는 CSV 형식으로 내보냅니다.
                                </p>
                                <button
                                    onClick={() => {
                                        let csvContent = "data:text/csv;charset=utf-8,\uFEFFCategory,Type,Date,Title,Amount,Memo\n";
                                        transactions.forEach(t => {
                                            csvContent += `재정,${t.type},${t.date},"${t.title}",${t.amount},"${t.memo || ''}"\n`;
                                        });
                                        schedules.forEach(s => {
                                            csvContent += `일정,,${s.date},"${s.title}",,"${s.memo || ''}"\n`;
                                        });
                                        goals.forEach(g => {
                                            csvContent += `목표,,${g.deadline},"${g.title}",,""\n`;
                                        });
                                        const encodedUri = encodeURI(csvContent);
                                        const link = document.createElement("a");
                                        link.href = encodedUri;
                                        link.download = `allrounder_export_${new Date().toISOString().split('T')[0]}.csv`;
                                        link.click();
                                        toast.success('CSV 파일이 다운로드 되었습니다!', { icon: '📊' });
                                    }}
                                    className="w-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> 내 모든 데이터 다운로드 (.csv)
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
                    <p className="text-[11px] text-slate-600">
                        <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px]">?</kbd> 단축키 도움말
                    </p>
                    <span className="text-[11px] text-slate-700 font-bold">올라운더 v{APP_VERSION}</span>
                </div>
            </div>
        </div>
    );
}