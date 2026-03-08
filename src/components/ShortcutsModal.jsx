import React, { useEffect } from 'react';
import { IconMap } from './IconMap';

const SHORTCUTS = [
    { keys: ['⌘', 'K'], label: '글로벌 검색 열기', category: '검색' },
    { keys: ['?'], label: '단축키 도움말 보기', category: '도움말' },
    { keys: ['Esc'], label: '모달 닫기', category: '일반' },
    { keys: ['1'], label: '홈 탭으로 이동', category: '탭 이동' },
    { keys: ['2'], label: '일정 탭으로 이동', category: '탭 이동' },
    { keys: ['3'], label: '재정 탭으로 이동', category: '탭 이동' },
    { keys: ['4'], label: '목표 탭으로 이동', category: '탭 이동' },
    { keys: ['5'], label: '공부 탭으로 이동', category: '탭 이동' },
    { keys: ['6'], label: '회고 탭으로 이동', category: '탭 이동' },
    { keys: ['N'], label: '새 기록 추가 (모달 열기)', category: '입력' },
];

const CATEGORIES = [...new Set(SHORTCUTS.map(s => s.category))];

export default function ShortcutsModal({ close }) {
    const { X, Keyboard } = IconMap;

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [close]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 fade-in">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={close} />
            <div className="relative glass-card bg-[#111113] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-white/10">
                    <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-indigo-400" /> 키보드 단축키
                    </h3>
                    <button onClick={close} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {CATEGORIES.map(cat => (
                        <div key={cat}>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">{cat}</p>
                            <div className="space-y-1.5">
                                {SHORTCUTS.filter(s => s.category === cat).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
                                        <span className="text-sm text-slate-300 font-medium">{s.label}</span>
                                        <div className="flex gap-1">
                                            {s.keys.map((k, ki) => (
                                                <kbd key={ki} className="px-2 py-0.5 bg-white/10 border border-white/20 rounded-md text-xs font-bold text-slate-300 font-mono">{k}</kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-3 border-t border-white/10 text-center">
                    <p className="text-xs text-slate-600 font-medium">어디서든 <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-xs">?</kbd> 키를 눌러 이 창을 열 수 있습니다</p>
                </div>
            </div>
        </div>
    );
}