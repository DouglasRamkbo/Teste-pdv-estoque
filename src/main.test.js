import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, escapeHtml, safeImgUrl, sanitizeProductName, debounce, genId, parseCSVLine } from './utils.js';
import { computeCaixaExpected } from './modules/caixa.js';

describe('formatMoney', () => {
    it('formats positive BRL', () => {
        const result = formatMoney(10.5);
        expect(result).toMatch(/10[,.]50/);
    });
    it('handles zero', () => {
        expect(formatMoney(0)).toMatch(/0[,.]00/);
    });
    it('handles negative', () => {
        expect(formatMoney(-5)).toMatch(/-/);
    });
});

describe('formatDate', () => {
    it('returns — for null', () => expect(formatDate(null)).toBe('—'));
    it('returns — for undefined', () => expect(formatDate(undefined)).toBe('—'));
    it('returns — for invalid string', () => expect(formatDate('invalid')).toBe('—'));
    it('formats valid ISO date', () => {
        const result = formatDate('2024-01-15T10:00:00Z');
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
    it('includes time when requested', () => {
        const result = formatDate('2024-01-15T10:30:00Z', true);
        expect(result).toMatch(/\d{2}:\d{2}/);
    });
});

describe('escapeHtml', () => {
    it('escapes <', () => expect(escapeHtml('<b>')).toBe('&lt;b&gt;'));
    it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
    it('escapes "', () => expect(escapeHtml('"test"')).toBe('&quot;test&quot;'));
    it("escapes '", () => expect(escapeHtml("it's")).toBe("it&#039;s"));
    it('handles null', () => expect(escapeHtml(null)).toBe(''));
    it('handles undefined', () => expect(escapeHtml(undefined)).toBe(''));
    it('handles 0', () => expect(escapeHtml(0)).toBe('0'));
});

describe('safeImgUrl', () => {
    it('allows https URLs', () => {
        const url = 'https://example.com/img.jpg';
        expect(safeImgUrl(url)).toBe(url);
    });
    it('blocks http URLs (mixed content)', () => {
        expect(safeImgUrl('http://example.com/img.jpg')).toBe('');
    });
    it('allows data:image/ URLs', () => {
        const url = 'data:image/png;base64,abc123';
        expect(safeImgUrl(url)).toBe(url);
    });
    it('blocks javascript: URLs', () => expect(safeImgUrl('javascript:alert(1)')).toBe(''));
    it('blocks data:text/ URLs', () => expect(safeImgUrl('data:text/html,<h1>xss</h1>')).toBe(''));
    it('blocks bare paths', () => expect(safeImgUrl('/etc/passwd')).toBe(''));
    it('returns empty for null', () => expect(safeImgUrl(null)).toBe(''));
    it('returns empty for empty string', () => expect(safeImgUrl('')).toBe(''));
});

describe('sanitizeProductName', () => {
    it('rejects names starting with =', () => {
        expect(sanitizeProductName('=SUM(A1)')).toMatchObject({ ok: false });
    });
    it('rejects names starting with +', () => {
        expect(sanitizeProductName('+1234')).toMatchObject({ ok: false });
    });
    it('rejects names starting with -', () => {
        expect(sanitizeProductName('-DROP TABLE')).toMatchObject({ ok: false });
    });
    it('rejects names starting with @', () => {
        expect(sanitizeProductName('@foo')).toMatchObject({ ok: false });
    });
    it('rejects names with <script', () => {
        expect(sanitizeProductName('<script>alert(1)</script>')).toMatchObject({ ok: false });
    });
    it('rejects <SCRIPT case-insensitive', () => {
        expect(sanitizeProductName('<SCRIPT>alert(1)</SCRIPT>')).toMatchObject({ ok: false });
    });
    it('accepts normal product name', () => {
        expect(sanitizeProductName('Vinho Tinto Cabernet')).toEqual({ ok: true });
    });
    it('accepts name with numbers', () => {
        expect(sanitizeProductName('Produto 123')).toEqual({ ok: true });
    });
    it('rejects empty string', () => {
        expect(sanitizeProductName('')).toMatchObject({ ok: false });
    });
    it('rejects null', () => {
        expect(sanitizeProductName(null)).toMatchObject({ ok: false });
    });
});

describe('computeCaixaExpected', () => {
    const openedAt = '2024-01-15T08:00:00Z';
    const baseState = { status: 'aberto', openedAt, openingBalance: 100, transactions: [] };

    it('returns 0 when caixa is closed', () => {
        expect(computeCaixaExpected({ ...baseState, status: 'fechado' }, [])).toBe(0);
    });

    it('returns opening balance with no movements', () => {
        expect(computeCaixaExpected(baseState, [])).toBe(100);
    });

    it('sums cash orders since opening', () => {
        const orders = [
            { date: '2024-01-15T09:00:00Z', payment: 'Dinheiro', total: 50 },
            { date: '2024-01-15T10:00:00Z', payment: 'Pix', total: 200 },
            { date: '2024-01-15T11:00:00Z', payment: 'Dinheiro', total: 30 },
        ];
        expect(computeCaixaExpected(baseState, orders)).toBe(180);
    });

    it('ignores orders before opening time', () => {
        const orders = [
            { date: '2024-01-15T07:00:00Z', payment: 'Dinheiro', total: 999 },
            { date: '2024-01-15T09:00:00Z', payment: 'Dinheiro', total: 25 },
        ];
        expect(computeCaixaExpected(baseState, orders)).toBe(125);
    });

    it('adds suprimentos and subtracts sangrias', () => {
        const state = {
            ...baseState,
            transactions: [
                { type: 'suprimento', amount: 50 },
                { type: 'sangria', amount: 20 },
            ]
        };
        expect(computeCaixaExpected(state, [])).toBe(130);
    });

    // Regression: previous handleClose re-parsed formatMoney output and lost
    // the thousands separator for values >= R$ 1.000.
    it('handles values >= 1000 without losing precision (regression)', () => {
        const orders = [{ date: '2024-01-15T09:00:00Z', payment: 'Dinheiro', total: 1234.56 }];
        expect(computeCaixaExpected(baseState, orders)).toBeCloseTo(1334.56, 2);
    });
});

describe('debounce', () => {
    it('delays function call', () => new Promise(resolve => {
        let count = 0;
        const fn = debounce(() => count++, 50);
        fn(); fn(); fn();
        setTimeout(() => { expect(count).toBe(1); resolve(); }, 120);
    }));
    it('calls only once for rapid calls', () => new Promise(resolve => {
        let lastArg = null;
        const fn = debounce((x) => { lastArg = x; }, 50);
        fn(1); fn(2); fn(3);
        setTimeout(() => { expect(lastArg).toBe(3); resolve(); }, 120);
    }));
    it('flush runs the pending call synchronously', () => {
        let called = 0;
        const fn = debounce(() => called++, 1000);
        fn(); fn();
        fn.flush();
        expect(called).toBe(1);
    });
    it('flush is a no-op when nothing is pending', () => {
        let called = 0;
        const fn = debounce(() => called++, 50);
        fn.flush();
        expect(called).toBe(0);
    });
    it('flush returns the value of the wrapped function (awaitable)', async () => {
        const fn = debounce(async (x) => x * 2, 1000);
        fn(21);
        const result = await fn.flush();
        expect(result).toBe(42);
    });
});

describe('genId', () => {
    it('returns a non-empty string', () => {
        const id = genId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });
    it('produces unique values across calls', () => {
        const ids = new Set();
        for (let i = 0; i < 50; i++) ids.add(genId());
        expect(ids.size).toBe(50);
    });
});

describe('parseCSVLine', () => {
    it('splits simple comma-separated values', () => {
        expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });
    it('preserves commas inside quoted fields', () => {
        expect(parseCSVLine('"Silva, João",10,5.5')).toEqual(['Silva, João', '10', '5.5']);
    });
    it('handles escaped quotes ("")', () => {
        expect(parseCSVLine('"He said ""hi""",2')).toEqual(['He said "hi"', '2']);
    });
    it('trims surrounding whitespace', () => {
        expect(parseCSVLine(' a , b ')).toEqual(['a', 'b']);
    });
    it('returns single field for line without separators', () => {
        expect(parseCSVLine('hello')).toEqual(['hello']);
    });
});
