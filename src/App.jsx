/**
 * @fileoverview Main App component — dramatically simplified.
 *
 * Original: 827 lines, 26+ useState
 * Refactored: ~180 lines, 3 useState
 *
 * All logic extracted to:
 * - useAuth (authentication)
 * - useAppData (core data)
 * - useAutomation (daily asset operations)
 * - InputModal (input form)
 * - SettingsModal (settings)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useAutomation } from './hooks/useAutomation';
import HomeView from './views/HomeView';
import ScheduleView from './views/ScheduleView';
import FinanceView from './views/FinanceView';
import GoalView from './views/GoalView';
import StudyView from './views/StudyView';
import { IconMap } from './components/IconMap';
import SettingsModal from './components/SettingsModal';
import ShortcutsModal from './components/ShortcutsModal';
import InputModal from './components/InputModal';
import ReviewView from './views/ReviewView';
import SearchModal from './components/SearchModal';
import QuickExpenseSheet from './components/QuickExpenseSheet';
import { Toaster, toast, ToastBar } from 'react-hot-toast';
import LoginView from './views/LoginView';
import { supabase } from './supabaseClient';
import { TABS } from './constants';
import { addDays, isSameDay, isBefore, parseISO, format, startOfToday } from 'date-fns';

const AUTO_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function App() {
  const { session, authLoading } = useAuth();

  const {
    currentDate, setCurrentDate, filterDateStr,
    expenseCategories, incomeCategories, scheduleCategories, addCategory,
    accounts, getCalculatedBalances, calculatedBalances, totalAssets,
    transactions, setTransactions,
    schedules, setSchedules,
    goals, setGoals,
    studies, setStudies,
    deleteCategory, addAccount, updateAccount, deleteAccount,
    userProfile, setUserProfile,
    budgets, setBudgets,
    reviews, setReviews,
    studyTimes, setStudyTimes,
    authPhotos, setAuthPhotos,
    initialBalances, setInitialBalances,
    financeDiary, setFinanceDiary,
  } = useAppData(session);

  // Run daily automations (interest, ticker sync)
  useAutomation({ accounts, calculatedBalances, setTransactions, updateAccount });

  // Theme management — dark mode fixed
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Accent color — set data-accent attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', userProfile?.accent || 'indigo');
  }, [userProfile?.accent]);

  const [currentTab, setCurrentTab] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [rolloverPrompted, setRolloverPrompted] = useState(false);

  // Web Share Target — Android에서 은행앱 공유 시 자동 처리
  const [pendingShareData, setPendingShareData] = useState(null); // { type:'image'|'text', blob?:Blob, text?:string }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareType = params.get('share');
    if (!shareType || (shareType !== 'image' && shareType !== 'text')) return;

    // URL 파라미터 즉시 제거 (히스토리 오염 방지)
    window.history.replaceState({}, '', '/');

    (async () => {
      try {
        const cache = await caches.open('share-target-v1');
        const response = await cache.match('/share-pending');
        if (!response) return;

        if (shareType === 'image') {
          const blob = await response.blob();
          await cache.delete('/share-pending');
          setPendingShareData({ type: 'image', blob });
        } else {
          const { text } = await response.json();
          await cache.delete('/share-pending');
          setPendingShareData({ type: 'text', text });
        }
        setCurrentTab('finance'); // 재정 탭으로 자동 이동
      } catch (err) {
        console.error('Share target read error:', err);
      }
    })();
  }, []);

  // Cmd+K → search, ? → shortcuts, 1-6 → tab navigation, N → new entry
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }
      if (isInputFocused) return;

      if (e.key === '?') {
        setIsShortcutsOpen(true);
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        setIsModalOpen(true);
        return;
      }
      const tabKeys = { '1': 'home', '2': 'schedule', '3': 'finance', '4': 'goal', '5': 'study', '6': 'review' };
      if (tabKeys[e.key]) {
        setCurrentTab(tabKeys[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto logout after 30 minutes of inactivity
  const autoLogoutTimer = useRef(null);
  const resetAutoLogout = useCallback(() => {
    clearTimeout(autoLogoutTimer.current);
    autoLogoutTimer.current = setTimeout(async () => {
      if (supabase && session) {
        await supabase.auth.signOut();
        toast('30분간 활동이 없어 자동 로그아웃되었습니다.', { icon: '🔒', duration: 5000 });
      }
    }, AUTO_LOGOUT_MS);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetAutoLogout, { passive: true }));
    resetAutoLogout();
    return () => {
      clearTimeout(autoLogoutTimer.current);
      events.forEach(e => window.removeEventListener(e, resetAutoLogout));
    };
  }, [session, resetAutoLogout]);

  // Check uncompleted past tasks for rollover
  useEffect(() => {
    if (schedules.length > 0 && !rolloverPrompted && session) {
      const today = startOfToday();
      const pastUncompleted = schedules.filter(s => !s.completed && isBefore(parseISO(s.date), today));
      if (pastUncompleted.length > 0) {
        toast((t) => (
          <div className="flex flex-col gap-2 p-1">
            <span className="font-bold text-sm">과거의 미완료 일정이 {pastUncompleted.length}개 있습니다.</span>
            <span className="text-xs text-slate-500">오늘 일정으로 모두 이월할까요?</span>
            <div className="flex gap-2 mt-2">
              <button onClick={() => {
                setSchedules(prev => prev.map(s => {
                  if (!s.completed && isBefore(parseISO(s.date), today)) {
                    return { ...s, date: format(today, 'yyyy-MM-dd') };
                  }
                  return s;
                }));
                toast.dismiss(t.id);
                toast.success('성공적으로 이월되었습니다.', { icon: '🔄' });
              }} className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">이월하기</button>
              <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95">닫기</button>
            </div>
          </div>
        ), { duration: 10000 });
        setRolloverPrompted(true);
      }
    }
  }, [schedules, rolloverPrompted, session, setSchedules]);

  // Update document title on tab change
  useEffect(() => {
    const currentTabLabel = TABS.find(t => t.id === currentTab)?.label || '홈';
    document.title = `올라운더 — ${currentTabLabel}`;
  }, [currentTab]);

  const { LayoutDashboard, Plus, ChevronLeft, ChevronRight, Search, X } = IconMap;
  const displayDate = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일`;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]" role="status" aria-label="로딩 중">
        <div className="rounded-full h-8 w-8 border-b-2 border-indigo-500" aria-hidden="true" />
        <span className="sr-only">로딩 중...</span>
      </div>
    );
  }

  if (supabase && !session) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen text-slate-300" style={{ paddingBottom: '80px' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: {
            background: 'var(--toast-bg, #1a1a1e)',
            color: 'var(--toast-text, #e2e8f0)',
            borderRadius: '4px',
            padding: '8px 10px 8px 14px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '12px',
            boxShadow: 'none',
          },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    style={{ marginLeft: 2, padding: '2px', opacity: 0.5, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>

      {/* Top bar — Linear style */}
      <div className="sticky top-0 z-30 bg-[#090909]" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-5xl mx-auto px-4">
          {/* Single row: logo | tabs | date + actions */}
          <div className="flex items-center gap-0">
            {/* Logo */}
            <div className="flex items-center gap-1.5 pr-4 mr-2" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-white tracking-tight">올라운더</span>
            </div>
            {/* Tabs */}
            <nav className="flex flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist">
              {TABS.map((tab) => {
                const Icon = IconMap[tab.icon];
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    onClick={() => setCurrentTab(tab.id)}
                    className={`flex items-center gap-1 px-3 h-10 text-[11px] font-medium whitespace-nowrap border-b-2 ${
                      isActive ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            {/* Right: date + actions */}
            <div className="flex items-center gap-1 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="hidden md:flex items-center gap-0.5 text-[11px] text-slate-500 mr-1">
                <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-1 hover:text-slate-300"><ChevronLeft className="w-3 h-3" /></button>
                <span>{displayDate} {['일','월','화','수','목','금','토'][currentDate.getDay()]}</span>
                <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-1 hover:text-slate-300"><ChevronRight className="w-3 h-3" /></button>
                {!isSameDay(currentDate, new Date()) && (
                  <button onClick={() => setCurrentDate(new Date())} className="text-indigo-400 text-[10px] px-1 hover:text-indigo-300">오늘</button>
                )}
              </div>
              <button onClick={() => setIsSearchOpen(true)} className="p-1.5 text-slate-500 hover:text-slate-300" aria-label="검색">
                <Search className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsSettingOpen(true)} className="w-6 h-6 text-[10px] font-bold text-indigo-400 border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-500/10" style={{ borderRadius: '3px' }} aria-label="설정">
                {userProfile?.name?.charAt(0) || '나'}
              </button>
            </div>
          </div>
          {/* Mobile date — below tabs */}
          <div className="flex md:hidden items-center gap-1 pb-1 text-[11px] text-slate-500">
            <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-0.5 hover:text-slate-300"><ChevronLeft className="w-3 h-3" /></button>
            {displayDate} {['일','월','화','수','목','금','토'][currentDate.getDay()]}요일
            <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-0.5 hover:text-slate-300"><ChevronRight className="w-3 h-3" /></button>
            {!isSameDay(currentDate, new Date()) && (
              <button onClick={() => setCurrentDate(new Date())} className="text-indigo-400 ml-1">오늘</button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-3 md:px-5 py-3" id={`panel-${currentTab}`} role="tabpanel" aria-labelledby={`tab-${currentTab}`}>
        <div>
          {currentTab === 'home' && <HomeView schedules={schedules} setSchedules={setSchedules} transactions={transactions} setTransactions={setTransactions} totalAssets={totalAssets} setCurrentTab={setCurrentTab} currentDate={currentDate} goals={goals} studies={studies} studyTimes={studyTimes} budgets={budgets} reviews={reviews} />}
          {currentTab === 'schedule' && <ScheduleView schedules={schedules} setSchedules={setSchedules} currentDate={currentDate} setCurrentDate={setCurrentDate} />}
          {currentTab === 'finance' &&
            <FinanceView
              transactions={transactions}
              setTransactions={setTransactions}
              getCalculatedBalances={getCalculatedBalances}
              accounts={accounts}
              currentDate={currentDate}
              budgets={budgets}
              setBudgets={setBudgets}
              expenseCategories={expenseCategories}
              initialBalances={initialBalances}
              setInitialBalances={setInitialBalances}
              financeDiary={financeDiary}
              setFinanceDiary={setFinanceDiary}
              goals={goals}
              pendingShareData={pendingShareData}
              clearPendingShare={() => setPendingShareData(null)}
            />
          }
          {currentTab === 'goal' && <GoalView goals={goals} setGoals={setGoals} studyTimes={studyTimes} studies={studies} />}
          {currentTab === 'study' && <StudyView studies={studies} setStudies={setStudies} currentDate={currentDate} studyTimes={studyTimes} setStudyTimes={setStudyTimes} authPhotos={authPhotos} setAuthPhotos={setAuthPhotos} session={session} userProfile={userProfile} goals={goals} setGoals={setGoals} setSchedules={setSchedules} />}
          {currentTab === 'review' && <ReviewView reviews={reviews} setReviews={setReviews} currentDate={currentDate} transactions={transactions} schedules={schedules} studies={studies} studyTimes={studyTimes} goals={goals} userProfile={userProfile} />}
        </div>
      </main>

      {/* Floating Action Buttons */}
      {!isModalOpen && !isQuickOpen && (
        <div className="fixed bottom-6 right-4 md:bottom-10 md:right-10 z-40 flex flex-col items-end gap-2">
          {/* 상세 입력 (작은 버튼) */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1c23] border border-white/10 text-slate-400 rounded text-xs font-medium hover:bg-white/8"
            aria-label="상세 입력"
          >
            <Plus className="w-3 h-3" />
            상세
          </button>
          <button
            onClick={() => setIsQuickOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded text-sm font-bold"
            aria-label="빠른 지출 입력"
          >
            <Plus className="w-4 h-4" />
            지출
          </button>
        </div>
      )}

      {/* Input Modal */}
      <InputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        filterDateStr={filterDateStr}
        displayDate={displayDate}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        scheduleCategories={scheduleCategories}
        accounts={accounts}
        setTransactions={setTransactions}
        setSchedules={setSchedules}
        setGoals={setGoals}
        goals={goals}
      />

      {/* Quick Expense Sheet */}
      <QuickExpenseSheet
        isOpen={isQuickOpen}
        onClose={() => setIsQuickOpen(false)}
        onOpenDetail={() => { setIsQuickOpen(false); setIsModalOpen(true); }}
        setTransactions={setTransactions}
        accounts={accounts}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />

      {/* Settings Modal */}
      {isSettingOpen && (
        <SettingsModal
          close={() => setIsSettingOpen(false)}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          scheduleCategories={scheduleCategories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          accounts={accounts}
          addAccount={addAccount}
          updateAccount={updateAccount}
          deleteAccount={deleteAccount}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          session={session}
          transactions={transactions}
          schedules={schedules}
          goals={goals}
          studies={studies}
          reviews={reviews}
          budgets={budgets}
          setTransactions={setTransactions}
          setSchedules={setSchedules}
          setGoals={setGoals}
          setStudies={setStudies}
          setReviews={setReviews}
          setBudgets={setBudgets}
        />
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        transactions={transactions}
        schedules={schedules}
        goals={goals}
        setCurrentDate={setCurrentDate}
        setCurrentTab={setCurrentTab}
      />

      {/* Shortcuts Modal */}
      {isShortcutsOpen && (
        <ShortcutsModal close={() => setIsShortcutsOpen(false)} />
      )}
    </div>
  );
}