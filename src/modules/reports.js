export function createReports(App) {
    return {
        renderGeneral() {
            const today = new Date().toISOString().split('T')[0];
            const month = today.substring(0, 7);
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

            const todayOrders = App.data.orders.filter(o => o.date.startsWith(today));
            set('report-today-total', App.utils.formatMoney(todayOrders.reduce((a, o) => a + o.total, 0)));
            set('report-today-count', `(${todayOrders.length} pedidos)`);

            const monthOrders = App.data.orders.filter(o => o.date.startsWith(month));
            set('report-month-total', App.utils.formatMoney(monthOrders.reduce((a, o) => a + o.total, 0)));
            set('report-month-count', `(${monthOrders.length} pedidos)`);
        },

        renderDaily() {
            const dateInput = document.getElementById('daily-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            const dailyOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));
            const total = dailyOrders.reduce((acc, o) => acc + o.total, 0);
            const profit = dailyOrders.reduce((acc, o) => acc + (o.profit || 0), 0);
            const cost = total - profit;
            const cash = dailyOrders.filter(o => o.payment === 'Dinheiro').reduce((a, o) => a + o.total, 0);
            const pix = dailyOrders.filter(o => o.payment === 'Pix').reduce((a, o) => a + o.total, 0);
            const card = dailyOrders.filter(o => o.payment?.includes('Cartão')).reduce((a, o) => a + o.total, 0);

            const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            set('daily-total', App.utils.formatMoney(total));
            set('daily-profit', App.utils.formatMoney(profit));
            set('daily-cost', App.utils.formatMoney(cost));
            set('daily-cash', App.utils.formatMoney(cash));
            set('daily-pix', App.utils.formatMoney(pix));
            set('daily-card', App.utils.formatMoney(card));
            set('daily-count-badge', `${dailyOrders.length} vendas`);

            const list = document.getElementById('daily-sales-list');
            const empty = document.getElementById('daily-empty');
            if (list) {
                if (dailyOrders.length === 0) {
                    empty?.classList.remove('hidden');
                    list.innerHTML = '';
                } else {
                    empty?.classList.add('hidden');
                    list.innerHTML = dailyOrders.slice().reverse().map(o => {
                        const time = new Date(o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        return `<tr class="hover:bg-gray-700/30 transition-colors">
                            <td class="px-6 py-3 text-gray-400">${time}</td>
                            <td class="px-6 py-3 text-white font-medium">${App.utils.escapeHtml(o.customer)}</td>
                            <td class="px-6 py-3 text-center"><span class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">${App.utils.escapeHtml(o.payment)}</span></td>
                            <td class="px-6 py-3 text-right text-brand-400 font-bold">${App.utils.formatMoney(o.total)}</td>
                            <td class="px-6 py-3 text-right text-purple-400 text-xs">+${App.utils.formatMoney(o.profit || 0)}</td>
                            <td class="px-6 py-3 text-center">
                                <button onclick="App.orders.printReceipt('${o.id}')" class="text-green-400 hover:text-white transition-colors p-1" title="Comprovante"><i class="ph-bold ph-receipt"></i></button>
                                <button onclick="App.orders.edit('${o.id}')" class="text-blue-400 hover:text-white transition-colors p-1" title="Editar Pedido"><i class="ph-bold ph-pencil-simple"></i></button>
                            </td>
                        </tr>`;
                    }).join('');
                }
            }
        },

        renderPeriod(period) {
            const now = new Date();
            const container = document.getElementById('period-report-container');
            if (!container) return;

            let currentStart, currentEnd, prevStart, prevEnd;
            if (period === 'week') {
                const day = now.getDay();
                const diff = (day === 0 ? -6 : 1 - day);
                currentStart = new Date(now); currentStart.setDate(now.getDate() + diff); currentStart.setHours(0, 0, 0, 0);
                currentEnd = new Date(currentStart); currentEnd.setDate(currentStart.getDate() + 6); currentEnd.setHours(23, 59, 59, 999);
                prevStart = new Date(currentStart); prevStart.setDate(prevStart.getDate() - 7);
                prevEnd = new Date(currentEnd); prevEnd.setDate(prevEnd.getDate() - 7);
            } else {
                currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
                currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            }

            const inRange = (o, s, e) => { const d = new Date(o.date); return d >= s && d <= e; };
            const curOrders = App.data.orders.filter(o => inRange(o, currentStart, currentEnd));
            const prevOrders = App.data.orders.filter(o => inRange(o, prevStart, prevEnd));
            const curTotal = curOrders.reduce((a, o) => a + o.total, 0);
            const prevTotal = prevOrders.reduce((a, o) => a + o.total, 0);
            const curProfit = curOrders.reduce((a, o) => a + (o.profit || 0), 0);
            const prevProfit = prevOrders.reduce((a, o) => a + (o.profit || 0), 0);

            const pct = (cur, prev) => {
                if (prev === 0) return cur > 0 ? '+100%' : '—';
                const p = ((cur - prev) / prev) * 100;
                return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
            };
            const cls = (cur, prev) => cur >= prev ? 'text-green-400' : 'text-red-400';
            const label = period === 'week' ? 'Semana' : 'Mês';

            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <p class="text-xs text-gray-400 uppercase font-bold mb-1">${label} Atual — Vendas</p>
                        <p class="text-2xl font-bold text-white">${App.utils.formatMoney(curTotal)}</p>
                        <p class="text-xs mt-1 ${cls(curTotal, prevTotal)}">${pct(curTotal, prevTotal)} vs. ${label.toLowerCase()} anterior (${App.utils.formatMoney(prevTotal)})</p>
                        <p class="text-xs text-gray-500 mt-1">${curOrders.length} pedidos</p>
                    </div>
                    <div class="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <p class="text-xs text-gray-400 uppercase font-bold mb-1">${label} Atual — Lucro</p>
                        <p class="text-2xl font-bold text-white">${App.utils.formatMoney(curProfit)}</p>
                        <p class="text-xs mt-1 ${cls(curProfit, prevProfit)}">${pct(curProfit, prevProfit)} vs. ${label.toLowerCase()} anterior (${App.utils.formatMoney(prevProfit)})</p>
                    </div>
                </div>`;
        },

        exportDailyPDF() {
            const dateInput = document.getElementById('daily-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            const dailyOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));
            if (dailyOrders.length === 0) return App.ui.toast('Sem vendas para exportar.', true);

            const total = dailyOrders.reduce((acc, o) => acc + o.total, 0);
            const esc = App.utils.escapeHtml;
            const div = document.createElement('div');
            div.className = 'p-8 bg-gray-900 text-white';
            div.innerHTML = `
                <div class="text-center mb-6">
                    <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                    <p class="text-gray-400">Extrato Diário - ${App.utils.formatDate(selectedDate)}</p>
                </div>
                <div class="mb-6 flex justify-between items-center border-b border-gray-700 pb-2">
                    <span class="font-bold">Total Vendido</span>
                    <span class="text-xl font-bold">${App.utils.formatMoney(total)}</span>
                </div>
                <table class="w-full text-sm">
                    <thead><tr class="text-left border-b border-gray-700">
                        <th class="py-2">Hora</th><th class="py-2">Cliente</th>
                        <th class="py-2">Pagamento</th><th class="py-2 text-right">Valor</th>
                    </tr></thead>
                    <tbody>${dailyOrders.slice().reverse().map(o => `
                        <tr class="border-b border-gray-800">
                            <td class="py-2 text-gray-400">${new Date(o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td class="py-2">${esc(o.customer)}</td>
                            <td class="py-2">${esc(o.payment)}</td>
                            <td class="py-2 text-right font-medium">${App.utils.formatMoney(o.total)}</td>
                        </tr>`).join('')}</tbody>
                </table>
                <div class="mt-8 text-center text-xs text-gray-500">Gerado em ${new Date().toLocaleString('pt-BR')} pelo Gestor 3.0</div>`;
            window.html2pdf().set({ margin: 10, filename: `Extrato_${selectedDate}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#111827' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(div).save();
        },

        populateCustomerSelect() {
            const select = document.getElementById('report-customer-select');
            if (!select) return;
            const customers = [...new Set(App.data.orders.map(o => o.customer).filter(c => c && c !== 'Consumidor Final'))].sort();
            select.innerHTML = '<option value="">Selecione...</option>';
            customers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.text = c;
                select.appendChild(opt);
            });
        },

        analyzeCustomer() {
            const name = document.getElementById('report-customer-select').value;
            const resultArea = document.getElementById('customer-analysis-result');
            const emptyArea = document.getElementById('customer-analysis-empty');
            if (!name) { resultArea.classList.add('hidden'); emptyArea.classList.remove('hidden'); return; }

            const orders = App.data.orders.filter(o => o.customer === name);
            if (orders.length === 0) {
                resultArea.classList.add('hidden');
                emptyArea.classList.remove('hidden');
                App.ui.toast('Cliente sem pedidos no histórico.', true);
                return;
            }
            const totalSpent = orders.reduce((acc, o) => acc + o.total, 0);
            const firstDate = new Date(orders.reduce((min, o) => { const t = new Date(o.date).getTime(); return t < min ? t : min; }, Infinity));

            resultArea.classList.remove('hidden');
            emptyArea.classList.add('hidden');

            const esc = App.utils.escapeHtml;
            document.getElementById('pdf-customer-name').textContent = `Cliente: ${name}`;
            document.getElementById('pdf-gen-date').textContent = new Date().toLocaleDateString('pt-BR');
            document.getElementById('pdf-company-name').textContent = App.data.config.companyName;
            document.getElementById('cust-total').textContent = App.utils.formatMoney(totalSpent);
            document.getElementById('cust-orders-count').textContent = orders.length;
            document.getElementById('cust-first-date').textContent = firstDate.toLocaleDateString('pt-BR');

            document.getElementById('cust-dates-list').innerHTML = orders.slice(0, 5).map(o =>
                `<li class="flex justify-between border-b border-gray-700 pb-1"><span>${new Date(o.date).toLocaleDateString('pt-BR')}</span><span class="text-white">${App.utils.formatMoney(o.total)}</span></li>`
            ).join('');

            const prodCount = {};
            orders.forEach(o => o.items.forEach(i => prodCount[i.name] = (prodCount[i.name] || 0) + i.qty));
            document.getElementById('cust-products-list').innerHTML = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, q]) =>
                `<li class="flex justify-between border-b border-gray-700 pb-1"><span class="truncate pr-2">${esc(p)}</span><span class="text-brand-400 font-bold">${q}x</span></li>`
            ).join('');
        },

        exportPDF() {
            const element = document.getElementById('customer-print-area');
            window.html2pdf().set({ margin: 10, filename: 'Relatorio_Cliente.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#111827' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
        }
    };
}
