export function createDashboard(App) {
    return {
        render() {
            const dateInput = document.getElementById('dashboard-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

            const stockValue = App.data.products.reduce((acc, p) => acc + (p.cost * p.qty), 0);
            const elStock = document.getElementById('dash-stock-value');
            if (elStock) elStock.innerText = App.utils.formatMoney(stockValue);

            const dayOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));
            const dayTotal = dayOrders.reduce((acc, o) => acc + o.total, 0);
            const dayProfit = dayOrders.reduce((acc, o) => acc + (o.profit || 0), 0);
            const avgTicket = dayOrders.length > 0 ? dayTotal / dayOrders.length : 0;

            const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
            set('dash-date-sales', App.utils.formatMoney(dayTotal));
            set('dash-date-sales-count', `${dayOrders.length} pedidos realizados`);
            set('dash-date-profit', App.utils.formatMoney(dayProfit));
            set('dash-avg-ticket', App.utils.formatMoney(avgTicket));

            const payments = {};
            dayOrders.forEach(o => { payments[o.payment] = (payments[o.payment] || 0) + o.total; });
            const payContainer = document.getElementById('dash-payment-breakdown');
            if (payContainer) {
                if (Object.keys(payments).length === 0) {
                    payContainer.innerHTML = '<p class="text-gray-500 text-sm">Sem vendas na data.</p>';
                } else {
                    payContainer.innerHTML = Object.entries(payments).map(([method, val]) => {
                        const percent = dayTotal > 0 ? (val / dayTotal) * 100 : 0;
                        return `<div>
                            <div class="flex justify-between text-sm mb-1">
                                <span class="text-gray-300">${App.utils.escapeHtml(method)}</span>
                                <span class="text-white font-bold">${App.utils.formatMoney(val)}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2">
                                <div class="bg-brand-500 h-2 rounded-full" style="width: ${percent}%"></div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }

            const prodCount = {};
            dayOrders.forEach(o => { o.items.forEach(i => { prodCount[i.name] = (prodCount[i.name] || 0) + i.qty; }); });
            const sortedProds = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const topContainer = document.getElementById('dash-top-products');
            if (topContainer) {
                topContainer.innerHTML = sortedProds.length === 0
                    ? '<p class="text-gray-500 text-sm">Nenhum produto vendido.</p>'
                    : sortedProds.map(([name, qty]) =>
                        `<div class="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                            <span class="text-gray-200 text-sm truncate w-3/4">${App.utils.escapeHtml(name)}</span>
                            <span class="text-brand-400 font-bold text-sm">${qty} un</span>
                        </div>`
                    ).join('');
            }
        }
    };
}
