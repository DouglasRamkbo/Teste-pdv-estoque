import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { debounce } from './utils.js';

export function createStorage(App, db, APP_ID) {
    let _saveCloudDebounced = null;
    let _writeCount = 0;
    let _writeResetTimer = null;
    const MAX_WRITES_PER_MIN = 20;
    const MAX_DOC_BYTES = 900 * 1024; // Firestore caps docs at 1 MB; warn earlier.
    let _sizeWarned = false;

    // Track local edits for conflict detection (offline OR online concurrent).
    let _offlineEdits = false;
    let _localModifiedAt = null;
    // Last cloud lastUpdate value we observed. If snapshot brings a different
    // one while we have unflushed local edits, treat as concurrent conflict.
    let _lastSeenCloudUpdate = null;

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

                    // Conflict detection covers two cases:
                    // 1. Offline edits newer than cloud (existing behavior).
                    // 2. Concurrent online edit: we have unflushed local changes
                    //    AND the cloud's lastUpdate is different from what we last saw.
                    const cloudChanged = _lastSeenCloudUpdate !== null && cloudUpdatedAt !== _lastSeenCloudUpdate;
                    const hasPendingLocal = _saveCloudDebounced && _localModifiedAt;
                    if (_offlineEdits && _localModifiedAt && cloudUpdatedAt) {
                        const cloudTime = new Date(cloudUpdatedAt).getTime();
                        const localTime = new Date(_localModifiedAt).getTime();
                        if (localTime > cloudTime) {
                            _lastSeenCloudUpdate = cloudUpdatedAt;
                            this._handleConflict(d);
                            return;
                        }
                    } else if (cloudChanged && hasPendingLocal) {
                        _lastSeenCloudUpdate = cloudUpdatedAt;
                        this._handleConflict(d);
                        return;
                    }
                    _lastSeenCloudUpdate = cloudUpdatedAt;
                    _offlineEdits = false;
                    _localModifiedAt = null;

                    App.data.products = d.products || [];
                    App.data.orders = (d.orders || []).map(o => ({ ...o, status: o.status || 'concluida' }));
                    App.data.config = d.config || { companyName: "Foz Import's", lowStockThreshold: 5 };
                    if (!App.data.config.lowStockThreshold) App.data.config.lowStockThreshold = 5;
                    if (d.caixa) App.data.caixa = d.caixa;

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
            if (conflictBar) {
                conflictBar.classList.remove('hidden');
                document.getElementById('conflict-keep-local')?.addEventListener('click', () => {
                    _offlineEdits = false;
                    conflictBar.classList.add('hidden');
                    this.save();
                }, { once: true });
                document.getElementById('conflict-use-cloud')?.addEventListener('click', () => {
                    _offlineEdits = false;
                    _localModifiedAt = null;
                    conflictBar.classList.add('hidden');
                    App.data.products = cloudData.products || [];
                    App.data.orders = (cloudData.orders || []).map(o => ({ ...o, status: o.status || 'concluida' }));
                    App.data.config = cloudData.config || App.data.config;
                    if (cloudData.caixa) App.data.caixa = cloudData.caixa;
                    App.renderAll();
                    if (App.caixa) App.caixa.render();
                }, { once: true });
            } else {
                // No conflict UI: default to keeping local changes
                _offlineEdits = false;
                this.save();
            }
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

        save() {
            _localModifiedAt = new Date().toISOString();
            if (App.isOffline) _offlineEdits = true;

            localStorage.setItem('foz_products_v3', JSON.stringify(App.data.products));
            localStorage.setItem('foz_orders_v3', JSON.stringify(App.data.orders));
            localStorage.setItem('foz_config_v3', JSON.stringify(App.data.config));
            if (App.data.caixa) localStorage.setItem('foz_caixa_v1', JSON.stringify(App.data.caixa));

            if (App.isOffline) return;
            if (!bumpWriteCounter()) return;

            if (!_saveCloudDebounced) {
                _saveCloudDebounced = debounce(async () => {
                    try {
                        const user = App.currentUser;
                        const storeId = getStoreId();
                        if (user && storeId) {
                            const payload = {
                                products: App.data.products,
                                orders: App.data.orders,
                                config: App.data.config,
                                caixa: App.data.caixa || null,
                                lastUpdate: new Date().toISOString()
                            };
                            const size = new Blob([JSON.stringify(payload)]).size;
                            if (size > MAX_DOC_BYTES && !_sizeWarned) {
                                _sizeWarned = true;
                                App.ui.toast('Atenção: dados perto do limite (1 MB). Exporte um backup e arquive pedidos antigos.', true);
                            }
                            const docRef = doc(db, 'artifacts', APP_ID, 'stores', storeId, 'data', 'store');
                            await setDoc(docRef, payload);
                            _lastSeenCloudUpdate = payload.lastUpdate;
                        }
                    } catch (e) {
                        console.error('Cloud Save Error:', e);
                        App.ui.toast('Aviso: salvo localmente, falha na nuvem.', true);
                    }
                }, 1500);
            }
            _saveCloudDebounced();
        },

        flushPendingSave() {
            if (_saveCloudDebounced && _saveCloudDebounced.flush) return _saveCloudDebounced.flush();
            return undefined;
        },

        // Clear session-bound state. Call on logout / switching to offline,
        // otherwise stale _lastSeenCloudUpdate from the previous user can
        // trigger a false conflict on the next sign-in.
        reset() {
            _offlineEdits = false;
            _localModifiedAt = null;
            _lastSeenCloudUpdate = null;
            _sizeWarned = false;
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
