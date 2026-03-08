import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from './IconMap';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';

export default function SearchModal({
    isOpen,
    onClose,
    transactions,
    schedules,
    goals,
    setCurrentDate,
    setCurrentTab
}) {
    const { Search, X, Calendar, Wallet, Target, MapPin } = IconMap;
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const lowerQuery = query.toLowerCase();

        const matchStore = (item) => {
            return (
                (item.title && item.title.toLowerCase().includes(lowerQuery)) ||
                (item.memo && item.memo.toLowerCase().includes(lowerQuery)) ||
                (item.category && item.category.toLowerCase().includes(lowerQuery)) ||
                (item.location && item.location.toLowerCase().includes(lowerQuery))
            );
        };

        const tRes = transactions.filter(matchStore).map(t => ({ ...t, _model: 'finance' }));
        const sRes = schedules.filter(matchStore).map(s => ({ ...s, _model: 'schedule' }));
        const gRes = goals.filter(matchStore).map(g => ({ ...g, _model: 'goal' }));

        return [...tRes, ...sRes, ...gRes].sort((a, b) => {
            const dA = a.date || a.deadline || '1970-01-01';
            const dB = b.date || b.deadline || '1970-01-01';
            return dB.localeCompare(dA); // Latest first
        });
    }, [query, transactions, schedules, goals]);

    const handleItemClick = (item) => {
        if (item._model === 'finance') {
            setCurrentTab('finance');
            if (item.date) setCurrentDate(parseISO(item.date));
        } else if (item._model === 'schedule') {
            setCurrentTab('schedule');
            if (item.date) setCurrentDate(parseISO(item.date));
        } else if (item._model === 'goal') {
            setCurrentTab('goal');
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="relative bg-[#111113] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-white/10"
            >
                <div className="flex items-center p-4 border-b border-white/10 bg-slate-50/50 dark:bg-[#0f1115]/50">
                    <Search className="w-6 h-6 text-slate-400 ml-2" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="일정, 재정, 목표, 메모 등을 검색하세요..."
                        className="flex-1 bg-transparent border-none outline-none px-4 text-lg font-bold text-slate-400 placeholder-slate-400"
                    />
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {query.trim() && results.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 font-bold text-sm">
                            <Search className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                            '{query}'에 대한 검색 결과가 없습니다.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 p-2">
                            {results.map((item) => (
                                <button
                                    key={`${item._model}-${item.id}`}
                                    onClick={() => handleItemClick(item)}
                                    className="flex items-start text-left gap-4 p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/20"
                                >
                                    <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center 
                                        ${item._model === 'finance' ? (item.type === 'income' ? 'bg-blue-100 text-blue-500 dark:bg-blue-500/20' : 'bg-rose-100 text-rose-500 dark:bg-rose-500/20') :
                                            item._model === 'schedule' ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-500/20' : 'bg-purple-100 text-purple-500 dark:bg-purple-500/20'}`}
                                    >
                                        {item._model === 'finance' && <Wallet className="w-5 h-5" />}
                                        {item._model === 'schedule' && <Calendar className="w-5 h-5" />}
                                        {item._model === 'goal' && <Target className="w-5 h-5" />}
                                    </div>
                                    <div className="flex flex-col flex-1 overflow-hidden">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="font-bold text-base text-slate-400 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {item.title}
                                            </span>
                                            {item.amount && (
                                                <span className={`text-sm font-bold tracking-tight shrink-0 ${item.type === 'income' ? 'text-blue-500' : 'text-rose-500'}`}>
                                                    {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()}원
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-400">
                                            {(item.date || item.deadline) && (
                                                <span className="bg-white/5 px-1.5 py-0.5 rounded">
                                                    {format(parseISO(item.date || item.deadline), 'yyyy-MM-dd')}
                                                </span>
                                            )}
                                            {item.category && <span className="bg-white/5 px-1.5 py-0.5 rounded">{item.category}</span>}
                                            {item.time && <span>{item.time}</span>}
                                        </div>
                                        {item.memo && <p className="text-xs font-medium text-slate-500 mt-1 truncate">{item.memo}</p>}
                                        {item.location && (
                                            <p className="text-[10px] font-bold text-indigo-400 mt-1 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {item.location}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

SearchModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    transactions: PropTypes.array.isRequired,
    schedules: PropTypes.array.isRequired,
    goals: PropTypes.array.isRequired,
    setCurrentDate: PropTypes.func.isRequired,
    setCurrentTab: PropTypes.func.isRequired,
};
