import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// CONFIGURAÇÃO DO FIREBASE
let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
} else {
    firebaseConfig = {
         apiKey: "AIzaSyDAipnkQ0hEuyBTXxhDItFSZuHUn1TQqwg",
         authDomain: "lk-assistencia.firebaseapp.com",
         projectId: "lk-assistencia",
         storageBucket: "lk-assistencia.firebasestorage.app",
         messagingSenderId: "1047697682416",
         appId: "1:1047697682416:web:37234abd5b616063693735",
         measurementId: "G-NW9E1BSYF9"
    };
}

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'foz-imports-default';
const INITIAL_AUTH_TOKEN = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const App = {
    data: {
        products: [],
        orders: [],
        cart: [],
        editingId: null,
        currentModalOrder: null,
        config: { companyName: "Foz Import's" }
    },

    isOffline: false,
    currentUser: null,

    async init() {
        const loader = document.getElementById('app-loading');
        if (loader) loader.classList.add('active');

        const safetyTimeout = setTimeout(() => {
            if (document.getElementById('app-loading').classList.contains('active')) {
                console.warn("Timeout de Conexão. Ativando Modo Offline.");
                this.enableOfflineMode();
            }
        }, 3000);

        let coreSetup = false;
        onAuthStateChanged(auth, async (user) => {
            clearTimeout(safetyTimeout);
            if (user) {
                this.isOffline = false; // limpa flag caso timeout tenha disparado antes
                this.currentUser = user;
                this.ui.updateConnectionStatus(true);
                await this.storage.load();
            } else {
                this.currentUser = null;
                this.ui.updateConnectionStatus(false);
                this.storage.loadLocalBackup();
            }
            if (!coreSetup) { coreSetup = true; this.setupCore(); }
            this.removeLoadingScreen();
        });

        try {
            if (INITIAL_AUTH_TOKEN) {
                await signInWithCustomToken(auth, INITIAL_AUTH_TOKEN);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            clearTimeout(safetyTimeout);
            console.error("Erro Fatal Firebase:", error);
            this.enableOfflineMode();
        }
    },

    enableOfflineMode() {
        if (this.isOffline) return;
        this.isOffline = true;
        this.ui.updateConnectionStatus(false, true);
        this.storage.loadLocalBackup();
        this.ui.toast("Modo Offline Ativado", true);
        this.removeLoadingScreen();
    },

    removeLoadingScreen() {
         const loading = document.getElementById('app-loading');
         if(loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.classList.remove('active'), 500);
         }
    },

    setupCore() {
        this.ui.updateHeaderDate();
        this.ui.updateBranding();
        this.router.init();
        this.renderAll();

        const today = new Date().toISOString().split('T')[0];
        const dailyFilter = document.getElementById('daily-date-filter');
        if(dailyFilter) {
            dailyFilter.value = today;
            dailyFilter.addEventListener('change', () => this.reports.renderDaily());
        }
        const dashFilter = document.getElementById('dashboard-date-filter');
        if(dashFilter) {
            dashFilter.value = today;
            dashFilter.addEventListener('change', () => this.dashboard.render());
        }
        const configInput = document.getElementById('config-company-name');
        if(configInput) configInput.value = this.data.config.companyName;
    },

    renderAll() {
        if(this.inventory) this.inventory.render();
        if(this.reports) {
            this.reports.renderDaily();
            this.reports.renderGeneral();
        }
        if(this.dashboard) this.dashboard.render();
        if(this.orders) this.orders.render();
        if(this.cart) this.cart.render();
    },

    storage: {
        async load() {
            if (App.isOffline) {
                 this.loadLocalBackup();
                return;
            }

            try {
                const user = App.currentUser;
                if (!user) return;

                const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'data', 'store');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const cloudData = docSnap.data();
                    App.data.products = cloudData.products || [];
                    App.data.orders = (cloudData.orders || []).map(order => ({...order, status: order.status || 'concluida'}));
                    App.data.config = cloudData.config || { companyName: "Foz Import's" };

                    localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
                    localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
                    localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));
                } else {
                    this.loadLocalBackup();
                    if(App.data.products.length > 0) {
                        await this.save();
                    }
                }

                App.renderAll();
                App.ui.updateBranding();
                const configInput = document.getElementById('config-company-name');
                if(configInput) configInput.value = App.data.config.companyName;

            } catch (e) {
                console.error("Erro ao carregar (Storage):", e);
                this.loadLocalBackup();
            }
        },

        loadLocalBackup() {
            const safeParse = (key, fallback) => {
                try {
                    const raw = localStorage.getItem(key);
                    return raw ? JSON.parse(raw) : fallback;
                } catch {
                    console.warn(`localStorage corrompido para chave: ${key}`);
                    return fallback;
                }
            };

            App.data.products = safeParse('foz_products_v3', []);
            const orders = safeParse('foz_orders_v3', []);
            App.data.orders = orders.map(order => ({...order, status: order.status || 'concluida'}));
            App.data.config = safeParse('foz_config_v3', { companyName: "Foz Import's" });

            if (App.data.products.length === 0) {
                App.data.products = [
                    { id: 1, name: 'Exemplo Produto', qty: 12, cost: 50.00, price: 100.00, img: '' }
                ];
            }
            App.renderAll();
        },

        async save() {
            localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
            localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
            localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));

            if (App.isOffline) return;

            try {
                const user = App.currentUser;
                if (user) {
                    const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'data', 'store');
                    await setDoc(docRef, {
                        products: App.data.products,
                        orders: App.data.orders,
                        config: App.data.config,
                        lastUpdate: new Date().toISOString()
                    });
                }
            } catch (e) {
                console.error("Cloud Save Error:", e);
                App.ui.toast("Aviso: salvo localmente, falha na nuvem.", true);
            }
        }
    },

    config: {
        saveSettings() {
            const name = document.getElementById('config-company-name').value.trim();
            if(name) {
                App.data.config.companyName = name;
                App.storage.save();
                App.ui.updateBranding();
                App.ui.toast("Configurações salvas!");
            } else {
                App.ui.toast("Nome inválido.", true);
            }
        }
    },

    router: {
        init() { this.navigate('pdv'); },
        navigate(viewId) {
            document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="tab-"]').forEach(el => { el.classList.remove('tab-active'); el.classList.add('tab-inactive'); });

            const targetView = document.getElementById(`view-${viewId}`);
            const targetTab = document.getElementById(`tab-${viewId}`);

            if (targetView && targetTab) {
                targetView.classList.remove('hidden');
                targetTab.classList.remove('tab-inactive');
                targetTab.classList.add('tab-active');
            }

            if (viewId === 'pdv') {
                if (App.cart) App.cart.populateSelect();
                if (App.reports) App.reports.renderDaily();
            }
            if (viewId === 'dashboard') {
                if (App.dashboard) App.dashboard.render();
            }
            if (viewId === 'historico') {
                if (App.orders) App.orders.render();
            }
            if (viewId === 'relatorios') {
                 if (App.reports) App.reports.populateCustomerSelect();
            }
        }
    },

    dashboard: {
        render() {
            const dateInput = document.getElementById('dashboard-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

            const stockValue = App.data.products.reduce((acc, p) => acc + (p.cost * p.qty), 0);
            const elStock = document.getElementById('dash-stock-value');
            if(elStock) elStock.innerText = App.utils.formatMoney(stockValue);

            const dayOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));
            const dayTotal = dayOrders.reduce((acc, o) => acc + o.total, 0);
            const dayProfit = dayOrders.reduce((acc, o) => acc + (o.profit || 0), 0);

            const elSales = document.getElementById('dash-date-sales');
            if(elSales) elSales.innerText = App.utils.formatMoney(dayTotal);
            const elCount = document.getElementById('dash-date-sales-count');
            if(elCount) elCount.innerText = `${dayOrders.length} pedidos realizados`;

            const elProfit = document.getElementById('dash-date-profit');
            if(elProfit) elProfit.innerText = App.utils.formatMoney(dayProfit);

            const payments = {};
            dayOrders.forEach(o => {
                payments[o.payment] = (payments[o.payment] || 0) + o.total;
            });
            const payContainer = document.getElementById('dash-payment-breakdown');
            if(payContainer) {
                if(Object.keys(payments).length === 0) {
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
            dayOrders.forEach(o => {
                o.items.forEach(i => {
                    prodCount[i.name] = (prodCount[i.name] || 0) + i.qty;
                });
            });
            const sortedProds = Object.entries(prodCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
            const topContainer = document.getElementById('dash-top-products');
            if(topContainer) {
                if(sortedProds.length === 0) {
                    topContainer.innerHTML = '<p class="text-gray-500 text-sm">Nenhum produto vendido.</p>';
                } else {
                    topContainer.innerHTML = sortedProds.map(([name, qty]) =>
                        `<div class="flex items-center justify-between bg-gray-700/50 p-2 rounded">
                                <span class="text-gray-200 text-sm truncate w-3/4">${App.utils.escapeHtml(name)}</span>
                                <span class="text-brand-400 font-bold text-sm">${qty} un</span>
                            </div>`
                    ).join('');
                }
            }
        }
    },

    reports: {
        renderGeneral() {
            const today = new Date().toISOString().split('T')[0];
            const month = today.substring(0, 7);

            const todayOrders = App.data.orders.filter(o => o.date.startsWith(today));
            const todayTotal = todayOrders.reduce((acc, o) => acc + o.total, 0);
            const elTodayT = document.getElementById('report-today-total');
            if(elTodayT) elTodayT.innerText = App.utils.formatMoney(todayTotal);
            const elTodayC = document.getElementById('report-today-count');
            if(elTodayC) elTodayC.innerText = `(${todayOrders.length} pedidos)`;

            const monthOrders = App.data.orders.filter(o => o.date.startsWith(month));
            const monthTotal = monthOrders.reduce((acc, o) => acc + o.total, 0);
            const elMonthT = document.getElementById('report-month-total');
            if(elMonthT) elMonthT.innerText = App.utils.formatMoney(monthTotal);
            const elMonthC = document.getElementById('report-month-count');
            if(elMonthC) elMonthC.innerText = `(${monthOrders.length} pedidos)`;
        },

        renderDaily() {
            const dateInput = document.getElementById('daily-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];

            const dailyOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));
            const total = dailyOrders.reduce((acc, o) => acc + o.total, 0);

            const profit = dailyOrders.reduce((acc, o) => acc + (o.profit || 0), 0);
            const cost = total - profit;

            const cash = dailyOrders.filter(o => o.payment === 'Dinheiro').reduce((acc,o)=>acc+o.total,0);
            const pix = dailyOrders.filter(o => o.payment === 'Pix').reduce((acc,o)=>acc+o.total,0);
            const card = dailyOrders.filter(o => o.payment?.includes('Cartão')).reduce((acc,o)=>acc+o.total,0);

            const elTotal = document.getElementById('daily-total');
            if(elTotal) elTotal.innerText = App.utils.formatMoney(total);
            const elProfit = document.getElementById('daily-profit');
            if(elProfit) elProfit.innerText = App.utils.formatMoney(profit);
            const elCost = document.getElementById('daily-cost');
            if(elCost) elCost.innerText = App.utils.formatMoney(cost);
            const elCash = document.getElementById('daily-cash');
            if(elCash) elCash.innerText = App.utils.formatMoney(cash);
            const elPix = document.getElementById('daily-pix');
            if(elPix) elPix.innerText = App.utils.formatMoney(pix);
            const elCard = document.getElementById('daily-card');
            if(elCard) elCard.innerText = App.utils.formatMoney(card);

            const badge = document.getElementById('daily-count-badge');
            if(badge) badge.innerText = `${dailyOrders.length} vendas`;

            const list = document.getElementById('daily-sales-list');
            const empty = document.getElementById('daily-empty');

            if(list) {
                if(dailyOrders.length === 0) {
                    empty.classList.remove('hidden');
                    list.innerHTML = '';
                } else {
                    empty.classList.add('hidden');
                    list.innerHTML = dailyOrders.slice().reverse().map(o => {
                        const time = new Date(o.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                        return `<tr class="hover:bg-gray-700/30 transition-colors">
                                <td class="px-6 py-3 text-gray-400">${time}</td>
                                <td class="px-6 py-3 text-white font-medium">${App.utils.escapeHtml(o.customer)}</td>
                                <td class="px-6 py-3 text-center"><span class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">${App.utils.escapeHtml(o.payment)}</span></td>
                                <td class="px-6 py-3 text-right text-brand-400 font-bold">${App.utils.formatMoney(o.total)}</td>
                                <td class="px-6 py-3 text-right text-purple-400 text-xs">+${App.utils.formatMoney(o.profit || 0)}</td>
                                <td class="px-6 py-3 text-center">
                                    <button onclick="App.orders.printReceipt(${o.id})" class="text-green-400 hover:text-white transition-colors p-1" title="Comprovante">
                                        <i class="ph-bold ph-receipt"></i>
                                    </button>
                                    <button onclick="App.orders.edit(${o.id})" class="text-blue-400 hover:text-white transition-colors p-1" title="Editar Pedido">
                                        <i class="ph-bold ph-pencil-simple"></i>
                                    </button>
                                </td>
                            </tr>`;
                    }).join('');
                }
            }
        },

        exportDailyPDF() {
            const dateInput = document.getElementById('daily-date-filter');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            const dailyOrders = App.data.orders.filter(o => o.date.startsWith(selectedDate));

            if(dailyOrders.length === 0) return App.ui.toast("Sem vendas para exportar.", true);

            const total = dailyOrders.reduce((acc, o) => acc + o.total, 0);
            const esc = App.utils.escapeHtml;

            const div = document.createElement('div');
            div.className = "p-8 bg-gray-900 text-white";
            div.innerHTML = `
                <div class="text-center mb-6">
                     <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                     <p class="text-gray-400">Extrato Diário - ${App.utils.formatDate(selectedDate)}</p>
                </div>
                <div class="mb-6 flex justify-between items-center border-b border-gray-700 pb-2">
                     <span class="font-bold">Total Vendido</span>
                     <span class="text-xl font-bold text-brand-500">${App.utils.formatMoney(total)}</span>
                </div>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-left border-b border-gray-700">
                            <th class="py-2">Hora</th>
                            <th class="py-2">Cliente</th>
                            <th class="py-2">Pagamento</th>
                            <th class="py-2 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dailyOrders.slice().reverse().map(o => `
                            <tr class="border-b border-gray-800">
                                <td class="py-2 text-gray-400">${new Date(o.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</td>
                                <td class="py-2">${esc(o.customer)}</td>
                                <td class="py-2">${esc(o.payment)}</td>
                                <td class="py-2 text-right font-medium">${App.utils.formatMoney(o.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="mt-8 text-center text-xs text-gray-500">
                    Gerado em ${new Date().toLocaleString('pt-BR')} pelo Gestor 3.0
                </div>
            `;

            const opt = {
                margin: 10,
                filename: `Extrato_${selectedDate}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#111827' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(div).save();
        },

        populateCustomerSelect() {
            const select = document.getElementById('report-customer-select');
            if(!select) return;
            const customers = [...new Set(App.data.orders.map(o => o.customer).filter(c => c && c !== 'Consumidor Final'))].sort();
            select.innerHTML = '<option value="">Selecione...</option>';
            customers.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.text = c;
                select.appendChild(opt);
            });
        },

        analyzeCustomer() {
            const name = document.getElementById('report-customer-select').value;
            const resultArea = document.getElementById('customer-analysis-result');
            const emptyArea = document.getElementById('customer-analysis-empty');

            if(!name) {
                resultArea.classList.add('hidden');
                emptyArea.classList.remove('hidden');
                return;
            }

            const orders = App.data.orders.filter(o => o.customer === name);
            const totalSpent = orders.reduce((acc, o) => acc + o.total, 0);
            const firstDate = new Date(orders.reduce((min, o) => {
                const t = new Date(o.date).getTime();
                return t < min ? t : min;
            }, Infinity));

            resultArea.classList.remove('hidden');
            emptyArea.classList.add('hidden');

            const esc = App.utils.escapeHtml;
            document.getElementById('pdf-customer-name').textContent = `Cliente: ${name}`;
            document.getElementById('pdf-gen-date').textContent = new Date().toLocaleDateString('pt-BR');
            document.getElementById('pdf-company-name').textContent = App.data.config.companyName;

            document.getElementById('cust-total').textContent = App.utils.formatMoney(totalSpent);
            document.getElementById('cust-orders-count').textContent = orders.length;
            document.getElementById('cust-first-date').textContent = firstDate.toLocaleDateString('pt-BR');

            const dateList = document.getElementById('cust-dates-list');
            dateList.innerHTML = orders.slice(0, 5).map(o =>
                `<li class="flex justify-between border-b border-gray-700 pb-1"><span>${new Date(o.date).toLocaleDateString('pt-BR')}</span> <span class="text-white">${App.utils.formatMoney(o.total)}</span></li>`
            ).join('');

            const prodCount = {};
            orders.forEach(o => o.items.forEach(i => prodCount[i.name] = (prodCount[i.name]||0)+i.qty));
            const favs = Object.entries(prodCount).sort((a,b) => b[1]-a[1]).slice(0,5);
            const prodList = document.getElementById('cust-products-list');
            prodList.innerHTML = favs.map(([p, q]) =>
                `<li class="flex justify-between border-b border-gray-700 pb-1"><span class="truncate pr-2">${esc(p)}</span> <span class="text-brand-400 font-bold">${q}x</span></li>`
            ).join('');
        },

        exportPDF() {
            const element = document.getElementById('customer-print-area');
            const opt = {
                margin: 10,
                filename: `Relatorio_Cliente.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#111827' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        }
    },

    orders: {
        render() {
            const tbody = document.getElementById('orders-list-body');
            const empty = document.getElementById('orders-empty');
            const term = document.getElementById('search-orders') ? document.getElementById('search-orders').value.toLowerCase() : '';

            if(!tbody) return;

            const filtered = App.data.orders.filter(o =>
                (o.customer ?? '').toLowerCase().includes(term) ||
                String(o.id ?? '').includes(term)
            );

            if(filtered.length === 0) {
                empty.classList.remove('hidden');
                tbody.innerHTML = '';
            } else {
                empty.classList.add('hidden');
                tbody.innerHTML = filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(o =>
                    `<tr class="hover:bg-gray-700/30 transition-colors border-b border-gray-700">
                            <td class="px-6 py-4 text-gray-400">${App.utils.formatDate(o.date, true)}</td>
                            <td class="px-6 py-4 font-medium text-white">${App.utils.escapeHtml(o.customer)}</td>
                            <td class="px-6 py-4 text-center"><span class="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">${App.utils.escapeHtml(o.payment)}</span></td>
                            <td class="px-6 py-4 text-right text-brand-400 font-bold">${App.utils.formatMoney(o.total)}</td>
                            <td class="px-6 py-4 text-center">
                                 <button onclick="App.orders.printReceipt(${o.id})" class="text-green-400 hover:text-white transition-colors p-1" title="Comprovante">
                                    <i class="ph-bold ph-receipt"></i>
                                </button>
                                 <button onclick="App.orders.edit(${o.id})" class="text-blue-400 hover:text-white transition-colors p-1" title="Editar Pedido">
                                    <i class="ph-bold ph-pencil-simple"></i>
                                </button>
                            </td>
                        </tr>`
                ).join('');
            }
        },
        printReceipt(id) {
            const order = App.data.orders.find(o => String(o.id) === String(id));
            if (!order) return;

            const esc = App.utils.escapeHtml;
            const div = document.createElement('div');
            div.className = "p-8 bg-white text-black";
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
                    <thead>
                        <tr class="border-b border-gray-800">
                            <th class="text-left py-1">Item</th>
                            <th class="text-center py-1">Qtd</th>
                            <th class="text-right py-1">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr>
                                <td class="py-1">${esc(item.name)}</td>
                                <td class="text-center py-1">${item.qty}</td>
                                <td class="text-right py-1">${App.utils.formatMoney(item.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="flex justify-between items-center border-t border-gray-800 pt-2">
                    <span class="font-bold text-lg">Total</span>
                    <span class="font-bold text-lg">${App.utils.formatMoney(order.total)}</span>
                </div>
                <div class="mt-8 text-center text-xs text-gray-400">
                    Obrigado pela preferência!
                </div>
            `;

            const opt = {
                margin: 10,
                filename: `Comprovante_${order.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(div).save();
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

            App.ui.openModal('modal-edit-order');
        },
        handleEditSubmit(e) {
            e.preventDefault();
            if (!App.data.currentModalOrder) return;

            const id = document.getElementById('edit-order-id').value;
            const customer = document.getElementById('edit-order-customer').value.trim();
            const dateStr = document.getElementById('edit-order-date').value;
            const payment = document.getElementById('edit-order-payment').value;

            if (!customer) return App.ui.toast("Nome do cliente obrigatório.", true);

            const orderIndex = App.data.orders.findIndex(o => String(o.id) === String(id));
            if (orderIndex === -1) return;

            App.data.orders[orderIndex].customer = customer;
            App.data.orders[orderIndex].date = new Date(dateStr).toISOString();
            App.data.orders[orderIndex].payment = payment;

            App.storage.save();
            App.renderAll();
            App.ui.closeModal('modal-edit-order');
            App.ui.toast("Pedido atualizado!");
        },
        deleteCurrent() {
            if (!App.data.currentModalOrder) return;
            if (confirm("Tem certeza? Esta ação devolverá os itens ao estoque.")) {
                const order = App.data.currentModalOrder;

                order.items.forEach(item => {
                    const product = App.data.products.find(p => String(p.id) === String(item.productId));
                    if(product) product.qty += item.qty;
                });

                App.data.orders = App.data.orders.filter(o => String(o.id) !== String(order.id));

                App.storage.save();
                App.renderAll();
                App.ui.closeModal('modal-edit-order');
                App.ui.toast("Pedido excluído e estoque estornado.");
            }
        },
        exportPDF() {
             if(App.data.orders.length === 0) return App.ui.toast("Sem histórico para exportar.", true);

             const esc = App.utils.escapeHtml;
             const div = document.createElement('div');
             div.className = "p-8 bg-gray-900 text-white";
             div.innerHTML = `
                 <div class="text-center mb-6">
                      <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                      <p class="text-gray-400">Histórico Completo de Vendas</p>
                 </div>
                 <table class="w-full text-sm">
                     <thead>
                         <tr class="text-left border-b border-gray-700">
                             <th class="py-2">Data</th>
                             <th class="py-2">Cliente</th>
                             <th class="py-2">Pagamento</th>
                             <th class="py-2 text-right">Total</th>
                         </tr>
                     </thead>
                     <tbody>
                         ${App.data.orders.slice().sort((a,b) => new Date(b.date) - new Date(a.date)).map(o => `
                             <tr class="border-b border-gray-800">
                                 <td class="py-2 text-gray-400">${App.utils.formatDate(o.date, true)}</td>
                                 <td class="py-2">${esc(o.customer)}</td>
                                 <td class="py-2">${esc(o.payment)}</td>
                                 <td class="py-2 text-right font-medium">${App.utils.formatMoney(o.total)}</td>
                             </tr>
                         `).join('')}
                     </tbody>
                 </table>
                 <div class="mt-8 text-center text-xs text-gray-500">
                     Gerado em ${new Date().toLocaleString('pt-BR')} pelo Gestor 3.0
                 </div>
             `;

             const opt = {
                 margin: 10,
                 filename: `Historico_Geral.pdf`,
                 image: { type: 'jpeg', quality: 0.98 },
                 html2canvas: { scale: 2, backgroundColor: '#111827' },
                 jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
             };
             html2pdf().set(opt).from(div).save();
        },
        exportCSV() {
            const csvEsc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
            let csv = 'Data,Cliente,Pagamento,Total,Lucro\n';
            App.data.orders.forEach(o => {
                csv += [o.date, csvEsc(o.customer), csvEsc(o.payment), o.total, o.profit ?? 0].join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "historico_vendas.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    },

    backup: {
        export() {
            const dataStr = JSON.stringify(App.data);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = 'backup_gestor_data.json';
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        },
        import(input) {
            const file = input.files[0];
            if(!file) return;
            if(file.size > 5 * 1024 * 1024) return App.ui.toast("Arquivo muito grande (máx 5MB).", true);
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const json = JSON.parse(e.target.result);
                    if(!Array.isArray(json.products) || !Array.isArray(json.orders)) {
                        return App.ui.toast("Arquivo inválido.", true);
                    }
                    const validProduct = p => p && typeof p.name === 'string' && typeof p.price === 'number' && typeof p.qty === 'number';
                    const validOrder = o => o && typeof o.customer === 'string' && typeof o.total === 'number' && Array.isArray(o.items);
                    if (!json.products.every(validProduct) || !json.orders.every(validOrder)) {
                        return App.ui.toast("Arquivo corrompido ou incompatível.", true);
                    }
                    App.data.products = json.products;
                    App.data.orders = json.orders.map(o => ({...o, status: o.status || 'concluida'}));
                    App.data.config = (json.config && typeof json.config.companyName === 'string')
                        ? json.config
                        : { companyName: "Foz Import's" };
                    App.storage.save();
                    App.renderAll();
                    App.ui.toast("Backup restaurado com sucesso!");
                } catch(err) {
                    App.ui.toast("Erro ao ler arquivo.", true);
                }
            };
            reader.readAsText(file);
        },
        clearAll() {
            if(confirm("ATENÇÃO: Isso apagará TODOS os dados locais e da nuvem. Continuar?")) {
                if(confirm("Tem certeza absoluta? Essa ação é irreversível.")) {
                    App.data.products = [];
                    App.data.orders = [];
                    App.data.cart = [];
                    App.storage.save();
                    location.reload();
                }
            }
        }
    },

    inventory: {
        render() {
            const tbody = document.getElementById('inventory-list');
            if(!tbody) return;

            const term = document.getElementById('search-inventory') ? document.getElementById('search-inventory').value.toLowerCase() : '';
            const filtered = App.data.products.filter(p => p.name.toLowerCase().includes(term));

            tbody.innerHTML = '';
            if(filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhum produto encontrado.</td></tr>';
                return;
            }
            filtered.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-700/30 transition-colors border-b border-gray-700 group';
                const safeImg = App.utils.safeImgUrl(p.img);
                const imgTag = safeImg ? `<img src="${App.utils.escapeHtml(safeImg)}" class="w-10 h-10 object-cover rounded bg-white" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg=='">` : `<div class="w-10 h-10 bg-gray-700 rounded flex items-center justify-center"><i class="ph ph-image text-gray-500"></i></div>`;
                tr.innerHTML = `<td class="px-6 py-4">${imgTag}</td><td class="px-6 py-4 font-medium text-gray-200">${App.utils.escapeHtml(p.name)}</td><td class="px-6 py-4 text-center"><span class="${p.qty < 5 ? 'text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded' : 'text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded'}">${p.qty}</span></td><td class="px-6 py-4 text-right text-gray-500">${App.utils.formatMoney(p.cost)}</td><td class="px-6 py-4 text-right text-gray-200">${App.utils.formatMoney(p.price)}</td><td class="px-6 py-4 text-center"><div class="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onclick="App.inventory.edit('${p.id}')" class="text-blue-400 hover:text-white p-2 rounded hover:bg-blue-600 transition-colors" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button><button onclick="App.inventory.delete('${p.id}')" class="text-red-400 hover:text-white p-2 rounded hover:bg-red-600 transition-colors" title="Excluir"><i class="ph-bold ph-trash"></i></button></div></td>`;
                tbody.appendChild(tr);
            });
        },
        exportPDF() {
            const term = (document.getElementById('search-inventory')?.value ?? '').toLowerCase();
            const filtered = App.data.products.filter(p => (p.name ?? '').toLowerCase().includes(term));

            if(filtered.length === 0) return App.ui.toast("Nada para exportar", true);

            const esc = App.utils.escapeHtml;
            const div = document.createElement('div');
            div.className = "p-8 bg-gray-900 text-white";
            const titleText = term ? `Tabela de Preços: "${esc(term)}"` : "Tabela Geral de Preços";

            div.innerHTML = `
                <div class="text-center mb-6">
                     <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                     <p class="text-gray-400">${titleText}</p>
                </div>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-left border-b border-gray-700">
                            <th class="py-2">Produto</th>
                            <th class="py-2 text-center">Qtd</th>
                            <th class="py-2 text-right">Preço Venda</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(p => `
                            <tr class="border-b border-gray-800">
                                <td class="py-2">${esc(p.name)}</td>
                                <td class="py-2 text-center">${p.qty}</td>
                                <td class="py-2 text-right font-bold text-brand-500">${App.utils.formatMoney(p.price)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="mt-8 text-center text-xs text-gray-500">
                    Gerado em ${new Date().toLocaleString('pt-BR')}
                </div>
            `;

            const opt = {
                margin: 10,
                filename: `Tabela_Precos_${term || 'Geral'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, backgroundColor: '#111827' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(div).save();
        },
        handleSubmit(e) {
            e.preventDefault();
            const name = document.getElementById('prod-name').value.trim();
            const img = document.getElementById('prod-img').value.trim();
            const qty = parseInt(document.getElementById('prod-qty').value);
            const cost = parseFloat(document.getElementById('prod-cost').value);
            const price = parseFloat(document.getElementById('prod-price').value);
            if(!name || isNaN(qty) || isNaN(cost) || isNaN(price)) return App.ui.toast("Preencha os campos.", true);

            if (App.data.editingId) {
                const index = App.data.products.findIndex(p => String(p.id) === String(App.data.editingId));
                if (index !== -1) App.data.products[index] = { ...App.data.products[index], name, img, qty, cost, price };
            } else {
                App.data.products.push({ id: Date.now(), name, qty, cost, price, img });
            }

            this.cancelEdit();
            App.storage.save();
            App.renderAll();
            App.ui.toast("Salvo com sucesso!");
        },
        edit(id) {
            const p = App.data.products.find(p => String(p.id) === String(id));
            if (!p) return;
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-img').value = p.img || '';
            document.getElementById('prod-qty').value = p.qty;
            document.getElementById('prod-cost').value = p.cost;
            document.getElementById('prod-price').value = p.price;
            App.data.editingId = p.id;
            document.getElementById('form-title').innerHTML = '<i class="ph-fill ph-pencil-simple text-blue-500"></i> Editar Produto';
            document.getElementById('btn-cancel-edit').classList.remove('hidden');
            document.getElementById('view-estoque').scrollIntoView({ behavior: 'smooth' });
        },
        cancelEdit() {
            App.data.editingId = null;
            document.getElementById('form-product').reset();
            document.getElementById('form-title').innerHTML = '<i class="ph-fill ph-plus-circle text-brand-500"></i> Gestão de Produto';
            document.getElementById('btn-cancel-edit').classList.add('hidden');
        },
        delete(id) {
            if(confirm('Tem certeza?')) {
                App.data.products = App.data.products.filter(p => String(p.id) !== String(id));
                App.storage.save();
                App.renderAll();
                App.ui.toast("Produto excluído.");
            }
        }
    },

    cart: {
        populateSelect() {
            const select = document.getElementById('cart-product-select');
            if(!select) return;
            select.innerHTML = '<option value="">Selecione um produto...</option>';
            const sorted = [...App.data.products].sort((a,b) => a.name.localeCompare(b.name));
            sorted.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.text = p.qty > 0 ? `${p.name}` : `🚫 ${p.name} (Sem estoque)`;
                if (p.qty <= 0) option.disabled = true;
                select.appendChild(option);
            });
            select.onchange = () => this.updatePreview(select.value);
        },
        updatePreview(id) {
            const box = document.getElementById('product-preview-info');
            if (!id) return box.classList.add('hidden');
            const p = App.data.products.find(x => String(x.id) === String(id));
            if (p) {
                box.classList.remove('hidden');
                document.getElementById('preview-name').textContent = p.name;
                document.getElementById('preview-stock-badge').textContent = `Estoque: ${p.qty}`;
                document.getElementById('preview-price').textContent = App.utils.formatMoney(p.price);
                document.getElementById('preview-img').src = App.utils.safeImgUrl(p.img) || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
            }
        },
        adjustQty(delta) {
            const input = document.getElementById('cart-qty');
            let val = parseInt(input.value) + delta;
            if (val < 1) val = 1;
            input.value = val;
        },
        add() {
            const select = document.getElementById('cart-product-select');
            const id = select.value;
            const qty = parseInt(document.getElementById('cart-qty').value);
            if(!id) return App.ui.toast("Selecione um produto", true);
            if(!qty || qty < 1) return App.ui.toast("Quantidade inválida.", true);
            const product = App.data.products.find(p => String(p.id) === String(id));
            if(!product) return App.ui.toast("Produto não encontrado.", true);
            const inCart = App.data.cart.find(c => String(c.productId) === String(id));
            const currentCartQty = inCart ? inCart.qty : 0;
            if ((currentCartQty + qty) > product.qty) return App.ui.toast("Estoque insuficiente!", true);

            if (inCart) {
                inCart.qty += qty;
                inCart.total = inCart.qty * inCart.price;
            } else {
                App.data.cart.push({ productId: product.id, name: product.name, img: product.img, price: product.price, cost: product.cost, qty: qty, total: qty * product.price });
            }
            document.getElementById('cart-qty').value = 1;
            select.value = "";
            this.updatePreview(null);
            this.render();
            App.ui.toast("Adicionado!");
        },
        remove(index) {
            App.data.cart.splice(index, 1);
            this.render();
        },
        render() {
            const container = document.getElementById('cart-items-container');
            container.innerHTML = '';
            let total = 0;
            if (App.data.cart.length === 0) {
                container.innerHTML = `<div class="text-center text-gray-500 mt-10"><i class="ph ph-basket text-4xl mb-2 opacity-50"></i><p class="text-sm">Carrinho vazio.</p></div>`;
                document.getElementById('btn-finalize').disabled = true;
            } else {
                document.getElementById('btn-finalize').disabled = false;
                App.data.cart.forEach((item, index) => {
                    total += item.total;
                    const div = document.createElement('div');
                    div.className = 'bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center gap-3 relative group animate-fade-in';
                    const fallbackImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                    const imgSrc = App.utils.escapeHtml(App.utils.safeImgUrl(item.img) || fallbackImg);
                    div.innerHTML = `<img src="${imgSrc}" class="w-10 h-10 rounded object-cover border border-gray-600"><div class="flex-1 min-w-0"><p class="text-white text-sm font-medium truncate">${App.utils.escapeHtml(item.name)}</p><p class="text-gray-400 text-xs">${item.qty}x ${App.utils.formatMoney(item.price)}</p></div><div class="font-bold text-brand-400 text-sm">${App.utils.formatMoney(item.total)}</div><button onclick="App.cart.remove(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110"><i class="ph-bold ph-x"></i></button>`;
                    container.appendChild(div);
                });
            }
            document.getElementById('cart-count').innerText = App.data.cart.length;
            document.getElementById('cart-total').innerText = App.utils.formatMoney(total);
        },
        finalize() {
            const customer = document.getElementById('cart-customer-name').value.trim() || 'Consumidor Final';
            const payment = document.getElementById('cart-payment-method').value;
            if (!payment) return App.ui.toast("Selecione o pagamento.", true);

            for (const item of App.data.cart) {
                const prod = App.data.products.find(p => String(p.id) === String(item.productId));
                if (!prod || prod.qty < item.qty) {
                    return App.ui.toast(`Estoque insuficiente para: ${item.name}`, true);
                }
            }

            let orderTotal = 0, orderProfit = 0;
            App.data.cart.forEach(item => {
                orderTotal += item.total;
                orderProfit += (item.price - item.cost) * item.qty;
                const prod = App.data.products.find(p => String(p.id) === String(item.productId));
                if(prod) prod.qty -= item.qty;
            });

            const orderId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            App.data.orders.unshift({ id: orderId, date: new Date().toISOString(), customer, payment, items: [...App.data.cart], total: orderTotal, profit: orderProfit, status: 'concluida' });
            App.data.cart = [];
            App.storage.save();
            this.render();
            this.populateSelect();
            document.getElementById('cart-customer-name').value = '';
            document.getElementById('cart-payment-method').value = '';
            App.ui.toast("Venda finalizada!");

            App.reports.renderDaily();
            App.renderAll();
        }
    },

    ui: {
        updateConnectionStatus(isOnline, isForcedOffline = false) {
            const dot = document.getElementById('connection-status');
            if (!dot) return;

            if (isForcedOffline) {
                dot.className = "w-2 h-2 rounded-full bg-red-500";
                dot.title = "Offline (Modo de Segurança)";
            } else if (isOnline) {
                dot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
                dot.title = "Conectado ao Banco de Dados";
            } else {
                dot.className = "w-2 h-2 rounded-full bg-yellow-500";
                dot.title = "Tentando conectar...";
            }
        },
        toastTimeout: null,
        toast(msg, isError = false) {
            const el = document.getElementById('toast');
            document.getElementById('toast-message').innerText = msg;
            document.getElementById('toast-title').innerText = isError ? 'Erro' : 'Sucesso';
            document.getElementById('toast-icon').className = isError ? 'ph-fill ph-warning-circle text-red-500 text-2xl' : 'ph-fill ph-check-circle text-brand-500 text-2xl';
            el.classList.remove('translate-x-full', 'opacity-0');
            if(this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => { el.classList.add('translate-x-full', 'opacity-0'); }, 3000);
        },
        updateHeaderDate() {
            const d = new Date();
            const str = d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('header-date').innerText = str.charAt(0).toUpperCase() + str.slice(1);
        },
        updateBranding() {
            const name = App.data.config.companyName;
            document.title = `${name} - Gestor 3.0`;
            document.getElementById('app-header-title').innerText = name;
        },
        openModal(id) {
            const modal = document.getElementById(id);
            if(modal) modal.classList.remove('hidden');
        },
        closeModal(id) {
            const modal = document.getElementById(id);
            if(modal) modal.classList.add('hidden');
            App.data.currentModalOrder = null;
        }
    },

    utils: {
        formatMoney(val) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); },
        formatDate(isoStr, includeTime = false) {
            const d = new Date(isoStr);
            if (isNaN(d)) return '—';
            const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
            if(includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
            return d.toLocaleDateString('pt-BR', opts);
        },
        escapeHtml(unsafe) { return String(unsafe ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); },
        safeImgUrl(url) {
            if (!url) return '';
            return /^(https?:\/\/|data:image\/)/.test(url) ? url : '';
        }
    }
};

// Exporta globalmente para os onclick inline do HTML
window.App = App;
App.init();
