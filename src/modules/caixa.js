export function computeCaixaExpected(state, orders) {
    if (!state || state.status !== 'aberto') return 0;
    const openedDate = new Date(state.openedAt);
    const cashIn = (orders || [])
        .filter(o => new Date(o.date) >= openedDate && o.payment === 'Dinheiro')
        .reduce((s, o) => s + o.total, 0);
    const suprimentos = (state.transactions || [])
        .filter(t => t.type === 'suprimento')
        .reduce((s, t) => s + t.amount, 0);
    const sangrias = (state.transactions || [])
        .filter(t => t.type === 'sangria')
        .reduce((s, t) => s + t.amount, 0);
    return (state.openingBalance || 0) + cashIn + suprimentos - sangrias;
}

export function createCaixa(App) {
    function getState() {
        if (!App.data.caixa) {
            App.data.caixa = { status: 'fechado', openedAt: null, openingBalance: 0, transactions: [], closingBalance: null, closedAt: null };
        }
        return App.data.caixa;
    }

    let _pendingExpected = 0;

    return {
        render() {
            const state = getState();
            const isOpen = state.status === 'aberto';

            const statusEl = document.getElementById('caixa-status');
            if (statusEl) {
                statusEl.textContent = isOpen ? '● Caixa Aberto' : '● Caixa Fechado';
                statusEl.className = isOpen
                    ? 'text-sm font-bold px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-sm font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
            }

            document.getElementById('caixa-open-btn')?.classList.toggle('hidden', isOpen);
            document.getElementById('caixa-close-btn')?.classList.toggle('hidden', !isOpen);
            document.getElementById('caixa-sangria-btn')?.classList.toggle('hidden', !isOpen);
            document.getElementById('caixa-suprimento-btn')?.classList.toggle('hidden', !isOpen);

            const summaryEl = document.getElementById('caixa-summary');
            if (!summaryEl) return;

            if (!isOpen) {
                const lastInfo = state.closedAt
                    ? `<p class="text-sm text-gray-500 mt-2">Último fechamento: ${new Date(state.closedAt).toLocaleString('pt-BR')}</p>`
                    : '';
                summaryEl.innerHTML = `<div class="text-center py-8"><i class="ph ph-cash-register text-5xl text-gray-600 mb-3 block"></i><p class="text-gray-400">Abra o caixa para iniciar o atendimento.</p>${lastInfo}</div>`;
                return;
            }

            const openedDate = new Date(state.openedAt);
            const dayOrders = App.data.orders.filter(o => new Date(o.date) >= openedDate);
            const cashIn = dayOrders.filter(o => o.payment === 'Dinheiro').reduce((s, o) => s + o.total, 0);
            const sangrias = state.transactions.filter(t => t.type === 'sangria').reduce((s, t) => s + t.amount, 0);
            const expected = computeCaixaExpected(state, App.data.orders);

            const txHtml = state.transactions.length === 0
                ? '<p class="text-gray-500 text-sm py-4 text-center">Nenhuma movimentação manual.</p>'
                : state.transactions.slice().reverse().map(t => `
                    <div class="flex items-center justify-between bg-gray-800/80 p-3 rounded-lg border border-gray-700 text-sm">
                        <div class="flex items-center gap-2">
                            <span class="${t.type === 'sangria' ? 'text-red-400' : 'text-green-400'}">${t.type === 'sangria' ? '▼' : '▲'}</span>
                            <span class="font-medium text-gray-300">${App.utils.escapeHtml(t.description || t.type)}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="${t.type === 'sangria' ? 'text-red-400' : 'text-green-400'} font-bold">
                                ${t.type === 'sangria' ? '-' : '+'}${App.utils.formatMoney(t.amount)}
                            </span>
                            <span class="text-xs text-gray-500">${new Date(t.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>`).join('');

            summaryEl.innerHTML = `
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Saldo Inicial</p>
                        <p class="text-xl font-bold text-white mt-1">${App.utils.formatMoney(state.openingBalance || 0)}</p>
                        <p class="text-xs text-gray-500 mt-1">Abertura: ${new Date(state.openedAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Vendas Dinheiro</p>
                        <p class="text-xl font-bold text-green-400 mt-1">+${App.utils.formatMoney(cashIn)}</p>
                        <p class="text-xs text-gray-500 mt-1">${dayOrders.filter(o => o.payment === 'Dinheiro').length} vendas</p>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Sangrias</p>
                        <p class="text-xl font-bold text-red-400 mt-1">-${App.utils.formatMoney(sangrias)}</p>
                        <p class="text-xs text-gray-500 mt-1">${state.transactions.filter(t => t.type === 'sangria').length} sangrias</p>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-lg border border-gray-700 border-l-4 border-l-brand-500">
                        <p class="text-xs text-gray-400 uppercase tracking-wide">Saldo Esperado</p>
                        <p class="text-xl font-bold text-brand-400 mt-1">${App.utils.formatMoney(expected)}</p>
                        <p class="text-xs text-gray-500 mt-1">em caixa</p>
                    </div>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">Movimentações Manuais</h4>
                    <div class="space-y-2 max-h-52 overflow-y-auto custom-scroll">${txHtml}</div>
                </div>`;
        },

        openCaixa() { App.ui.openModal('modal-caixa-open'); },

        handleOpen(e) {
            e.preventDefault();
            const balance = parseFloat(document.getElementById('caixa-opening-balance').value) || 0;
            App.data.caixa = {
                status: 'aberto',
                openedAt: new Date().toISOString(),
                openingBalance: balance,
                transactions: [],
                closingBalance: null,
                closedAt: null
            };
            App.storage.save();
            App.ui.closeModal('modal-caixa-open');
            this.render();
            App.ui.toast(`Caixa aberto com ${App.utils.formatMoney(balance)}`);
        },

        closeCaixa() {
            if (getState().status !== 'aberto') return App.ui.toast('Caixa já está fechado.', true);
            const expected = computeCaixaExpected(getState(), App.data.orders);
            const state = getState();
            const openedDate = new Date(state.openedAt);
            const cashIn = App.data.orders.filter(o => new Date(o.date) >= openedDate && o.payment === 'Dinheiro').reduce((s, o) => s + o.total, 0);
            const suprimentos = state.transactions.filter(t => t.type === 'suprimento').reduce((s, t) => s + t.amount, 0);
            const sangrias = state.transactions.filter(t => t.type === 'sangria').reduce((s, t) => s + t.amount, 0);
            const expected = (state.openingBalance || 0) + cashIn + suprimentos - sangrias;
            _pendingExpected = expected;
            const expEl = document.getElementById('caixa-close-expected');
            if (expEl) expEl.textContent = App.utils.formatMoney(expected);
            const realEl = document.getElementById('caixa-close-real');
            if (realEl) realEl.value = expected.toFixed(2);
            App.ui.openModal('modal-caixa-close');
        },

        handleClose(e) {
            e.preventDefault();
            const real = parseFloat(document.getElementById('caixa-close-real').value) || 0;
            const expected = computeCaixaExpected(getState(), App.data.orders);
            const expected = _pendingExpected;
            const diff = real - expected;
            App.data.caixa = { ...getState(), status: 'fechado', closingBalance: real, closedAt: new Date().toISOString() };
            App.storage.save();
            App.ui.closeModal('modal-caixa-close');
            this.render();
            const msg = Math.abs(diff) < 0.01 ? 'Caixa fechado. Valores conferidos!' :
                diff > 0 ? `Caixa fechado. Sobra: ${App.utils.formatMoney(diff)}` :
                `Caixa fechado. Falta: ${App.utils.formatMoney(Math.abs(diff))}`;
            App.ui.toast(msg, diff < -0.01);
        },

        addTransaction(type) {
            if (getState().status !== 'aberto') return App.ui.toast('Abra o caixa primeiro.', true);
            document.getElementById('caixa-tx-type').value = type;
            document.getElementById('caixa-tx-title').textContent = type === 'sangria' ? 'Sangria de Caixa' : 'Suprimento de Caixa';
            document.getElementById('caixa-tx-amount').value = '';
            document.getElementById('caixa-tx-desc').value = '';
            App.ui.openModal('modal-caixa-tx');
        },

        handleTransaction(e) {
            e.preventDefault();
            const type = document.getElementById('caixa-tx-type').value;
            const amount = parseFloat(document.getElementById('caixa-tx-amount').value);
            const description = document.getElementById('caixa-tx-desc').value.trim() || (type === 'sangria' ? 'Sangria' : 'Suprimento');
            if (!amount || amount <= 0) return App.ui.toast('Valor inválido.', true);
            const state = getState();
            state.transactions.push({ type, amount, description, at: new Date().toISOString() });
            App.data.caixa = state;
            App.storage.save();
            App.ui.closeModal('modal-caixa-tx');
            this.render();
            App.ui.toast(`${type === 'sangria' ? 'Sangria' : 'Suprimento'}: ${App.utils.formatMoney(amount)}`);
        }
    };
}
