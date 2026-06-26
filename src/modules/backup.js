import { parseCSVLine } from '../utils.js';

export function createBackup(App) {
    return {
        export() {
            const dataStr = JSON.stringify(App.data);
            const link = document.createElement('a');
            link.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr));
            link.setAttribute('download', 'backup_gestor_data.json');
            link.click();
        },

        import(input) {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) return App.ui.toast('Arquivo muito grande (máx 5MB).', true);
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!Array.isArray(json.products) || !Array.isArray(json.orders)) return App.ui.toast('Arquivo inválido.', true);
                    const validProduct = p => p && typeof p.name === 'string' && typeof p.price === 'number' && typeof p.qty === 'number';
                    const validOrder = o => o && typeof o.customer === 'string' && typeof o.total === 'number' && Array.isArray(o.items);
                    if (!json.products.every(validProduct) || !json.orders.every(validOrder)) return App.ui.toast('Arquivo corrompido ou incompatível.', true);
                    App.data.products = json.products;
                    App.data.orders = json.orders.map(o => ({ ...o, status: o.status || 'concluida' }));
                    const importedConfig = json.config && typeof json.config === 'object' ? json.config : {};
                    App.data.config = {
                        companyName: typeof importedConfig.companyName === 'string' ? importedConfig.companyName : "Foz Import's",
                        lowStockThreshold: Number.isFinite(importedConfig.lowStockThreshold) ? importedConfig.lowStockThreshold : 5
                    };
                    App.storage.save();
                    App.renderAll();
                    App.ui.toast('Backup restaurado com sucesso!');
                } catch (err) { App.ui.toast('Erro ao ler arquivo.', true); }
            };
            reader.readAsText(file);
        },

        importCSV(input) {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) return App.ui.toast('CSV muito grande (máx 2MB).', true);

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
                    if (lines.length < 2) return App.ui.toast('CSV vazio ou sem dados.', true);

                    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
                    const [iName, iQty, iCost, iPrice] = ['nome', 'quantidade', 'custo', 'preco'].map(k => header.indexOf(k));
                    if ([iName, iQty, iCost, iPrice].includes(-1)) return App.ui.toast('CSV precisa de colunas: nome,quantidade,custo,preco', true);

                    let imported = 0, skipped = 0;
                    for (let i = 1; i < lines.length; i++) {
                        const cols = parseCSVLine(lines[i]);
                        const name = cols[iName] ?? '';
                        const qty = parseInt(cols[iQty]);
                        const cost = parseFloat(cols[iCost]);
                        const price = parseFloat(cols[iPrice]);
                        if (!name || isNaN(qty) || isNaN(cost) || isNaN(price)) { skipped++; continue; }

                        const existing = App.data.products.find(p => p.name.toLowerCase() === name.toLowerCase());
                        if (existing) { existing.qty = qty; existing.cost = cost; existing.price = price; }
                        else {
                            App.data.products.push({ id: App.utils.genId(), name, qty, cost, price, img: '', category: '' });
                        }
                        imported++;
                    }
                    App.storage.save();
                    App.renderAll();
                    App.ui.toast(`CSV importado: ${imported} produtos, ${skipped} ignorados.`);
                } catch (err) { App.ui.toast('Erro ao processar CSV.', true); }
            };
            reader.readAsText(file);
        },

        async clearAll() {
            if (!confirm('ATENÇÃO: Isso apagará TODOS os dados locais e da nuvem. Continuar?')) return;
            if (!confirm('Tem certeza absoluta? Essa ação é irreversível.')) return;
            App.data.products = []; App.data.orders = []; App.data.cart = [];
            App.storage.save();
            if (App.storage.flushPendingSave) {
                try { await App.storage.flushPendingSave(); } catch (e) { console.warn('flush on clearAll:', e); }
            }
            location.reload();
        }
    };
}
