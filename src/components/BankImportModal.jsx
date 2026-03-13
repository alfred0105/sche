/**
 * @fileoverview BankImportModal — browser-native bank statement import.
 * Supports: screenshot OCR (Tesseract.js, Korean), CSV/text paste, drag-drop, clipboard paste.
 * Features: auto-classify, duplicate detection, manual review for unknowns, learned pattern saving.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { IconMap } from './IconMap';
import { parseBankCSV } from '../utils/bankParser';
import { classify, isDuplicate, saveLearnedPattern, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/transactionClassifier';
import { generateId } from '../utils/helpers';

// ── Steps ────────────────────────────────────────────────────────────────────
const STEP_INPUT = 1;   // Upload image or paste CSV
const STEP_REVIEW = 2;  // Review parsed rows, classify each
const STEP_UNKNOWN = 3; // Manual review for unclassified rows
const STEP_DONE = 4;    // Import complete

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(n) {
    return n?.toLocaleString('ko-KR') + '원';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ProgressBar({ value, label }) {
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{label}</span>
                <span>{Math.round(value)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                    className="bg-blue-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
        </div>
    );
}

function StepIndicator({ current }) {
    const steps = ['입력', '검토', '미분류', '완료'];
    return (
        <div className="flex items-center gap-1 mb-4">
            {steps.map((label, i) => {
                const step = i + 1;
                const active = step === current;
                const done = step < current;
                return (
                    <React.Fragment key={step}>
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors
                            ${active ? 'bg-blue-500 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                            {done ? '✓' : step}
                            <span className="hidden sm:inline">{label}</span>
                        </div>
                        {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 min-w-2" />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function BankImportModal({ onClose, transactions, setTransactions }) {
    const { X, Upload, Camera, ImageIcon, CheckCircle2, Trash2, ChevronDown } = IconMap;

    const [step, setStep] = useState(STEP_INPUT);
    const [mode, setMode] = useState('image'); // 'image' | 'text'

    // Step 1: Input
    const [dragOver, setDragOver] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrRunning, setOcrRunning] = useState(false);
    const [ocrText, setOcrText] = useState('');
    const [csvText, setCsvText] = useState('');
    const fileInputRef = useRef(null);

    // Step 2: Review rows
    const [rows, setRows] = useState([]); // { ...parsed, category, learnKeyword, learnEnabled, dupInfo }
    const [selectAll, setSelectAll] = useState(true);

    // Step 3: Unknown
    const [unknownRows, setUnknownRows] = useState([]);

    // ── Clipboard paste (Ctrl+V) ────────────────────────────────────────────
    useEffect(() => {
        if (step !== STEP_INPUT || mode !== 'image') return;
        const onPaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    handleImageFile(file);
                    break;
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [step, mode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Image handling ──────────────────────────────────────────────────────
    const handleImageFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) {
            toast.error('이미지 파일을 선택해주세요.');
            return;
        }
        const url = URL.createObjectURL(file);
        setImagePreview(url);
        runOCR(file);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const runOCR = useCallback(async (file) => {
        setOcrRunning(true);
        setOcrProgress(0);
        setOcrText('');
        try {
            // Dynamically import Tesseract to avoid loading it unless needed
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('kor+eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round((m.progress || 0) * 100));
                    }
                },
            });
            const { data } = await worker.recognize(file);
            await worker.terminate();
            setOcrText(data.text || '');
            setOcrProgress(100);
            if (!data.text?.trim()) {
                toast.error('텍스트를 인식하지 못했습니다. 이미지를 확인해주세요.');
            } else {
                toast.success('OCR 완료! 텍스트를 확인하고 다음 단계로 진행하세요.');
            }
        } catch (err) {
            toast.error('OCR 오류: ' + (err?.message || '알 수 없는 오류'));
            console.error('OCR error:', err);
        } finally {
            setOcrRunning(false);
        }
    }, []);

    // ── Drag & Drop ─────────────────────────────────────────────────────────
    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImageFile(file);
    }, [handleImageFile]);

    // ── Parse & Classify ─────────────────────────────────────────────────────
    const parseAndClassify = useCallback((text) => {
        const parsed = parseBankCSV(text);
        if (!parsed.length) {
            toast.error('거래 내역을 파싱할 수 없습니다. 텍스트를 확인해주세요.');
            return;
        }
        const enriched = parsed.map((tx) => {
            const result = classify(tx.rawMemo, tx.type);
            const dupInfo = isDuplicate(tx, transactions);
            return {
                ...tx,
                id: generateId(),
                category: result.category || '',
                confidence: result.confidence,
                learnKeyword: tx.rawMemo?.split(/\s+/)[0] || '',
                learnEnabled: false,
                selected: !dupInfo.isDuplicate,
                dupInfo,
            };
        });
        setRows(enriched);
        setSelectAll(true);
        setStep(STEP_REVIEW);
        toast.success(`${parsed.length}건 파싱 완료!`);
    }, [transactions]);

    const handleProceedFromInput = useCallback(() => {
        const text = mode === 'image' ? ocrText : csvText;
        if (!text.trim()) {
            toast.error('내용이 없습니다.');
            return;
        }
        parseAndClassify(text);
    }, [mode, ocrText, csvText, parseAndClassify]);

    // ── Review step helpers ─────────────────────────────────────────────────
    const toggleSelect = (id) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
    };
    const toggleSelectAll = () => {
        const next = !selectAll;
        setSelectAll(next);
        setRows(prev => prev.map(r => ({ ...r, selected: r.dupInfo?.isDuplicate ? false : next })));
    };
    const updateRow = (id, patch) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    };
    const deleteRow = (id) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const handleProceedToUnknown = useCallback(() => {
        const selectedRows = rows.filter(r => r.selected);
        if (!selectedRows.length) {
            toast.error('가져올 항목을 선택해주세요.');
            return;
        }
        const unk = selectedRows.filter(r => !r.category);
        if (unk.length) {
            setUnknownRows(unk);
            setStep(STEP_UNKNOWN);
        } else {
            doImport(selectedRows);
        }
    }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateUnknown = (id, patch) => {
        setUnknownRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    };

    const handleImportWithUnknown = useCallback(() => {
        // Save learned patterns
        unknownRows.forEach(r => {
            if (r.learnEnabled && r.learnKeyword?.trim() && r.category) {
                saveLearnedPattern(r.learnKeyword.trim(), r.category);
            }
        });
        // Merge unknown back into selected rows
        const selectedRows = rows.filter(r => r.selected).map(r => {
            const unk = unknownRows.find(u => u.id === r.id);
            return unk ? unk : r;
        });
        doImport(selectedRows);
    }, [rows, unknownRows]); // eslint-disable-line react-hooks/exhaustive-deps

    const doImport = useCallback((selected) => {
        const newTxs = selected.map(r => ({
            id: generateId(),
            date: r.date,
            type: r.type,
            amount: r.amount,
            category: r.category || '기타',
            memo: r.rawMemo,
            title: r.rawMemo,
            accountId: '',
        }));
        setTransactions(prev => [...newTxs, ...prev]);
        toast.success(`${newTxs.length}건 가져오기 완료!`);
        setStep(STEP_DONE);
    }, [setTransactions]);

    // ── Render ───────────────────────────────────────────────────────────────
    const selectedCount = rows.filter(r => r.selected).length;
    const dupCount = rows.filter(r => r.dupInfo?.isDuplicate).length;
    const unknownCount = rows.filter(r => r.selected && !r.category).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold dark:text-white">거래내역 가져오기</h2>
                        <p className="text-xs text-gray-400 mt-0.5">스크린샷·CSV 자동 분류 • 중복 감지</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="px-5 pt-4 flex-shrink-0">
                    <StepIndicator current={step} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 pb-5">

                    {/* ── Step 1: Input ── */}
                    {step === STEP_INPUT && (
                        <div className="space-y-4">
                            {/* Mode toggle */}
                            <div className="flex rounded-xl overflow-hidden border dark:border-gray-700 text-sm">
                                {[['image', '📷 스크린샷'], ['text', '📋 CSV/텍스트']].map(([m, label]) => (
                                    <button key={m} onClick={() => setMode(m)}
                                        className={`flex-1 py-2 font-medium transition-colors
                                            ${mode === m ? 'bg-blue-500 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'image' ? (
                                <>
                                    {/* Drop zone */}
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={onDrop}
                                        onClick={() => !ocrRunning && fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                                            ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    >
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain mb-2" />
                                        ) : (
                                            <div className="text-gray-400 space-y-2">
                                                <Camera size={36} className="mx-auto" />
                                                <p className="text-sm font-medium">스크린샷 업로드</p>
                                                <p className="text-xs">드래그 & 드롭 또는 클릭 • Ctrl+V 붙여넣기</p>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                                    </div>

                                    {/* OCR Progress */}
                                    {(ocrRunning || ocrProgress > 0) && (
                                        <ProgressBar value={ocrProgress} label={ocrRunning ? 'OCR 처리 중...' : 'OCR 완료'} />
                                    )}

                                    {/* OCR text preview (editable) */}
                                    {ocrText && (
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                                인식된 텍스트 (수정 가능)
                                            </label>
                                            <textarea
                                                rows={8}
                                                value={ocrText}
                                                onChange={(e) => setOcrText(e.target.value)}
                                                className="w-full text-xs font-mono border dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 resize-y"
                                                placeholder="OCR 결과가 여기 표시됩니다..."
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div>
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                        CSV/텍스트 붙여넣기 (은행 내보내기 파일 내용)
                                    </label>
                                    <textarea
                                        rows={12}
                                        value={csvText}
                                        onChange={(e) => setCsvText(e.target.value)}
                                        className="w-full text-xs font-mono border dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 dark:text-gray-200 resize-y"
                                        placeholder={"거래일자,적요,출금액,입금액,잔액\n2024-03-01,스타벅스,6500,,1000000\n..."}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleProceedFromInput}
                                disabled={ocrRunning || (mode === 'image' ? !ocrText.trim() : !csvText.trim())}
                                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl font-medium transition-colors"
                            >
                                파싱 및 분류 시작 →
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Review ── */}
                    {step === STEP_REVIEW && (
                        <div className="space-y-3">
                            {/* Summary bar */}
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                                    총 {rows.length}건
                                </span>
                                <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                                    선택 {selectedCount}건
                                </span>
                                {dupCount > 0 && (
                                    <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
                                        중복 {dupCount}건
                                    </span>
                                )}
                                {unknownCount > 0 && (
                                    <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                                        미분류 {unknownCount}건
                                    </span>
                                )}
                            </div>

                            {/* Select all toggle */}
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                                <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded" />
                                전체 선택 (중복 제외)
                            </label>

                            {/* Row list */}
                            <div className="space-y-2">
                                {rows.map((row) => (
                                    <div key={row.id}
                                        className={`border dark:border-gray-700 rounded-xl p-3 text-sm transition-colors
                                            ${!row.selected ? 'opacity-50' : ''}
                                            ${row.dupInfo?.isDuplicate ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10' : 'bg-white dark:bg-gray-800'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <input type="checkbox" checked={row.selected} onChange={() => toggleSelect(row.id)}
                                                className="mt-0.5 rounded flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                                                        ${row.type === 'income' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'}`}>
                                                        {row.type === 'income' ? '입금' : '출금'}
                                                    </span>
                                                    <span className="font-semibold dark:text-white">{formatAmount(row.amount)}</span>
                                                    <span className="text-gray-400 text-xs">{row.date}</span>
                                                    {row.dupInfo?.isDuplicate && (
                                                        <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded-full">🔄 중복</span>
                                                    )}
                                                    {row.confidence === 'learned' && (
                                                        <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">★ 학습됨</span>
                                                    )}
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{row.rawMemo}</p>
                                                {/* Category selector */}
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <select
                                                        value={row.category}
                                                        onChange={(e) => updateRow(row.id, { category: e.target.value })}
                                                        className={`text-xs border dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200 flex-1 min-w-0
                                                            ${!row.category ? 'border-red-400 dark:border-red-600' : ''}`}
                                                    >
                                                        <option value="">-- 미분류 --</option>
                                                        <optgroup label="지출">
                                                            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </optgroup>
                                                        <optgroup label="수입">
                                                            {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </optgroup>
                                                    </select>
                                                    <button onClick={() => deleteRow(row.id)} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 flex-shrink-0">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setStep(STEP_INPUT)}
                                    className="flex-1 py-2.5 border dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    ← 다시
                                </button>
                                <button onClick={handleProceedToUnknown} disabled={selectedCount === 0}
                                    className="flex-2 flex-grow-[2] py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
                                    {unknownCount > 0 ? `미분류 설정 (${unknownCount}건) →` : `${selectedCount}건 가져오기 →`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Unknown categories ── */}
                    {step === STEP_UNKNOWN && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                아래 항목의 카테고리를 직접 설정하세요. '기억하기'를 켜면 같은 키워드가 다음에 자동 분류됩니다.
                            </p>
                            <div className="space-y-3">
                                {unknownRows.map((row) => (
                                    <div key={row.id} className="border dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                                                ${row.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                {row.type === 'income' ? '입금' : '출금'}
                                            </span>
                                            <span className="text-sm font-semibold dark:text-white">{formatAmount(row.amount)}</span>
                                            <span className="text-xs text-gray-400">{row.date}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.rawMemo}</p>

                                        <select
                                            value={row.category}
                                            onChange={(e) => updateUnknown(row.id, { category: e.target.value })}
                                            className="w-full text-xs border dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200"
                                        >
                                            <option value="">-- 카테고리 선택 --</option>
                                            <optgroup label="지출">
                                                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                            <optgroup label="수입">
                                                {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </optgroup>
                                        </select>

                                        {/* Learn toggle */}
                                        <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-purple-700 dark:text-purple-300 font-medium">
                                                <input type="checkbox" checked={row.learnEnabled}
                                                    onChange={(e) => updateUnknown(row.id, { learnEnabled: e.target.checked })}
                                                    className="rounded" />
                                                기억하기
                                            </label>
                                            {row.learnEnabled && (
                                                <input
                                                    type="text"
                                                    value={row.learnKeyword}
                                                    onChange={(e) => updateUnknown(row.id, { learnKeyword: e.target.value })}
                                                    placeholder="기억할 키워드 입력"
                                                    className="flex-1 text-xs border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setStep(STEP_REVIEW)}
                                    className="flex-1 py-2.5 border dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    ← 검토
                                </button>
                                <button onClick={handleImportWithUnknown}
                                    className="flex-[2] py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium">
                                    가져오기 완료
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Done ── */}
                    {step === STEP_DONE && (
                        <div className="text-center py-10 space-y-4">
                            <CheckCircle2 size={56} className="mx-auto text-green-500" />
                            <div>
                                <p className="text-xl font-bold dark:text-white">가져오기 완료!</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">거래 내역이 재정 탭에 추가되었습니다.</p>
                            </div>
                            <button onClick={onClose}
                                className="px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium">
                                닫기
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

BankImportModal.propTypes = {
    onClose: PropTypes.func.isRequired,
    transactions: PropTypes.array.isRequired,
    setTransactions: PropTypes.func.isRequired,
};
