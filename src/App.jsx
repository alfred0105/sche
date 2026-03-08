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
import { Toaster, toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
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
  } = useAppData(session);

  // Run daily automations (interest, ticker sync)
  useAutomation({ accounts, calculatedBalances, setTransactions, updateAccount });

  // Theme management — dark/light/system based on userProfile.theme
  useEffect(() => {
    const theme = userProfile?.theme || 'dark';
    const applyTheme = (t) => {
      const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    applyTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [userProfile?.theme]);

  // Accent color — set data-accent attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', userProfile?.accent || 'indigo');
  }, [userProfile?.accent]);

  const [currentTab, setCurrentTab] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [rolloverPrompted, setRolloverPrompted] = useState(false);

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

  const { LayoutDashboard, Plus, ChevronLeft, ChevronRight, Search } = IconMap;
  const displayDate = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${currentDate.getDate()}일`;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]" role="status" aria-label="로딩 중">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" aria-hidden="true" />
        <span className="sr-only">로딩 중...</span>
      </div>
    );
  }

  if (supabase && !session) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen relative pb-28 overflow-x-hidden text-slate-400">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--toast-bg, rgba(255, 255, 255, 0.9))',
            color: 'var(--toast-text, #1e293b)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '12px 20px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          },
        }}
      />

      {/* Ambient Animated Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-400/10 dark:bg-indigo-600/20 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-rose-400/10 dark:bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col gap-3 md:gap-5 px-4 md:px-5 pt-4 md:pt-6 mb-6">
        <header className="flex justify-between items-center glass p-4 rounded-xl mt-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-900 dark:bg-indigo-500 rounded-lg flex items-center justify-center -rotate-6 shadow-none" aria-hidden="true">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            올라운더
          </h1>
          <div className="flex items-center gap-2">
            <button
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setIsSearchOpen(true)}
              aria-label="검색 열기"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline text-[9px] text-slate-400 font-bold ml-1 border border-white/10 px-1.5 rounded-md">⌘K</span>
            </button>
            <button
              className="w-10 h-10 bg-indigo-500/10 border-2 border-white dark:border-[#1a1c23] rounded-full shadow-none flex items-center justify-center font-bold tracking-tight text-indigo-400 text-sm cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsSettingOpen(true)}
              aria-label="설정 열기"
            >
              {userProfile?.name?.charAt(0) || '나'}
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between pb-1 px-1">
          <div className="flex flex-col">
            <span className="text-base md:text-lg font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
              <button
                onClick={() => setCurrentDate(addDays(currentDate, -1))}
                className="hover:bg-slate-200 dark:hover:bg-slate-800 p-0.5 rounded transition-colors"
                aria-label="어제"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              </button>
              {displayDate} {['일', '월', '화', '수', '목', '금', '토'][currentDate.getDay()]}요일
              <button
                onClick={() => setCurrentDate(addDays(currentDate, 1))}
                className="hover:bg-slate-200 dark:hover:bg-slate-800 p-0.5 rounded transition-colors"
                aria-label="내일"
              >
                <ChevronRight className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              </button>
              {!isSameDay(currentDate, new Date()) && (
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="ml-1 text-[11px] tracking-tight bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/30 shadow-none active:scale-95"
                >
                  오늘
                </button>
              )}
            </span>
            <span className="text-[11px] font-bold text-slate-400 mt-0 ml-8">
              {currentDate.getHours() < 12 ? '☀️ 좋은 아침이에요' : currentDate.getHours() < 18 ? '🌤️ 좋은 오후에요' : '🌙 좋은 저녁이에요'}, {userProfile?.name || '사용자'}님!
            </span>
          </div>
        </div>

        <nav className="flex overflow-x-auto gap-2 pb-2 md:pb-2 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="메인 탭 내비게이션">
          {TABS.map((tab) => {
            const Icon = IconMap[tab.icon];
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 md:px-5 py-2 md:py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all shrink-0 ${isActive ? 'bg-slate-800 dark:bg-indigo-500 text-white shadow-none' : 'bg-white/60 dark:bg-white/5 text-slate-400 hover:bg-white dark:hover:bg-white/10 shadow-none border border-slate-200/50 dark:border-white/5 backdrop-blur-md'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-5" id={`panel-${currentTab}`} role="tabpanel" aria-labelledby={`tab-${currentTab}`}>
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {currentTab === 'home' && <HomeView schedules={schedules} transactions={transactions} totalAssets={totalAssets} setCurrentTab={setCurrentTab} currentDate={currentDate} goals={goals} studies={studies} />}
          {currentTab === 'schedule' && <ScheduleView schedules={schedules} setSchedules={setSchedules} currentDate={currentDate} />}
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
            />
          }
          {currentTab === 'goal' && <GoalView goals={goals} setGoals={setGoals} />}
          {currentTab === 'study' && <StudyView studies={studies} setStudies={setStudies} currentDate={currentDate} studyTimes={studyTimes} setStudyTimes={setStudyTimes} authPhotos={authPhotos} setAuthPhotos={setAuthPhotos} session={session} userProfile={userProfile} />}
          {currentTab === 'review' && <ReviewView reviews={reviews} setReviews={setReviews} currentDate={currentDate} transactions={transactions} schedules={schedules} studies={studies} />}
        </motion.div>
      </main>

      {/* Floating Action Button */}
      {!isModalOpen && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 md:w-16 md:h-16 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-none dark:shadow-none transition-all active:scale-95 z-40 border border-slate-700 dark:border-indigo-500"
          aria-label="새 기록 추가"
        >
          <Plus className="w-6 h-6 md:w-8 md:h-8" aria-hidden="true" />
        </button>
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