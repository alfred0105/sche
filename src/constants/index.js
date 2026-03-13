/**
 * @fileoverview Shared constants used across the application.
 * Centralizes magic strings/numbers to avoid duplication and improve maintainability.
 */

// ============================================================
// Tracker Units (used in Goal creation — App modal & GoalView)
// ============================================================
export const TRACKER_UNITS = [
  { category: '기본 설정', options: ['% (수동 퍼센트)', '개 (항목수)', '건 (프로젝트/계약)'] },
  { category: '학습 및 자기계발', options: ['페이지 (독서/공부)', '장 (챕터)', '권 (책)', '문제 (풀이)', '점 (시험 점수)', '시간 (공부/집중)', '분 (짧은 집중)', '단어 (글쓰기)', '자 (원고 분량)'] },
  { category: '건강 및 운동', options: ['kg (체중 감량/증량)', 'km (러닝/라이딩)', 'm (수영)', '회 (운동 횟수)', '세트 (세트)', '걸음 (만보기)', 'kcal (칼로리)', '잔 (물 마시기)', 'L (물 마시기)'] },
  { category: '재정 및 경험', options: ['원 (저축/목표)', '달러 (투자/수입)', '일 (챌린지/진행일)', '주 (장기 프로젝트)', '달 (장기 계획)'] },
  { category: 'IT/개발 특화', options: ['커밋 (Git)', '버그 (이슈 해결)', 'PR (코드 리뷰)', '레벨 (성장 척도)'] },
];

// ============================================================
// Korean Holidays (recurring schedule exclusions)
// ============================================================
export const KR_FIXED_HOLIDAYS = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];

export const KR_FLOATING_HOLIDAYS = [
  '2024-02-09', '2024-02-12', '2024-04-10', '2024-05-06', '2024-05-15',
  '2024-09-16', '2024-09-17', '2024-09-18',
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-05',
  '2025-05-06', '2025-10-06', '2025-10-07', '2025-10-08',
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-05-24', '2026-05-25',
  '2026-09-24', '2026-09-25', '2026-09-26',
];

export const ALL_KR_HOLIDAYS = [...KR_FIXED_HOLIDAYS, ...KR_FLOATING_HOLIDAYS];

// ============================================================
// Default Categories
// ============================================================
export const DEFAULT_EXPENSE_CATEGORIES = [
  // 식음료
  { id: 'food', label: '식비', icon: 'Utensils' },
  { id: 'cafe', label: '카페', icon: 'Coffee' },
  { id: 'alcohol', label: '술/유흥', icon: 'Coffee' },
  { id: 'snack', label: '간식/디저트', icon: 'Coffee' },
  // 이동
  { id: 'transit', label: '교통비', icon: 'Train' },
  { id: 'taxi', label: '택시/카풀', icon: 'Activity' },
  { id: 'fuel', label: '주유/충전', icon: 'Activity' },
  // 쇼핑/생활
  { id: 'shopping', label: '쇼핑', icon: 'ShoppingBag' },
  { id: 'grocery', label: '마트/장보기', icon: 'ShoppingBag' },
  { id: 'clothing', label: '의류/패션', icon: 'ShoppingBag' },
  { id: 'household', label: '생활용품', icon: 'ShoppingBag' },
  // 주거
  { id: 'rent', label: '월세/관리비', icon: 'Landmark' },
  { id: 'utility', label: '공과금/통신비', icon: 'Activity' },
  // 건강
  { id: 'medical', label: '병원/약국', icon: 'Activity' },
  { id: 'fitness', label: '헬스/운동', icon: 'Activity' },
  // 자기계발
  { id: 'education', label: '교육/강의', icon: 'BookOpen' },
  { id: 'books', label: '도서/문구', icon: 'BookOpen' },
  // 여가
  { id: 'leisure', label: '여가/취미', icon: 'Calendar' },
  { id: 'travel', label: '여행/숙박', icon: 'Calendar' },
  { id: 'culture', label: '영화/공연', icon: 'Calendar' },
  { id: 'gaming', label: '게임', icon: 'Calendar' },
  // 금융
  { id: 'subscription', label: '구독/멤버십', icon: 'RefreshCw' },
  { id: 'insurance', label: '보험료', icon: 'Briefcase' },
  { id: 'invest_loss', label: '투자 손실', icon: 'TrendingDown' },
  { id: 'loan', label: '대출 상환', icon: 'Landmark' },
  // 기타
  { id: 'gift', label: '선물/경조사', icon: 'Flag' },
  { id: 'pet', label: '반려동물', icon: 'Activity' },
  { id: 'etc_expense', label: '기타 지출', icon: 'Briefcase' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', label: '급여', icon: 'Briefcase' },
  { id: 'parttime', label: '아르바이트', icon: 'Briefcase' },
  { id: 'freelance', label: '프리랜서', icon: 'Briefcase' },
  { id: 'allowance', label: '용돈', icon: 'PieChart' },
  { id: 'bonus', label: '보너스/인센티브', icon: 'Target' },
  { id: 'interest', label: '이자 수익', icon: 'TrendingUp' },
  { id: 'invest_profit', label: '투자 수익', icon: 'PieChart' },
  { id: 'rental', label: '임대 수익', icon: 'Landmark' },
  { id: 'refund', label: '환급/환불', icon: 'RefreshCw' },
  { id: 'gift_income', label: '선물/용돈 수령', icon: 'Flag' },
  { id: 'etc_income', label: '기타 수입', icon: 'Briefcase' },
];

export const DEFAULT_SCHEDULE_CATEGORIES = [
  { id: 'lecture', label: '강의/수업', icon: 'BookOpen' },
  { id: 'assignment', label: '과제/팀플', icon: 'Briefcase' },
  { id: 'exam', label: '시험/평가', icon: 'Target' },
  { id: 'study', label: '개인 공부', icon: 'Coffee' },
  { id: 'appointment', label: '약속/동아리', icon: 'Utensils' },
  { id: 'exercise', label: '운동/헬스', icon: 'Activity' },
  { id: 'work', label: '업무/회의', icon: 'Briefcase' },
  { id: 'medical', label: '병원/검진', icon: 'Activity' },
  { id: 'travel', label: '여행/외출', icon: 'Calendar' },
  { id: 'routine', label: '루틴/습관', icon: 'RefreshCw' },
  { id: 'etc_schedule', label: '기타', icon: 'Calendar' },
];

// ============================================================
// Default Accounts
// ============================================================
export const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: '현금', type: 'cash', default: true },
  { id: 'bank1', name: '국민은행 예금', type: 'bank' },
  { id: 'bank2', name: '신한은행 입출금', type: 'bank' },
  { id: 'saving1', name: '청년도약계좌', type: 'savings' },
  { id: 'stock1', name: '토스증권', type: 'investment' },
];

export const DEFAULT_INITIAL_BALANCES = {
  cash: 0,
  bank1: 0,
  bank2: 0,
  saving1: 0,
  stock1: 0,
};

// ============================================================
// Default Profile
// ============================================================
export const DEFAULT_PROFILE = {
  name: '사용자',
  theme: 'light',
  accent: 'indigo',
};

// ============================================================
// Goal Gradients & Emojis
// ============================================================
export const GRADIENT_LIST = [
  { from: 'from-rose-400', to: 'to-orange-400' },
  { from: 'from-blue-400', to: 'to-indigo-500' },
  { from: 'from-purple-500', to: 'to-fuchsia-500' },
  { from: 'from-emerald-400', to: 'to-teal-500' },
  { from: 'from-amber-300', to: 'to-orange-500' },
  { from: 'from-cyan-400', to: 'to-blue-500' },
];

export const EMOJI_LIST = ['🎯', '🚀', '🔥', '💻', '💡', '🎓', '🏆', '✈️', '💰', '💪', '📚', '🎨', '🏖️', '🍔', '🎉'];

export const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'];

// ============================================================
// Tab Configuration
// ============================================================
export const TABS = [
  { id: 'home', label: '홈', icon: 'LayoutDashboard' },
  { id: 'schedule', label: '일정', icon: 'Calendar' },
  { id: 'finance', label: '재정', icon: 'PieChart' },
  { id: 'goal', label: '목표', icon: 'Flag' },
  { id: 'study', label: '공부', icon: 'BookOpen' },
  { id: 'review', label: '회고', icon: 'ClipboardList' },
];

// ============================================================
// Settings Icon Options
// ============================================================
export const ICON_OPTIONS = [
  'Briefcase', 'BookOpen', 'Coffee', 'ShoppingBag', 'Utensils',
  'Train', 'Target', 'Calendar', 'Flag', 'PieChart', 'Check', 'Wallet',
  'Activity', 'ClipboardList', 'Clock'
];

// ============================================================
// Magic Numbers → Named Constants
// ============================================================
export const AUTOMATION_DELAY_MS = 2000;
export const CLOUD_SYNC_DEBOUNCE_MS = 1500;
export const CLOUD_SYNC_READY_DELAY_MS = 2000;
export const MAX_RECURRING_COUNT = 365;
export const DEFAULT_RECURRING_COUNT = 12;
export const CHART_DAYS_RANGE = 60;
export const ASSET_CHART_DAYS = 7;
