/**
 * @typedef {{ id: string, name: string, qty: number, cost: number, price: number, img?: string, category?: string }} Product
 * @typedef {{ id: string, date: string, customer: string, payment: string, items: CartItem[], subtotal?: number, discount?: number, discountType?: string, total: number, profit: number, notes?: string, status: string, editHistory?: Array<{at:string,summary:string}> }} Order
 * @typedef {{ productId: string, name: string, img?: string, price: number, cost: number, qty: number, total: number }} CartItem
 * @typedef {{ companyName: string, lowStockThreshold: number }} Config
 */

export function debounce(fn, delay) {
    let timer;
    let lastArgs = null;
    let lastThis = null;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(lastThis, lastArgs);
        }, delay);
    };
    debounced.flush = function () {
        if (!timer) return undefined;
        clearTimeout(timer);
        timer = null;
        return fn.apply(lastThis, lastArgs);
    };
    return debounced;
}

export function genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function parseCSVLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { cur += ch; }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { out.push(cur); cur = ''; }
            else { cur += ch; }
        }
    }
    out.push(cur);
    return out.map(c => c.trim());
}

export function formatMoney(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function formatDate(isoStr, includeTime = false) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d)) return '—';
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('pt-BR', opts);
}

export function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function safeImgUrl(url) {
    if (!url) return '';
    return /^(https:\/\/|data:image\/)/.test(url) ? url : '';
}

export function sanitizeProductName(name) {
    if (!name || typeof name !== 'string') return { ok: false, reason: 'Nome vazio.' };
    const trimmed = name.trim();
    if (/^[=+\-@]/.test(trimmed)) {
        return { ok: false, reason: 'Nome não pode começar com =, +, -, ou @.' };
    }
    if (/<script/i.test(trimmed)) {
        return { ok: false, reason: 'Nome contém conteúdo inválido.' };
    }
    return { ok: true };
}
