const PAGE_SIZE = 50;

export function createOrders(App) {
    return {
        _sort: { col: 'date', dir: 'desc' },
        _page: 0,

        render() {
            const tbody = document.getElementById('orders-list-body');
            const empty = document.getElementById('orders-empty');
            if (!tbody) return;

            const term = (document.getElementById('search-orders')?.value ?? '').toLowerCase();
            const dateFrom = document.getElementById('historico-date-from')?.value ?? '';
            const dateTo = document.getElementById('historico-date-to')?.value ?? '';

            let filtered = App.data.orders.filter(o => {
                const matchTerm = (o.customer ?? '').toLowerCase().includes(term) || String(o.id ?? '').includes(term);
                const oDate = (o.date ?? '').split('T')[0];
                return matchTerm && (!dateFrom || oDate >= dateFrom) && (!dateTo || oDate <= dateTo);
            });

            const { col, dir } = this._sort;
            filtered = filtered.slice().sort((a, b) => {
                let av = a[col] ?? '', bv = b[col] ?? '';
                if (typeof av === 'string') av = av.toLowerCase();
                if (typeof bv === 'string') bv = bv.toLowerCase();
                if (av < bv) return dir === 'asc' ? -1 : 1;
                if (av > bv) return dir === 'asc' ? 1 : -1;
                return 0;
            });

            document.querySelectorAll('.ord-sort-btn').forEach(btn => {
                const ind = btn.querySelector('.sort-indicator');
                if (ind) ind.textContent = btn.dataset.col === col ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
            });

            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (this._page >= totalPages) this._page = totalPages - 1;
            const start = this._page * PAGE_SIZE;
            const page = filtered.slice(start, start + PAGE_SIZE);

            if (filtered.length === 0) {
                empty?.classList.remove('hidden');
                tbody.innerHTML = '';
            } else {
                empty?.classList.add('hidden');
                tbody.innerHTML = page.map(o => `
                    <tr class="hover:bg-gray-700/30 transition-colors border-b border-gray-700">
                        <td class="px-6 py-4 text-gray-400">${App.utils.formatDate(o.date, true)}</td>
                        <td class="px-6 py-4 font-medium text-white">${App.utils.escapeHtml(o.customer)}</td>
                        <td class="px-6 py-4 text-center"><span class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">${App.utils.escapeHtml(o.payment)}</span></td>
                        <td class="px-6 py-4 text-right text-brand-400 font-bold">${App.utils.formatMoney(o.total)}</td>
                        <td class="px-6 py-4 text-center">
                            <button onclick="App.orders.printReceipt('${o.id}')" class="text-green-400 hover:text-white transition-colors p-1" title="Comprovante"><i class="ph-bold ph-receipt"></i></button>
                            <button onclick="App.orders.edit('${o.id}')" class="text-blue-400 hover:text-white transition-colors p-1" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
                        </td>
                    </tr>`
                ).join('');
            }

            // Pagination controls
            const pgContainer = document.getElementById('orders-pagination');
            if (pgContainer) {
                if (totalPages <= 1) { pgContainer.innerHTML = ''; }
                else {
                    const s = start + 1, e2 = Math.min(start + PAGE_SIZE, total);
                    pgContainer.innerHTML = `
                        <div class="flex items-center justify-between py-3 px-4 border-t border-gray-700 text-sm text-gray-400">
                            <span>${s}–${e2} de ${total} pedidos</span>
                            <div class="flex gap-2">
                                <button onclick="App.orders._page=Math.max(0,App.orders._page-1);App.orders.render()"
                                    class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
                                    ${this._page === 0 ? 'disabled' : ''}>← Anterior</button>
                                <button onclick="App.orders._page=Math.min(${totalPages-1},App.orders._page+1);App.orders.render()"
                                    class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
                                    ${this._page >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
                            </div>
                        </div>`;
                }
            }
        },

        sortBy(col) {
            if (this._sort.col === col) this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
            else { this._sort.col = col; this._sort.dir = 'asc'; }
            this._page = 0;
            this.render();
        },

        printReceipt(id) {
            const order = App.data.orders.find(o => String(o.id) === String(id));
            if (!order) return;
            const esc = App.utils.escapeHtml;
            const div = document.createElement('div');
            div.className = 'p-8 bg-white text-black';
            const discountRow = order.discount > 0
                ? `<tr><td colspan="3" class="text-right py-1 text-gray-600">Desconto</td><td class="text-right py-1 text-red-600">- ${App.utils.formatMoney(order.discount)}</td></tr>`
                : '';
            const subtotalRow = (order.subtotal != null && order.discount > 0)
                ? `<tr><td colspan="3" class="text-right py-1 text-gray-500 text-xs">Subtotal</td><td class="text-right py-1 text-gray-500 text-xs">${App.utils.formatMoney(order.subtotal)}</td></tr>`
                : '';
            const notesSection = order.notes
                ? `<div class="mt-4 pt-2 border-t border-gray-200 text-sm text-gray-600"><strong>Obs:</strong> ${esc(order.notes)}</div>`
                : '';
            div.innerHTML = `
                <div class="text-center mb-6">
                    <h1 class="text-xl font-bold uppercase tracking-wide">${esc(App.data.config.companyName)}</h1>
                    <p class="text-sm text-gray-600">Comprovante de Venda</p>
                    <p class="text-xs text-gray-500 mt-1">${new Date(order.date).toLocaleString('pt-BR')}</p>
                </div>
                <div class="mb-4 text-sm border-b border-gray-200 pb-2">
                    <p><strong>Cliente:</strong> ${esc(order.customer)}</p>
                    <p><strong>Pagamento:</strong> ${esc(order.payment)}</p>
                </div>
                <table class="w-full text-sm mb-4">
                    <thead><tr class="border-b border-gray-800"><th class="text-left py-1">Item</th><th class="text-center py-1">Qtd</th><th class="text-right py-1">Unit.</th><th class="text-right py-1">Total</th></tr></thead>
                    <tbody>
                        ${order.items.map(item => `<tr><td class="py-1">${esc(item.name)}</td><td class="text-center py-1">${item.qty}</td><td class="text-right py-1">${App.utils.formatMoney(item.price)}</td><td class="text-right py-1">${App.utils.formatMoney(item.total)}</td></tr>`).join('')}
                        ${subtotalRow}${discountRow}
                    </tbody>
                </table>
                <div class="flex justify-between items-center border-t border-gray-800 pt-2">
                    <span class="font-bold text-lg">Total</span>
                    <span class="font-bold text-lg">${App.utils.formatMoney(order.total)}</span>
                </div>
                ${notesSection}
                <div class="mt-8 text-center text-xs text-gray-400">Obrigado pela preferência!</div>`;
            window.html2pdf().set({ margin: 10, filename: `Comprovante_${order.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(div).save();
        },

        edit(id) {
            const order = App.data.orders.find(o => String(o.id) === String(id));
            if (!order) return;
            App.data.currentModalOrder = order;
            document.getElementById('edit-order-id').value = order.id;
            document.getElementById('edit-order-customer').value = order.customer;
            const date = new Date(order.date);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            document.getElementById('edit-order-date').value = date.toISOString().slice(0, 16);
            document.getElementById('edit-order-payment').value = order.payment;

            const histEl = document.getElementById('edit-order-history');
            if (histEl) {
                const hist = order.editHistory || [];
                histEl.innerHTML = hist.length === 0
                    ? '<p class="text-xs text-gray-500 italic">Sem histórico de edições.</p>'
                    : hist.slice().reverse().map(h =>
                        `<div class="text-xs text-gray-400 border-b border-gray-700 pb-1">
                            <span class="text-gray-500">${new Date(h.at).toLocaleString('pt-BR')}</span>
                            &mdash; ${App.utils.escapeHtml(h.summary)}
                        </div>`
                    ).join('');
            }
            App.ui.openModal('modal-edit-order');
        },

        handleEditSubmit(e) {
            e.preventDefault();
            if (!App.data.currentModalOrder) return;
            const id = document.getElementById('edit-order-id').value;
            const customer = document.getElementById('edit-order-customer').value.trim();
            const dateStr = document.getElementById('edit-order-date').value;
            const payment = document.getElementById('edit-order-payment').value;
            if (!customer) return App.ui.toast('Nome do cliente obrigatório.', true);

            const idx = App.data.orders.findIndex(o => String(o.id) === String(id));
            if (idx === -1) return;
            const prev = App.data.orders[idx];
            const changes = [];
            if (prev.customer !== customer) changes.push(`cliente: "${prev.customer}" → "${customer}"`);
            if (prev.payment !== payment) changes.push(`pagamento: "${prev.payment}" → "${payment}"`);

            App.data.orders[idx].customer = customer;
            App.data.orders[idx].date = new Date(dateStr).toISOString();
            App.data.orders[idx].payment = payment;
            if (!App.data.orders[idx].editHistory) App.data.orders[idx].editHistory = [];
            if (changes.length > 0) App.data.orders[idx].editHistory.push({ at: new Date().toISOString(), summary: changes.join('; ') });

            App.storage.save();
            App.renderAll();
            App.ui.closeModal('modal-edit-order');
            App.ui.toast('Pedido atualizado!');
        },

        deleteCurrent() {
            if (!App.data.currentModalOrder) return;
            if (confirm('Tem certeza? Esta ação devolverá os itens ao estoque.')) {
                const order = App.data.currentModalOrder;
                order.items.forEach(item => {
                    const product = App.data.products.find(p => String(p.id) === String(item.productId));
                    if (product) product.qty += item.qty;
                });
                App.data.orders = App.data.orders.filter(o => String(o.id) !== String(order.id));
                App.storage.save();
                App.renderAll();
                App.ui.closeModal('modal-edit-order');
                App.ui.toast('Pedido excluído e estoque estornado.');
            }
        },

        exportPDF() {
            if (App.data.orders.length === 0) return App.ui.toast('Sem histórico para exportar.', true);
            const esc = App.utils.escapeHtml;
            const div = document.createElement('div');
            div.className = 'p-8 bg-gray-900 text-white';
            div.innerHTML = `
                <div class="text-center mb-6">
                    <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                    <p class="text-gray-400">Histórico Completo de Vendas</p>
                </div>
                <table class="w-full text-sm">
                    <thead><tr class="text-left border-b border-gray-700"><th class="py-2">Data</th><th class="py-2">Cliente</th><th class="py-2">Pagamento</th><th class="py-2 text-right">Total</th></tr></thead>
                    <tbody>${App.data.orders.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(o =>
                        `<tr class="border-b border-gray-800"><td class="py-2 text-gray-400">${App.utils.formatDate(o.date, true)}</td><td class="py-2">${esc(o.customer)}</td><td class="py-2">${esc(o.payment)}</td><td class="py-2 text-right font-medium">${App.utils.formatMoney(o.total)}</td></tr>`
                    ).join('')}</tbody>
                </table>
                <div class="mt-8 text-center text-xs text-gray-500">Gerado em ${new Date().toLocaleString('pt-BR')}</div>`;
            window.html2pdf().set({ margin: 10, filename: 'Historico_Geral.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#111827' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(div).save();
        },

        exportCSV() {
            const csvEsc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
            let csv = 'Data,Cliente,Pagamento,Total,Lucro\n';
            App.data.orders.forEach(o => { csv += [o.date, csvEsc(o.customer), csvEsc(o.payment), o.total, o.profit ?? 0].join(',') + '\n'; });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = 'historico_vendas.csv';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }
    };
}
