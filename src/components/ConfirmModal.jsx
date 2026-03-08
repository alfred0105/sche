/**
 * @fileoverview ConfirmModal — custom replacement for window.confirm() and window.prompt().
 * Provides consistent UI and accessibility.
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { IconMap } from './IconMap';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = '확인',
    message = '계속하시겠습니까?',
    confirmText = '확인',
    cancelText = '취소',
    variant = 'danger', // 'danger' | 'info'
    showInput = false,
    inputPlaceholder = '',
    inputType = 'text',
}) {
    const { X } = IconMap;
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef(null);
    const modalRef = useRef(null);

    // Focus trap: focus on modal when opened
    useEffect(() => {
        if (isOpen && showInput && inputRef.current) {
            inputRef.current.focus();
        } else if (isOpen && modalRef.current) {
            modalRef.current.focus();
        }
    }, [isOpen, showInput]);

    // ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (showInput) {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
        setInputValue('');
    };

    const variantColors = variant === 'danger'
        ? 'bg-rose-500 hover:bg-rose-600 '
        : 'bg-indigo-500 hover:bg-indigo-600 ';

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center px-4 fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
        >
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={modalRef}
                tabIndex={-1}
                className="relative bg-[#111113] w-full max-w-sm rounded-xl shadow-2xl p-4 md:p-5 space-y-4 border border-white/10"
            >
                <div className="flex justify-between items-center">
                    <h3 id="confirm-modal-title" className="text-lg font-bold tracking-tight text-slate-100">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                <p id="confirm-modal-desc" className="text-sm text-slate-400 leading-relaxed">
                    {message}
                </p>
                {showInput && (
                    <input
                        ref={inputRef}
                        type={inputType}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                        placeholder={inputPlaceholder}
                        className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 focus:border-indigo-500 outline-none"
                        aria-label={inputPlaceholder}
                    />
                )}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-white/5 text-slate-400 font-bold text-sm rounded-xl hover:bg-white/10 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`flex-1 py-2.5 text-white font-bold text-sm rounded-xl shadow-none transition-all active:scale-95 ${variantColors}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

ConfirmModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string,
    message: PropTypes.string,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    variant: PropTypes.oneOf(['danger', 'info']),
    showInput: PropTypes.bool,
    inputPlaceholder: PropTypes.string,
    inputType: PropTypes.string,
};
