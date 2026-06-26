import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { debounce } from './utils.js';

export function createStorage(App, db, APP_ID) {
    let _saveCloudDebounced = null;

    const storage = {
        _unsubscribe: null,

        load() {
            if (App.isOffline) { this.loadLocalBackup(); return; }
            const user = App.currentUser;
            if (!user) { this.loadLocalBackup(); return; }

            if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }

            const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'data', 'store');

            this._unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    App.data.products = d.products || [];
                    App.data.orders = (d.orders || []).map(o => ({ ...o, status: o.status || 'concluida' }));
                    App.data.config = d.config || { companyName: "Foz Import's", lowStockThreshold: 5 };
                    if (!App.data.config.lowStockThreshold) App.data.config.lowStockThreshold = 5;

                    localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
                    localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
                    localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));
                } else {
                    this.loadLocalBackup();
                    if (App.data.products.length > 0) this.save();
                }

                App.renderAll();
                App.ui.updateBranding();
                const ci = document.getElementById('config-company-name');
                if (ci) ci.value = App.data.config.companyName;
                const li = document.getElementById('config-low-stock');
                if (li) li.value = App.data.config.lowStockThreshold ?? 5;
            }, (e) => {
                console.error('onSnapshot error:', e);
                this.loadLocalBackup();
            });
        },

        loadLocalBackup() {
            const safeParse = (key, fallback) => {
                try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
                catch { console.warn(`localStorage corrompido: ${key}`); return fallback; }
            };
            App.data.products = safeParse('foz_products_v3', []);
            const orders = safeParse('foz_orders_v3', []);
            App.data.orders = orders.map(o => ({ ...o, status: o.status || 'concluida' }));
            App.data.config = safeParse('foz_config_v3', { companyName: "Foz Import's", lowStockThreshold: 5 });
            if (!App.data.config.lowStockThreshold) App.data.config.lowStockThreshold = 5;

            if (App.data.products.length === 0) {
                App.data.products = [{ id: 1, name: 'Exemplo Produto', qty: 12, cost: 50.00, price: 100.00, img: '', category: '' }];
            }
            App.renderAll();
        },

        save() {
            localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
            localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
            localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));

            if (App.isOffline) return;

            if (!_saveCloudDebounced) {
                _saveCloudDebounced = debounce(async () => {
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
                        console.error('Cloud Save Error:', e);
                        App.ui.toast('Aviso: salvo localmente, falha na nuvem.', true);
                    }
                }, 1500);
            }
            _saveCloudDebounced();
        }
    };

    return storage;
}
