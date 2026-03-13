/**
 * @fileoverview Korean bank transaction auto-classifier.
 * Uses keyword pattern matching + user-learned patterns to categorize transactions.
 * Also provides duplicate detection against existing transactions.
 */

const LEARNED_KEY = 'ollarounder_bank_patterns';

export function loadLearnedPatterns() {
    try { return JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]'); }
    catch { return []; }
}

export function saveLearnedPattern(keyword, category) {
    const patterns = loadLearnedPatterns();
    const idx = patterns.findIndex(p => p.keyword.toLowerCase() === keyword.toLowerCase());
    if (idx >= 0) patterns[idx].category = category;
    else patterns.push({ keyword: keyword.trim(), category });
    localStorage.setItem(LEARNED_KEY, JSON.stringify(patterns));
}

export function deleteLearnedPattern(keyword) {
    const patterns = loadLearnedPatterns().filter(p => p.keyword !== keyword);
    localStorage.setItem(LEARNED_KEY, JSON.stringify(patterns));
}

// ────────────────────────────────────────────────────────────────────────────
// Comprehensive built-in keyword patterns for Korean merchants/services
// ────────────────────────────────────────────────────────────────────────────
const BUILTIN_PATTERNS = [
    // ── 식비 (Food) ──
    { kw: ['맥도날드', '맥날', 'mcdonald', '버거킹', 'burgerking', '롯데리아', '맘스터치', '서브웨이', 'subway', '교촌', 'bbq', '굽네', '피자헛', '도미노', '파파존스', '노브랜드버거', '쉑쉑버거', '신전떡볶이', '고든램지', '더현대', '한솥', '김밥천국', '분식', '순대', '떡볶이', '치킨', '피자', '식당', '음식점', '한식', '중식', '일식', '양식', '국밥', '설렁탕', '삼겹살', '갈비', '냉면', '김밥', '라면', '우동', '돈가스', '파스타', '스테이크', '비빔밥', '된장', '쌈밥', '곱창', '막창', '족발', '보쌈', '칼국수', '만두', '감자탕', '해장국', '샐러드'], cat: '식비', type: 'expense' },

    // ── 카페/음료 (Cafe) ──
    { kw: ['스타벅스', 'starbucks', '투썸', '이디야', '메가커피', '컴포즈', '빽다방', '할리스', '폴바셋', '탐앤탐스', '요거프레소', '더벤티', '카페베네', '엔제리너스', '던킨', 'dunkin', '베스킨', 'baskin', '나뚜루', '배스킨', '밀크티', '버블티', '카페', '커피숍', '커피전문', '아이스크림', '젤라또'], cat: '카페/음료', type: 'expense' },

    // ── 배달음식 (Delivery) ──
    { kw: ['배달의민족', '배민', '요기요', '쿠팡이츠', '위메프오', '배달대행', '배달주문'], cat: '배달음식', type: 'expense' },

    // ── 베이커리 (Bakery) ──
    { kw: ['뚜레쥬르', '파리바게뜨', '파리크라상', '베이커리', '빵집', '빵', '케이크', '도넛', '크로아상', '토스트'], cat: '식비', type: 'expense' },

    // ── 편의점 (Convenience Store) ──
    { kw: ['gs25', 'gs편의점', 'cu편의점', 'cu마트', 'cu ', '세븐일레븐', '7eleven', '미니스톱', '이마트24', '에브리데이', '스토리웨이', 'ministop'], cat: '편의점', type: 'expense' },

    // ── 마트/슈퍼 (Grocery) ──
    { kw: ['이마트', 'emart', '홈플러스', '롯데마트', '코스트코', 'costco', '하나로마트', '농협하나로', 'ssg닷컴', '노브랜드', '트레이더스', '메가마트', '킴스클럽', '롯데슈퍼', 'gs더프레시', '하나로클럽', '마트', '슈퍼마켓', '대형마트'], cat: '장보기', type: 'expense' },

    // ── 온라인쇼핑 (Online Shopping) ──
    { kw: ['쿠팡', 'coupang', '네이버쇼핑', 'navershopping', '지마켓', 'gmarket', '옥션', 'auction', '11번가', '위메프', '티몬', '인터파크', '카카오쇼핑', 'ssg', '롯데온', '하이마트', '전자랜드', '무신사', '지그재그', '에이블리', '브랜디', '마켓컬리', '오늘의집', '당근마켓', '번개장터', 'aliexpress', 'amazon', '아마존', 'alibaba'], cat: '쇼핑', type: 'expense' },

    // ── 대형마트/홈쇼핑 ──
    { kw: ['롯데홈쇼핑', 'gshop', 'gs홈쇼핑', 'cj온스타일', '현대홈쇼핑', 'ns홈쇼핑', '공영홈쇼핑'], cat: '쇼핑', type: 'expense' },

    // ── 교통/대중교통 (Transit) ──
    { kw: ['카카오t', '카카오택시', '택시', '타다', '우버', 'uber', 't머니', '교통카드', '캐시비', '이비카드', '고속버스', '시외버스', '버스카드', '지하철', '서울교통', '서울도시철도'], cat: '교통/대중교통', type: 'expense' },

    // ── 기차/항공 (Travel) ──
    { kw: ['코레일', 'ktx', 'srt', '무궁화', '새마을', '대한항공', '아시아나', '제주항공', '진에어', '에어부산', '에어서울', '티웨이', '이스타', '플라이강원', '항공', '기내식', '공항버스', '리무진버스'], cat: '항공/여행', type: 'expense' },

    // ── 자동차/주유 (Car) ──
    { kw: ['주유소', 'gs칼텍스', 'sk엔크린', '현대오일뱅크', 'sk주유소', 's-oil', 'soilcorp', '오일뱅크', '주유', '하이패스', '통행료', '고속도로', '주차', '주차장', '발렛', '세차'], cat: '자동차/주유', type: 'expense' },

    // ── 의료/건강 (Medical) ──
    { kw: ['약국', '병원', '의원', '치과', '한의원', '안과', '피부과', '이비인후과', '정형외과', '내과', '소아과', '산부인과', '건강검진', '클리닉', '보건소', '처방', '약방', '약국', '동물병원', '수의사', '힐링'], cat: '의료/건강', type: 'expense' },

    // ── 통신 (Telecom) ──
    { kw: ['skt', 'sk텔레콤', 'kt요금', 'kt청구', 'lgu+', 'lg유플러스', 'u+', '통신요금', '휴대폰요금', '인터넷요금', '핸드폰요금', 'mvno'], cat: '통신비', type: 'expense' },

    // ── OTT/구독 (Subscriptions) ──
    { kw: ['넷플릭스', 'netflix', '유튜브프리미엄', 'youtube premium', '스포티파이', 'spotify', '멜론', '지니뮤직', '벅스', '디즈니플러스', 'disney', '왓챠', 'watcha', '웨이브', 'wavve', '티빙', 'tving', '쿠팡플레이', '네이버플러스', '카카오뮤직', '애플뮤직', 'apple music', '애플tv', 'apple tv', '아마존프라임'], cat: '구독/OTT', type: 'expense' },

    // ── 교육 (Education) ──
    { kw: ['클래스101', '인프런', '패스트캠퍼스', '유데미', 'udemy', '코세라', 'coursera', '학원', '교습소', '어학원', '과외', '인강', '교육원', '에듀', '학습지', '공부방', '독서실', '스터디카페'], cat: '교육', type: 'expense' },

    // ── 문화/여가 (Culture) ──
    { kw: ['cgv', '롯데시네마', '메가박스', '씨네', '영화관', '공연', '뮤지컬', '연극', '콘서트', '전시', '박물관', '미술관', '노래방', 'pc방', '피씨방', '볼링', '당구', '방탈출', '스크린골프', '클라이밍', '스카이다이빙'], cat: '문화/여가', type: 'expense' },

    // ── 운동/스포츠 (Sports) ──
    { kw: ['헬스장', '헬스클럽', '피트니스', '필라테스', '요가', '수영장', 'pt', '스포츠센터', '체육관', '짐', 'gym', '골프', '테니스', '배드민턴', '탁구', '풋살', '수영'], cat: '운동/스포츠', type: 'expense' },

    // ── 숙박 (Accommodation) ──
    { kw: ['야놀자', '여기어때', '에어비앤비', 'airbnb', '호텔', '모텔', '펜션', '게스트하우스', '리조트', '호스텔', '콘도'], cat: '숙박/여행', type: 'expense' },

    // ── 미용/뷰티 (Beauty) ──
    { kw: ['미용실', '헤어샵', '헤어', '네일샵', '네일', '뷰티', '올리브영', 'olive young', '왓슨스', '이니스프리', '에뛰드', '아모레퍼시픽', '더페이스샵', '스킨푸드', '닥터자르트', '라네즈', '설화수', '화장품', '마사지', '피부관리', '왁싱'], cat: '미용/뷰티', type: 'expense' },

    // ── 게임 (Gaming) ──
    { kw: ['스팀', 'steam', '닌텐도', 'nintendo', '플레이스테이션', 'playstation', '엑스박스', 'xbox', '구글플레이', 'google play', '앱스토어', 'app store', '넥슨', 'nexon', '엔씨소프트', '카카오게임즈', '넷마블', '펄어비스', '크래프톤', '라이엇', 'riot', '배틀넷', 'battlenet'], cat: '게임', type: 'expense' },

    // ── 보험 (Insurance) ──
    { kw: ['보험료', '삼성생명', '한화생명', '교보생명', '흥국생명', '미래에셋생명', '삼성화재', '현대해상', 'kb손해', 'db손해', '메리츠', '롯데손해', '농협생명', '신한생명', '생명보험', '손해보험', '실비보험', '자동차보험'], cat: '보험', type: 'expense' },

    // ── 생활용품 (Household) ──
    { kw: ['다이소', 'daiso', '이케아', 'ikea', '생활용품', '주방용품', '홈데코', '문구', '세탁', '청소용품', '소모품'], cat: '생활용품', type: 'expense' },

    // ── 공과금 (Utilities) ──
    { kw: ['전기요금', '전기세', '수도요금', '가스요금', '관리비', '아파트관리', '도시가스', '한전', '한국전력', '가스공사', '수도사업소', '환경부담금'], cat: '공과금', type: 'expense' },

    // ── 금융/이체 (Financial) ──
    { kw: ['atm출금', 'atm인출', '현금인출', '자동이체', '계좌이체', '송금', '이체수수료', '은행수수료', '가상계좌'], cat: '이체/출금', type: 'expense' },

    // ── 반려동물 ──
    { kw: ['동물병원', '수의', '펫', 'pet', '강아지', '고양이', '반려동물', '펫샵', '애견', '애묘'], cat: '반려동물', type: 'expense' },

    // ────── 수입 패턴 ──────

    // ── 급여 (Salary) ──
    { kw: ['급여', '월급', '상여금', '보너스', '연봉', '인센티브', '성과급', '임금', '급료', '퇴직금', '퇴직연금'], cat: '급여', type: 'income' },

    // ── 이자 수익 (Interest) ──
    { kw: ['이자수익', '이자지급', '예금이자', '적금이자', '저축이자', '이자입금', '이자', '배당금', '배당'], cat: '이자수익', type: 'income' },

    // ── 환급/환불 (Refund) ──
    { kw: ['환급', '환불', '취소환불', '반품', '캐시백', '리워드', '포인트환급', '세금환급', '건강보험환급', '국민연금환급', '카드환급', '결제취소'], cat: '환급/환불', type: 'income' },

    // ── 용돈/지원 (Allowance) ──
    { kw: ['용돈', '지원금', '보조금', '장학금', '정부지원', '긴급재난지원', '바우처', '쿠폰환급'], cat: '지원/용돈', type: 'income' },

    // ── 부업/프리랜서 ──
    { kw: ['프리랜서', '외주', '부업', '알바비', '아르바이트비', '강의료', '컨설팅', '용역비'], cat: '부업/프리랜서', type: 'income' },
];

/**
 * Classify a transaction memo.
 * @param {string} rawMemo   Raw text from bank statement
 * @param {'income'|'expense'|null} txType  Known transaction type (helps narrow classification)
 * @returns {{ category: string|null, confidence: 'learned'|'high'|'unknown' }}
 */
export function classify(rawMemo, txType = null) {
    if (!rawMemo) return { category: null, confidence: 'unknown' };

    const memo = rawMemo.toLowerCase().replace(/\s+/g, '');

    // 1. Learned patterns (highest priority)
    for (const { keyword, category } of loadLearnedPatterns()) {
        if (memo.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
            return { category, confidence: 'learned' };
        }
    }

    // 2. Built-in patterns
    for (const pattern of BUILTIN_PATTERNS) {
        // Skip type-mismatched patterns when type is known
        if (txType && pattern.type !== txType) continue;
        for (const kw of pattern.kw) {
            if (memo.includes(kw.toLowerCase().replace(/\s+/g, ''))) {
                return { category: pattern.cat, confidence: 'high' };
            }
        }
    }

    // 3. Fallback heuristics
    if (txType === 'income') {
        if (/이체|입금|송금/.test(memo)) return { category: '기타수입', confidence: 'high' };
    }
    if (txType === 'expense') {
        if (/이체|출금|송금/.test(memo)) return { category: '이체/출금', confidence: 'high' };
    }

    return { category: null, confidence: 'unknown' };
}

/**
 * Detect if a parsed transaction likely already exists in the app.
 * Matches on: same date + same amount + same type + similar memo
 * @returns {{ isDuplicate: boolean, matchedId?: string }}
 */
export function isDuplicate(tx, existingTxs) {
    for (const existing of existingTxs) {
        if (existing.date !== tx.date) continue;
        if (existing.type !== tx.type) continue;
        if (existing.amount !== tx.amount) continue;

        // Same date + type + amount → very likely duplicate even without memo match
        const existingMemo = (existing.memo || existing.title || '').toLowerCase().replace(/\s+/g, '');
        const txMemo = (tx.rawMemo || '').toLowerCase().replace(/\s+/g, '');

        if (!existingMemo || !txMemo) return { isDuplicate: true, matchedId: existing.id };
        if (existingMemo === txMemo) return { isDuplicate: true, matchedId: existing.id };
        if (existingMemo.length > 3 && txMemo.includes(existingMemo.slice(0, Math.floor(existingMemo.length * 0.6)))) {
            return { isDuplicate: true, matchedId: existing.id };
        }
        if (txMemo.length > 3 && existingMemo.includes(txMemo.slice(0, Math.floor(txMemo.length * 0.6)))) {
            return { isDuplicate: true, matchedId: existing.id };
        }

        // Amount + date match with no conflicting memo → assume duplicate
        return { isDuplicate: true, matchedId: existing.id };
    }
    return { isDuplicate: false };
}

/** All built-in expense categories (for UI dropdowns) */
export const EXPENSE_CATEGORIES = [
    '식비', '카페/음료', '배달음식', '편의점', '장보기', '쇼핑',
    '교통/대중교통', '자동차/주유', '항공/여행', '의료/건강', '통신비',
    '구독/OTT', '교육', '문화/여가', '운동/스포츠', '숙박/여행',
    '미용/뷰티', '게임', '보험', '생활용품', '공과금', '이체/출금',
    '반려동물', '기타',
];

export const INCOME_CATEGORIES = [
    '급여', '이자수익', '환급/환불', '지원/용돈', '부업/프리랜서', '기타수입',
];
