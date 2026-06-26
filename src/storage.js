import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { debounce } from './utils.js';

export function createStorage(App, db, APP_ID) {
    let _saveCloudDebounced = null;
    let _writeCount = 0;
    let _writeResetTimer = null;
    const MAX_WRITES_PER_MIN = 20;

    // Track local edits made while offline for conflict detection
    let _offlineEdits = false;
    let _localModifiedAt = null;

    function getStoreId() {
        return localStorage.getItem('foz_store_id') || (App.currentUser?.uid ?? null);
    }

    function bumpWriteCounter() {
        _writeCount++;
        if (!_writeResetTimer) {
            _writeResetTimer = setTimeout(() => { _writeCount = 0; _writeResetTimer = null; }, 60000);
        }
        if (_writeCount > MAX_WRITES_PER_MIN) {
            console.warn(`Rate limit: ${_writeCount} writes/min`);
            if (_writeCount === MAX_WRITES_PER_MIN + 1) {
                App.ui.toast('Muitas atualizações em pouco tempo — salvo localmente.', true);
            }
            return false;
        }
        return true;
    }

    const storage = {
        _unsubscribe: null,

        load() {
            if (App.isOffline) { this.loadLocalBackup(); return; }
            const user = App.currentUser;
            if (!user) { this.loadLocalBackup(); return; }

            const storeId = getStoreId();
            if (!storeId) { this.loadLocalBackup(); return; }

            if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }

            const docRef = doc(db, 'artifacts', APP_ID, 'stores', storeId, 'data', 'store');

            this._unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    const cloudUpdatedAt = d.lastUpdate ?? null;

                    // Conflict detection: if we have local offline edits that are newer than the cloud
                    if (_offlineEdits && _localModifiedAt && cloudUpdatedAt) {
                        const cloudTime = new Date(cloudUpdatedAt).getTime();
                        const localTime = new Date(_localModifiedAt).getTime();
                        if (localTime > cloudTime) {
                            this._handleConflict(d);
                            return;
                        }
                    }
                    _offlineEdits = false;
                    _localModifiedAt = null;

                    App.data.products = d.products || [];
                    App.data.orders = (d.orders || []).map(o => ({ ...o, status: o.status || 'concluida' }));
                    App.data.config = d.config || { companyName: "Foz Import's", lowStockThreshold: 5 };
                    if (!App.data.config.lowStockThreshold) App.data.config.lowStockThreshold = 5;
                    if (d.caixa) App.data.caixa = d.caixa;
                    App.data._members = Array.isArray(d.members) ? d.members : [];

                    localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
                    localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
                    localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));
                    if (App.data.caixa) localStorage.setItem('foz_caixa_v1', JSON.stringify(App.data.caixa));
                } else {
                    this.loadLocalBackup();
                    if (App.data.products.length > 0) this.save();
                }

                App.renderAll();
                App.ui.updateBranding();
                if (App.caixa) App.caixa.render();
                const ci = document.getElementById('config-company-name');
                if (ci) ci.value = App.data.config.companyName;
                const li = document.getElementById('config-low-stock');
                if (li) li.value = App.data.config.lowStockThreshold ?? 5;
            }, (e) => {
                console.error('onSnapshot error:', e);
                this.loadLocalBackup();
            });
        },

        _handleConflict(cloudData) {
            const conflictBar = document.getElementById('conflict-bar');
            if (!conflictBar) {
                _offlineEdits = false;
                this.save();
                return;
            }
            conflictBar.classList.remove('hidden');

            const replaceBtn = (id) => {
                const old = document.getElementById(id);
                if (!old) return null;
                const fresh = old.cloneNode(true);
                old.replaceWith(fresh);
                return fresh;
            };
            const keepBtn = replaceBtn('conflict-keep-local');
            const cloudBtn = replaceBtn('conflict-use-cloud');

            keepBtn?.addEventListener('click', () => {
                _offlineEdits = false;
                conflictBar.classList.add('hidden');
                this.save();
            });
            cloudBtn?.addEventListener('click', () => {
                _offlineEdits = false;
                _localModifiedAt = null;
                conflictBar.classList.add('hidden');
                App.data.products = cloudData.products || [];
                App.data.orders = (cloudData.orders || []).map(o => ({ ...o, status: o.status || 'concluida' }));
                App.data.config = cloudData.config || App.data.config;
                if (cloudData.caixa) App.data.caixa = cloudData.caixa;
                App.renderAll();
                if (App.caixa) App.caixa.render();
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
            App.data.caixa = safeParse('foz_caixa_v1', null);

            if (App.data.products.length === 0) {
                App.data.products = [{ id: '1', name: 'Exemplo Produto', qty: 12, cost: 50.00, price: 100.00, img: '', category: '' }];
            }
            App.renderAll();
            if (App.caixa) App.caixa.render();
        },

        _saveLocal() {
            localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
            localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
            localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));
            if (App.data.caixa) localStorage.setItem('foz_caixa_v1', JSON.stringify(App.data.caixa));
            else localStorage.removeItem('foz_caixa_v1');
        },

        _buildDocPayload() {
            const ownerUid = App.currentUser?.uid;
            const existingMembers = Array.isArray(App.data._members) ? App.data._members : [];
            const members = ownerUid && !existingMembers.includes(ownerUid)
                ? [...existingMembers, ownerUid]
                : existingMembers;
            return {
                products: App.data.products,
                orders: App.data.orders,
                config: App.data.config,
                caixa: App.data.caixa || null,
                members,
                lastUpdate: new Date().toISOString()
            };
        },

        save() {
            _localModifiedAt = new Date().toISOString();
            if (App.isOffline) _offlineEdits = true;

            this._saveLocal();

            if (App.isOffline) return;
            if (!bumpWriteCounter()) return;

            if (!_saveCloudDebounced) {
                _saveCloudDebounced = debounce(async () => {
                    try {
                        const user = App.currentUser;
                        const storeId = getStoreId();
                        if (user && storeId) {
                            const docRef = doc(db, 'artifacts', APP_ID, 'stores', storeId, 'data', 'store');
                            await setDoc(docRef, this._buildDocPayload());
                        }
                    } catch (e) {
                        console.error('Cloud Save Error:', e);
                        App.ui.toast('Aviso: salvo localmente, falha na nuvem.', true);
                    }
                }, 1500);
            }
            _saveCloudDebounced();
        },

        async saveNow() {
            _localModifiedAt = new Date().toISOString();
            this._saveLocal();
            if (App.isOffline) { _offlineEdits = true; return; }
            const user = App.currentUser;
            const storeId = getStoreId();
            if (!user || !storeId) return;
            const docRef = doc(db, 'artifacts', APP_ID, 'stores', storeId, 'data', 'store');
            await setDoc(docRef, this._buildDocPayload());
        },

        // Called after auth to set up store path
        setupStoreId(uid) {
            const existing = localStorage.getItem('foz_store_id');
            if (!existing) {
                // Default: user's own store
                localStorage.setItem('foz_store_id', uid);
            }
        },

        joinStore(storeId) {
            const trimmed = storeId.trim();
            if (!trimmed) return App.ui.toast('Código inválido.', true);
            localStorage.setItem('foz_store_id', trimmed);
            if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
            this.load();
            App.ui.toast('Loja vinculada com sucesso!');
        },

        getStoreCode() {
            return getStoreId() ?? '—';
        }
    };

    return storage;
}
