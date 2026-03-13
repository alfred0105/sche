/**
 * @fileoverview Korean bank CSV/TSV statement parser.
 * Supports: KB국민, 신한, 우리, 하나, 카카오뱅크, 토스뱅크, IBK기업, NH농협, and generic formats.
 * Auto-detects column layout from header row.
 */

/** Split a CSV line handling double-quoted fields */
function splitCSVLine(line, delimiter = ',') {
    if (delimiter !== ',') return line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
        } else {
            current += line[i];
        }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
}

/** Detect best delimiter from a sample line */
function detectDelimiter(line) {
    const delimiters = [',', '\t', '|', ';'];
    return delimiters.reduce((best, d) => {
        return line.split(d).length > line.split(best).length ? d : best;
    }, ',');
}

/** Parse raw CSV/TSV text into array of string arrays */
function parseRows(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const delimiter = detectDelimiter(lines[0]);
    return lines.map(l => splitCSVLine(l, delimiter));
}

/** Find header row index (first row containing Korean bank finance keywords) */
function findHeaderRow(rows) {
    const financeKeywords = /거래|입금|출금|적요|잔액|금액|날짜|일자|사용처|내용|time|date|debit|credit|amount/i;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const rowStr = rows[i].join('');
        if (financeKeywords.test(rowStr) && rows[i].length >= 3) return i;
    }
    // Fallback: first row with at least 4 non-empty cells
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (rows[i].filter(c => c).length >= 4) return i;
    }
    return 0;
}

/**
 * Detect column indices from header row.
 * Returns map of { date, time, memo, memo2, outAmount, inAmount, amount, txType, balance }
 */
function detectColumns(headers) {
    const n = headers.map(h => h.replace(/\s+|\(.*?\)/g, '').toLowerCase());

    const find = (...keywords) => {
        for (const kw of keywords) {
            const idx = n.findIndex(h => h.includes(kw.toLowerCase()));
            if (idx >= 0) return idx;
        }
        return -1;
    };

    return {
        date: find('거래일자', '거래일시', '날짜', '일자', 'date', '거래날짜', '처리일자', '거래년월일'),
        time: find('거래시각', '거래시간', '시간', '시각', 'time', '처리시간'),
        memo: find('적요', '사용처', '내용', '거래내용', '메모', '기재내용', '적요명', '거래적요', '거래처', 'memo', 'desc', 'description', '상세내용'),
        memo2: find('기재내용', '거래메모', '추가내용', '세부내용'),
        outAmount: find('출금', '출금액', '출금금액', '찾으신금액', '인출금액', 'debit', 'withdrawal', '지출금액', '출금\원'),
        inAmount: find('입금', '입금액', '입금금액', '맡기신금액', 'credit', 'deposit', '수입금액', '입금\원'),
        amount: find('금액', '거래금액', 'amount', '거래액', '변동액'),
        txType: find('거래유형', '입출금', '구분', '거래구분', 'type', '입출구분', '거래종류', '거래타입'),
        balance: find('잔액', '잔고', 'balance', '거래후잔액', '거래후잔고', '잔액\원'),
    };
}

/** Parse Korean/Western date string to YYYY-MM-DD */
function parseDate(str) {
    if (!str) return null;
    const s = str.trim();

    // Already ISO: 2024-01-15
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // Remove separators and try compact forms
    const digits = s.replace(/[.\-\/\s]/g, '');

    // YYYYMMDDHHMMSS (datetime compact)
    if (/^\d{14}$/.test(digits)) return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
    // YYYYMMDD
    if (/^\d{8}$/.test(digits)) return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
    // YYMMDD (2-digit year)
    if (/^\d{6}$/.test(digits)) {
        const year = parseInt(digits.slice(0, 2)) > 50 ? '19' : '20';
        return `${year}${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4,6)}`;
    }
    // MM/DD/YYYY or DD/MM/YYYY
    const mdyMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2,'0')}-${mdyMatch[2].padStart(2,'0')}`;

    return null;
}

/** Parse time string to HH:MM */
function parseTime(str) {
    if (!str) return '00:00';
    const s = str.trim();
    // HH:MM:SS or HH:MM
    const colonMatch = s.match(/^(\d{1,2}):(\d{2})/);
    if (colonMatch) return `${colonMatch[1].padStart(2,'0')}:${colonMatch[2]}`;
    // HHMMSS or HHMM
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 4) return `${digits.slice(0,2)}:${digits.slice(2,4)}`;
    return '00:00';
}

/** Parse amount string: remove commas, currency symbols, return absolute number */
function parseAmount(str) {
    if (!str && str !== 0) return 0;
    const n = Number(String(str).replace(/[,\s원₩$￥+\-]/g, '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
}

/**
 * Main entry point. Parse bank CSV text into normalized transaction array.
 * @param {string} text Raw CSV/TSV text from bank export or copy-paste
 * @returns {Array<{date:string, time:string, rawMemo:string, amount:number, type:'income'|'expense'}>}
 */
export function parseBankCSV(text) {
    if (!text || !text.trim()) return [];

    const rows = parseRows(text);
    if (rows.length < 2) return [];

    const headerIdx = findHeaderRow(rows);
    const headers = rows[headerIdx];
    const cols = detectColumns(headers);
    const dataRows = rows.slice(headerIdx + 1);

    const result = [];

    for (const row of dataRows) {
        if (!row || row.length < 2) continue;
        if (row.every(cell => !cell.trim())) continue;
        // Skip summary/total rows
        if (row[0] && /합계|소계|total|sum/i.test(row[0])) continue;

        // --- Date ---
        let dateRaw = cols.date >= 0 ? (row[cols.date] || '') : '';
        let timeRaw = cols.time >= 0 ? (row[cols.time] || '') : '';

        // Combined datetime in one cell (e.g. "2024-01-15 14:30:00" or "20240115143000")
        if (dateRaw && dateRaw.includes(' ') && !timeRaw) {
            const parts = dateRaw.trim().split(/\s+/);
            dateRaw = parts[0];
            timeRaw = parts[1] || '';
        }
        if (dateRaw && /^\d{14}$/.test(dateRaw.replace(/\D/g, ''))) {
            const d = dateRaw.replace(/\D/g, '');
            dateRaw = d.slice(0, 8);
            timeRaw = timeRaw || d.slice(8, 12);
        }

        const date = parseDate(dateRaw);
        if (!date) continue; // Skip rows without a valid date

        const time = parseTime(timeRaw);

        // --- Memo ---
        let rawMemo = '';
        if (cols.memo >= 0) rawMemo = (row[cols.memo] || '').trim();
        if (cols.memo2 >= 0 && row[cols.memo2]?.trim()) {
            rawMemo += (rawMemo ? ' ' : '') + row[cols.memo2].trim();
        }
        // Fallback: join all non-date/non-amount cells
        if (!rawMemo) {
            rawMemo = row.filter((_, i) => i !== cols.date && i !== cols.time && i !== cols.balance && i !== cols.outAmount && i !== cols.inAmount && i !== cols.amount).filter(Boolean).join(' ').trim();
        }
        rawMemo = rawMemo.replace(/\s+/g, ' ').slice(0, 100);

        // --- Amount & Type ---
        let amount = 0;
        let type = 'expense';

        if (cols.outAmount >= 0 || cols.inAmount >= 0) {
            // Separate in/out columns (most Korean banks)
            const out = cols.outAmount >= 0 ? parseAmount(row[cols.outAmount]) : 0;
            const inp = cols.inAmount >= 0 ? parseAmount(row[cols.inAmount]) : 0;
            if (out > 0 && inp === 0) { amount = out; type = 'expense'; }
            else if (inp > 0 && out === 0) { amount = inp; type = 'income'; }
            else if (out > 0) { amount = out; type = 'expense'; } // Both filled (unusual) — prefer out
            else if (inp > 0) { amount = inp; type = 'income'; }
        } else if (cols.amount >= 0) {
            // Single amount column — determine type from txType or sign
            const rawAmt = (row[cols.amount] || '').trim();
            amount = parseAmount(rawAmt);

            if (cols.txType >= 0) {
                const txStr = (row[cols.txType] || '').toLowerCase();
                type = /입금|income|credit|deposit|수입|환급/.test(txStr) ? 'income' : 'expense';
            } else {
                // Negative number or starts with '-' → expense, '+' → income
                const signed = rawAmt.replace(/[,\s원₩]/g, '');
                type = signed.startsWith('+') ? 'income' : 'expense';
            }
        }

        if (amount === 0) continue; // Skip zero-amount rows

        result.push({ date, time, rawMemo, amount, type });
    }

    return result;
}

/** Format parsed transaction count summary */
export function getSummary(parsed) {
    const income = parsed.filter(t => t.type === 'income');
    const expense = parsed.filter(t => t.type === 'expense');
    return {
        total: parsed.length,
        incomeCount: income.length,
        expenseCount: expense.length,
        totalIncome: income.reduce((s, t) => s + t.amount, 0),
        totalExpense: expense.reduce((s, t) => s + t.amount, 0),
    };
}
