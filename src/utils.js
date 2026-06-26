/**
 * @typedef {{ id: string, name: string, qty: number, cost: number, price: number, img?: string, category?: string }} Product
 * @typedef {{ id: string, date: string, customer: string, payment: string, items: CartItem[], subtotal?: number, discount?: number, discountType?: string, total: number, profit: number, notes?: string, status: string, editHistory?: Array<{at:string,summary:string}> }} Order
 * @typedef {{ productId: string, name: string, img?: string, price: number, cost: number, qty: number, total: number }} CartItem
 * @typedef {{ companyName: string, lowStockThreshold: number }} Config
 */

export function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
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
    return /^(https?:\/\/|data:image\/)/.test(url) ? url : '';
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
