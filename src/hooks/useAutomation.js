/**
 * @fileoverview Automation hook for daily asset operations (interest, ticker sync).
 * Extracted from App.jsx to reduce the God Component.
 * 
 * Fixes applied:
 * - No more direct state mutation on accounts
 * - Proper dependency array (runs when accounts change)
 * - Better error handling with user-facing toasts
 */
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { generateId } from '../utils/helpers';
import { AUTOMATION_DELAY_MS } from '../constants';

/**
 * Runs daily automations: savings interest and investment ticker sync.
 * @param {Object} params
 */
export function useAutomation({ accounts, calculatedBalances, setTransactions, updateAccount }) {
    const hasRun = useRef(false);

    useEffect(() => {
        // Only run once per app load, and only when accounts are available
        if (hasRun.current || !accounts || accounts.length === 0) return;

        const timer = setTimeout(() => {
            if (hasRun.current) return;
            hasRun.current = true;
            runAutomations();
        }, AUTOMATION_DELAY_MS);

        return () => clearTimeout(timer);

        async function runAutomations() {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const newTxs = [];
            const accountUpdates = [];

            for (const acc of accounts) {
                // 1. Savings Interest Calculation
                if (acc.type === 'savings' && acc.interestRate) {
                    const currentBalance = calculatedBalances[acc.id] || 0;
                    const cycle = acc.interestCycle || 'daily';

                    if (currentBalance > 0) {
                        if (cycle === 'daily' && (!acc.lastInterestUpdate || acc.lastInterestUpdate !== todayStr)) {
                            const dailyRate = (acc.interestRate / 100) / 365;
                            const interestNum = currentBalance * dailyRate;
                            if (interestNum >= 1) {
                                newTxs.push({
                                    id: generateId(),
                                    type: 'income',
                                    date: todayStr,
                                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                    title: '일일 예적금 자동이자',
                                    amount: Math.floor(interestNum),
                                    category: '이자 수익',
                                    memo: `연 ${acc.interestRate}% 기준 자동 반영 (매일 지급)`,
                                    accountId: acc.id,
                                });
                            }
                            // Immutable update — schedule for batch
                            accountUpdates.push({ id: acc.id, updates: { lastInterestUpdate: todayStr } });
                        } else if (cycle === 'monthly') {
                            const currentMonth = todayStr.substring(0, 7);
                            const lastUpdateMonth = acc.lastInterestUpdate ? acc.lastInterestUpdate.substring(0, 7) : '';

                            if (lastUpdateMonth !== currentMonth && acc.lastInterestUpdate) {
                                const monthlyRate = (acc.interestRate / 100) / 12;
                                const interestNum = currentBalance * monthlyRate;
                                if (interestNum >= 1) {
                                    newTxs.push({
                                        id: generateId(),
                                        type: 'income',
                                        date: todayStr,
                                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                        title: '월간 예적금 복리이자',
                                        amount: Math.floor(interestNum),
                                        category: '이자 수익',
                                        memo: `연 ${acc.interestRate}% 기준 자동 반영 (매월 지급)`,
                                        accountId: acc.id,
                                    });
                                }
                                accountUpdates.push({ id: acc.id, updates: { lastInterestUpdate: todayStr } });
                            } else if (!acc.lastInterestUpdate) {
                                accountUpdates.push({ id: acc.id, updates: { lastInterestUpdate: todayStr } });
                            }
                        }
                    }
                }

                // 2. Investment Ticker Fetch
                if (acc.type === 'investment' && acc.ticker && acc.holdings > 0 &&
                    (!acc.lastTickerUpdate || acc.lastTickerUpdate !== todayStr)) {
                    try {
                        const tickerLower = acc.ticker.toLowerCase();
                        const isCrypto = tickerLower === 'btc' || tickerLower === 'eth' || tickerLower === 'xrp';

                        if (isCrypto) {
                            const cryptoIdMap = { btc: 'bitcoin', eth: 'ethereum', xrp: 'ripple' };
                            const cryptoId = cryptoIdMap[tickerLower];
                            if (cryptoId) {
                                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=krw`);
                                if (res.ok) {
                                    const data = await res.json();
                                    const price = data[cryptoId]?.krw || 0;
                                    if (price > 0) {
                                        const realValue = Math.floor(price * acc.holdings);
                                        const bookValue = calculatedBalances[acc.id] || 0;
                                        const diff = realValue - bookValue;
                                        if (Math.abs(diff) > 0) {
                                            newTxs.push({
                                                id: generateId(),
                                                type: diff > 0 ? 'income' : 'expense',
                                                date: todayStr,
                                                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                                title: `${acc.ticker} 실시간 평가액 반영`,
                                                amount: Math.abs(diff),
                                                category: diff > 0 ? '투자 수익' : '투자 손실',
                                                memo: `보유량: ${acc.holdings}개 / 시세: ₩${price.toLocaleString()}`,
                                                accountId: acc.id,
                                            });
                                        }
                                    }
                                }
                            }
                        } else {
                            // Stock simulation: random -2% to +2% for demo
                            const currentBalance = calculatedBalances[acc.id] || 0;
                            const changePercent = (Math.random() * 4) - 2;
                            const changeAmount = Math.floor(currentBalance * (changePercent / 100));
                            if (Math.abs(changeAmount) > 0) {
                                newTxs.push({
                                    id: generateId(),
                                    type: changeAmount > 0 ? 'income' : 'expense',
                                    date: todayStr,
                                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                    title: `${acc.ticker} 일일 평가변동`,
                                    amount: Math.abs(changeAmount),
                                    category: changeAmount > 0 ? '투자 수익' : '투자 손실',
                                    memo: `자동 시세추적 반영율: ${changePercent.toFixed(2)}%`,
                                    accountId: acc.id,
                                });
                            }
                        }
                        accountUpdates.push({ id: acc.id, updates: { lastTickerUpdate: todayStr } });
                    } catch (e) {
                        console.error('[Automation] Ticker sync failed:', e);
                        toast.error(`${acc.ticker} 시세 동기화에 실패했습니다.`, { icon: '⚠️' });
                    }
                }
            }

            // Apply all changes immutably
            if (newTxs.length > 0) {
                setTransactions((prev) => [...newTxs, ...prev]);
                toast.success(`자동화 프로세스 실행: ${newTxs.length}건의 자산 변동이 자동 기록되었습니다.`, { icon: '🤖' });
            }

            // Update accounts immutably through proper setter
            for (const { id, updates } of accountUpdates) {
                updateAccount(id, updates);
            }
        }
    }, [accounts, calculatedBalances, setTransactions, updateAccount]);
}
