import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { debounce, formatMoney, formatDate, escapeHtml, safeImgUrl } from './utils.js';
import { createStorage } from './storage.js';
import { createUi } from './modules/ui.js';
import { createRouter } from './modules/router.js';
import { createDashboard } from './modules/dashboard.js';
import { createReports } from './modules/reports.js';
import { createOrders } from './modules/orders.js';
import { createInventory } from './modules/inventory.js';
import { createCart } from './modules/cart.js';
import { createBackup } from './modules/backup.js';
import { createAuth } from './modules/auth.js';
import { createCaixa } from './modules/caixa.js';
import { createShortcuts } from './modules/shortcuts.js';

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
        appId: "1:1047697682416:web:37234abd5b616063693735"
    };
}

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'foz-imports-default';

const App = {
    data: {
        products: [],
        orders: [],
        cart: [],
        editingId: null,
        currentModalOrder: null,
        config: { companyName: "Foz Import's", lowStockThreshold: 5 },
        caixa: null
    },

    isOffline: false,
    currentUser: null,

    async init() {
        const loader = document.getElementById('app-loading');
        if (loader) loader.classList.add('active');

        this.ui.initTheme();

        // Safety timeout for auth
        const safetyTimeout = setTimeout(() => {
            if (document.getElementById('app-loading')?.classList.contains('active')) {
                console.warn('Auth timeout. Showing login screen.');
                this.removeLoadingScreen();
                this.auth.showLoginScreen();
            }
        }, 5000);

        let coreSetup = false;
        onAuthStateChanged(auth, async (user) => {
            clearTimeout(safetyTimeout);
            if (user) {
                this.isOffline = false;
                this.currentUser = user;
                this.ui.updateConnectionStatus(true);
                this.ui.updateUserDisplay(user);
                // Set up store ID for this user (defaults to their own UID)
                this.storage.setupStoreId(user.uid);
                this.auth.hideLoginScreen();
                this.storage.load();
            } else {
                this.currentUser = null;
                this.ui.updateConnectionStatus(false);
                this.ui.updateUserDisplay(null);
                this.removeLoadingScreen();
                this.auth.showLoginScreen();
            }
            if (!coreSetup) { coreSetup = true; this.setupCore(); }
            if (user) this.removeLoadingScreen();
        });
    },

    enableOfflineMode() {
        if (this.isOffline) return;
        this.isOffline = true;
        this.ui.updateConnectionStatus(false, true);
        this.storage.loadLocalBackup();
        this.ui.toast('Modo Offline Ativado', true);
        this.removeLoadingScreen();
    },

    removeLoadingScreen() {
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.classList.remove('active'), 500);
        }
    },

    setupCore() {
        this.ui.updateHeaderDate();
        this.ui.updateBranding();
        this.router.init();
        this.shortcuts.init();
        this.renderAll();

        const today = new Date().toISOString().split('T')[0];

        const invSearch = document.getElementById('search-inventory');
        if (invSearch) invSearch.addEventListener('input', debounce(() => this.inventory.render(), 250));

        const ordSearch = document.getElementById('search-orders');
        if (ordSearch) ordSearch.addEventListener('input', debounce(() => this.orders.render(), 250));

        const cartSearch = document.getElementById('cart-search-product');
        if (cartSearch) cartSearch.addEventListener('input', debounce(() => this.cart.populateSelect(), 250));

        const dailyFilter = document.getElementById('daily-date-filter');
        if (dailyFilter) { dailyFilter.value = today; dailyFilter.addEventListener('change', () => this.reports.renderDaily()); }

        const dashFilter = document.getElementById('dashboard-date-filter');
        if (dashFilter) { dashFilter.value = today; dashFilter.addEventListener('change', () => this.dashboard.render()); }

        const hFrom = document.getElementById('historico-date-from');
        if (hFrom) hFrom.addEventListener('change', () => { this.orders._page = 0; this.orders.render(); });
        const hTo = document.getElementById('historico-date-to');
        if (hTo) hTo.addEventListener('change', () => { this.orders._page = 0; this.orders.render(); });

        const catFilter = document.getElementById('inventory-category-filter');
        if (catFilter) catFilter.addEventListener('change', () => { this.inventory._page = 0; this.inventory.render(); });

        const discVal = document.getElementById('cart-discount-value');
        if (discVal) discVal.addEventListener('input', debounce(() => this.cart.render(), 250));
        const discType = document.getElementById('cart-discount-type');
        if (discType) discType.addEventListener('change', () => this.cart.render());

        const configInput = document.getElementById('config-company-name');
        if (configInput) configInput.value = this.data.config.companyName;
        const lowStockInput = document.getElementById('config-low-stock');
        if (lowStockInput) lowStockInput.value = this.data.config.lowStockThreshold ?? 5;

        const storeCodeEl = document.getElementById('config-store-code-text');
        if (storeCodeEl) storeCodeEl.textContent = this.storage.getStoreCode() ?? '—';

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW registration failed:', e));
        }
    },

    renderAll() {
        try { if (this.inventory) this.inventory.render(); } catch (e) { console.error('inventory:', e); }
        try { if (this.reports) { this.reports.renderDaily(); this.reports.renderGeneral(); } } catch (e) { console.error('reports:', e); }
        try { if (this.dashboard) this.dashboard.render(); } catch (e) { console.error('dashboard:', e); }
        try { if (this.orders) this.orders.render(); } catch (e) { console.error('orders:', e); }
        try { if (this.cart) { this.cart.render(); this.cart.populateSelect(); } } catch (e) { console.error('cart:', e); }
        try { if (this.caixa) this.caixa.render(); } catch (e) { console.error('caixa:', e); }
    },

    config: {
        saveSettings() {
            const name = document.getElementById('config-company-name').value.trim();
            const threshold = parseInt(document.getElementById('config-low-stock')?.value ?? 5) || 5;
            if (!name) return App.ui.toast('Nome inválido.', true);
            App.data.config.companyName = name;
            App.data.config.lowStockThreshold = threshold;
            App.storage.save();
            App.ui.updateBranding();
            App.ui.toast('Configurações salvas!');
        },

        copyStoreCode() {
            const code = App.storage.getStoreCode();
            navigator.clipboard?.writeText(code).then(() => App.ui.toast('Código copiado!')).catch(() => App.ui.toast('Código: ' + code));
        },

        joinStore() {
            const input = document.getElementById('config-store-join-code');
            if (!input) return;
            App.storage.joinStore(input.value.trim());
        }
    },

    utils: { formatMoney, formatDate, escapeHtml, safeImgUrl }
};

// Attach factory modules
App.storage = createStorage(App, db, APP_ID);
App.ui = createUi(App);
App.router = createRouter(App);
App.dashboard = createDashboard(App);
App.reports = createReports(App);
App.orders = createOrders(App);
App.inventory = createInventory(App);
App.cart = createCart(App);
App.backup = createBackup(App);
App.auth = createAuth(App, auth);
App.caixa = createCaixa(App);
App.shortcuts = createShortcuts(App);

window.App = App;
App.init();
