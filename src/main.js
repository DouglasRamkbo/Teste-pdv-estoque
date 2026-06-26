import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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
        config: { companyName: "Foz Import's", lowStockThreshold: 5 }
    },

    isOffline: false,
    currentUser: null,

    async init() {
        const loader = document.getElementById('app-loading');
        if (loader) loader.classList.add('active');

        const safetyTimeout = setTimeout(() => {
            if (document.getElementById('app-loading')?.classList.contains('active')) {
                console.warn('Timeout de Conexão. Ativando Modo Offline.');
                this.enableOfflineMode();
            }
        }, 3000);

        let coreSetup = false;
        onAuthStateChanged(auth, async (user) => {
            clearTimeout(safetyTimeout);
            if (user) {
                this.isOffline = false;
                this.currentUser = user;
                this.ui.updateConnectionStatus(true);
                this.storage.load();
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
            console.error('Erro Fatal Firebase:', error);
            this.enableOfflineMode();
        }
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
        this.renderAll();

        const today = new Date().toISOString().split('T')[0];

        // Debounced search inputs (replaces onkeyup in HTML)
        const invSearch = document.getElementById('search-inventory');
        if (invSearch) invSearch.addEventListener('input', debounce(() => this.inventory.render(), 250));

        const ordSearch = document.getElementById('search-orders');
        if (ordSearch) ordSearch.addEventListener('input', debounce(() => this.orders.render(), 250));

        const cartSearch = document.getElementById('cart-search-product');
        if (cartSearch) cartSearch.addEventListener('input', debounce(() => this.cart.populateSelect(), 250));

        // Date filters
        const dailyFilter = document.getElementById('daily-date-filter');
        if (dailyFilter) { dailyFilter.value = today; dailyFilter.addEventListener('change', () => this.reports.renderDaily()); }

        const dashFilter = document.getElementById('dashboard-date-filter');
        if (dashFilter) { dashFilter.value = today; dashFilter.addEventListener('change', () => this.dashboard.render()); }

        // Historico date range
        const hFrom = document.getElementById('historico-date-from');
        if (hFrom) hFrom.addEventListener('change', () => this.orders.render());
        const hTo = document.getElementById('historico-date-to');
        if (hTo) hTo.addEventListener('change', () => this.orders.render());

        // Inventory category filter
        const catFilter = document.getElementById('inventory-category-filter');
        if (catFilter) catFilter.addEventListener('change', () => this.inventory.render());

        // Discount live update
        const discVal = document.getElementById('cart-discount-value');
        if (discVal) discVal.addEventListener('input', debounce(() => this.cart.render(), 250));
        const discType = document.getElementById('cart-discount-type');
        if (discType) discType.addEventListener('change', () => this.cart.render());

        // Config inputs
        const configInput = document.getElementById('config-company-name');
        if (configInput) configInput.value = this.data.config.companyName;
        const lowStockInput = document.getElementById('config-low-stock');
        if (lowStockInput) lowStockInput.value = this.data.config.lowStockThreshold ?? 5;

        // PWA service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW registration failed:', e));
        }
    },

    renderAll() {
        try { if (this.inventory) this.inventory.render(); } catch (e) { console.error('inventory render error:', e); }
        try { if (this.reports) { this.reports.renderDaily(); this.reports.renderGeneral(); } } catch (e) { console.error('reports render error:', e); }
        try { if (this.dashboard) this.dashboard.render(); } catch (e) { console.error('dashboard render error:', e); }
        try { if (this.orders) this.orders.render(); } catch (e) { console.error('orders render error:', e); }
        try { if (this.cart) { this.cart.render(); this.cart.populateSelect(); } } catch (e) { console.error('cart render error:', e); }
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

window.App = App;
App.init();
