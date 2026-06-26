import { sanitizeProductName } from '../utils.js';

const PAGE_SIZE = 50;

export function createInventory(App) {
    return {
        _sort: { col: 'name', dir: 'asc' },
        _page: 0,
        _undoBuffer: null, // { product, timer }

        render() {
            const tbody = document.getElementById('inventory-list');
            if (!tbody) return;

            const term = (document.getElementById('search-inventory')?.value ?? '').toLowerCase();
            const catFilter = (document.getElementById('inventory-category-filter')?.value ?? '').toLowerCase();
            const threshold = App.data.config.lowStockThreshold ?? 5;

            let filtered = App.data.products.filter(p => {
                const matchTerm = (p.name ?? '').toLowerCase().includes(term);
                const matchCat = !catFilter || (p.category ?? '').toLowerCase() === catFilter;
                return matchTerm && matchCat;
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

            document.querySelectorAll('.inv-sort-btn').forEach(btn => {
                const ind = btn.querySelector('.sort-indicator');
                if (ind) ind.textContent = btn.dataset.col === col ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
            });

            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (this._page >= totalPages) this._page = totalPages - 1;
            const start = this._page * PAGE_SIZE;
            const page = filtered.slice(start, start + PAGE_SIZE);

            tbody.innerHTML = '';
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">Nenhum produto encontrado.</td></tr>';
            } else {
                const fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                page.forEach(p => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-700/30 transition-colors border-b border-gray-700 group';
                    const safeImg = App.utils.safeImgUrl(p.img);
                    const imgTag = safeImg
                        ? `<img src="${App.utils.escapeHtml(safeImg)}" class="w-10 h-10 object-cover rounded bg-white" onerror="this.src='${fallback}'">`
                        : `<div class="w-10 h-10 bg-gray-700 rounded flex items-center justify-center"><i class="ph ph-image text-gray-500"></i></div>`;
                    const qtyClass = p.qty < threshold
                        ? 'text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded'
                        : 'text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded';

                    tr.innerHTML = `
                        <td class="px-6 py-4">${imgTag}</td>
                        <td class="px-6 py-4 font-medium text-gray-200">${App.utils.escapeHtml(p.name)}</td>
                        <td class="px-6 py-4 text-center text-gray-400 text-xs">${App.utils.escapeHtml(p.category || '—')}</td>
                        <td class="px-6 py-4 text-center"><span class="${qtyClass}">${p.qty}</span></td>
                        <td class="px-6 py-4 text-right text-gray-500">${App.utils.formatMoney(p.cost)}</td>
                        <td class="px-6 py-4 text-right text-gray-200">${App.utils.formatMoney(p.price)}</td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onclick="App.inventory.edit('${p.id}')" class="text-blue-400 hover:text-white p-2 rounded hover:bg-blue-600 transition-colors" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
                                <button onclick="App.inventory.delete('${p.id}')" class="text-red-400 hover:text-white p-2 rounded hover:bg-red-600 transition-colors" title="Excluir"><i class="ph-bold ph-trash"></i></button>
                            </div>
                        </td>`;
                    tbody.appendChild(tr);
                });
            }

            this._renderPagination('inv-pagination', total, () => this.render());
            this._updateCategoryFilter();
        },

        _renderPagination(containerId, total, onNavigate) {
            const container = document.getElementById(containerId);
            if (!container) return;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (totalPages <= 1) { container.innerHTML = ''; return; }
            const start = this._page * PAGE_SIZE + 1;
            const end = Math.min((this._page + 1) * PAGE_SIZE, total);
            container.innerHTML = `
                <div class="flex items-center justify-between py-3 px-4 border-t border-gray-700 text-sm text-gray-400">
                    <span>${start}–${end} de ${total}</span>
                    <div class="flex gap-2">
                        <button onclick="App.inventory._page=Math.max(0,App.inventory._page-1);App.inventory.render()"
                            class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
                            ${this._page === 0 ? 'disabled' : ''}>← Anterior</button>
                        <button onclick="App.inventory._page=Math.min(${totalPages-1},App.inventory._page+1);App.inventory.render()"
                            class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
                            ${this._page >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>
                    </div>
                </div>`;
        },

        sortBy(col) {
            if (this._sort.col === col) this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
            else { this._sort.col = col; this._sort.dir = 'asc'; }
            this._page = 0;
            this.render();
        },

        _updateCategoryFilter() {
            const select = document.getElementById('inventory-category-filter');
            if (!select) return;
            const current = select.value;
            const cats = [...new Set(App.data.products.map(p => p.category).filter(Boolean))].sort();
            select.innerHTML = '<option value="">Todas categorias</option>';
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                if (c === current) opt.selected = true;
                select.appendChild(opt);
            });
        },

        exportPDF() {
            const term = (document.getElementById('search-inventory')?.value ?? '').toLowerCase();
            const catFilter = (document.getElementById('inventory-category-filter')?.value ?? '').toLowerCase();
            let filtered = App.data.products.filter(p => {
                const matchTerm = (p.name ?? '').toLowerCase().includes(term);
                const matchCat = !catFilter || (p.category ?? '').toLowerCase() === catFilter;
                return matchTerm && matchCat;
            });
            if (filtered.length === 0) return App.ui.toast('Nada para exportar', true);

            const esc = App.utils.escapeHtml;
            const threshold = App.data.config.lowStockThreshold ?? 5;
            const totalValue = filtered.reduce((s, p) => s + (p.cost * p.qty), 0);
            const totalRetail = filtered.reduce((s, p) => s + (p.price * p.qty), 0);
            const div = document.createElement('div');
            div.className = 'p-8 bg-white text-black';
            div.innerHTML = `
                <div class="text-center mb-6 border-b pb-4">
                    <h1 class="text-2xl font-bold">${esc(App.data.config.companyName)}</h1>
                    <p class="text-gray-600 mt-1">Relatório de Estoque${term ? ` — "${esc(term)}"` : ''}${catFilter ? ` — Categoria: ${esc(catFilter)}` : ''}</p>
                    <p class="text-xs text-gray-400 mt-1">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
                </div>
                <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div class="bg-gray-50 p-3 rounded border"><p class="text-xs text-gray-500 uppercase">Total Itens</p><p class="text-xl font-bold">${filtered.length}</p></div>
                    <div class="bg-gray-50 p-3 rounded border"><p class="text-xs text-gray-500 uppercase">Valor de Custo</p><p class="text-xl font-bold">${App.utils.formatMoney(totalValue)}</p></div>
                    <div class="bg-gray-50 p-3 rounded border"><p class="text-xs text-gray-500 uppercase">Valor de Venda</p><p class="text-xl font-bold">${App.utils.formatMoney(totalRetail)}</p></div>
                </div>
                <table class="w-full text-sm border-collapse">
                    <thead><tr class="bg-gray-100 text-left border-b-2 border-gray-300">
                        <th class="py-2 px-3">Produto</th>
                        <th class="py-2 px-3">Categoria</th>
                        <th class="py-2 px-3 text-center">Qtd</th>
                        <th class="py-2 px-3 text-right">Custo Unit.</th>
                        <th class="py-2 px-3 text-right">Preço Venda</th>
                        <th class="py-2 px-3 text-right">Valor Total</th>
                    </tr></thead>
                    <tbody>${filtered.map((p, i) => `
                        <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}${p.qty < threshold ? ' text-red-600' : ''} border-b border-gray-200">
                            <td class="py-2 px-3 font-medium">${esc(p.name)}${p.qty < threshold ? ' ⚠' : ''}</td>
                            <td class="py-2 px-3 text-gray-500">${esc(p.category || '—')}</td>
                            <td class="py-2 px-3 text-center font-bold">${p.qty}</td>
                            <td class="py-2 px-3 text-right">${App.utils.formatMoney(p.cost)}</td>
                            <td class="py-2 px-3 text-right">${App.utils.formatMoney(p.price)}</td>
                            <td class="py-2 px-3 text-right font-medium">${App.utils.formatMoney(p.cost * p.qty)}</td>
                        </tr>`).join('')}</tbody>
                    <tfoot><tr class="bg-gray-100 border-t-2 border-gray-300 font-bold">
                        <td class="py-2 px-3" colspan="5">Total em Estoque</td>
                        <td class="py-2 px-3 text-right">${App.utils.formatMoney(totalValue)}</td>
                    </tr></tfoot>
                </table>
                ${filtered.filter(p => p.qty < threshold).length > 0 ? '<p class="mt-4 text-xs text-red-600">⚠ = produto com estoque abaixo do limiar configurado</p>' : ''}`;
            window.html2pdf().set({ margin: 10, filename: `Estoque_${new Date().toISOString().slice(0,10)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(div).save();
        },

        handleSubmit(e) {
            e.preventDefault();
            const rawName = document.getElementById('prod-name').value.trim();
            const sanity = sanitizeProductName(rawName);
            if (!sanity.ok) return App.ui.toast(sanity.reason, true);

            const img = document.getElementById('prod-img').value.trim();
            const qty = parseInt(document.getElementById('prod-qty').value);
            const cost = parseFloat(document.getElementById('prod-cost').value);
            const price = parseFloat(document.getElementById('prod-price').value);
            const category = (document.getElementById('prod-category')?.value ?? '').trim();
            if (isNaN(qty) || isNaN(cost) || isNaN(price)) return App.ui.toast('Preencha os campos.', true);

            if (App.data.editingId) {
                const idx = App.data.products.findIndex(p => String(p.id) === String(App.data.editingId));
                if (idx !== -1) App.data.products[idx] = { ...App.data.products[idx], name: rawName, img, qty, cost, price, category };
            } else {
                const id = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                App.data.products.push({ id, name: rawName, qty, cost, price, img, category });
            }

            this.cancelEdit();
            App.storage.save();
            App.renderAll();
            App.ui.toast('Salvo com sucesso!');
        },

        edit(id) {
            const p = App.data.products.find(p => String(p.id) === String(id));
            if (!p) return;
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-img').value = p.img || '';
            document.getElementById('prod-qty').value = p.qty;
            document.getElementById('prod-cost').value = p.cost;
            document.getElementById('prod-price').value = p.price;
            const catEl = document.getElementById('prod-category');
            if (catEl) catEl.value = p.category || '';
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
            const idx = App.data.products.findIndex(p => String(p.id) === String(id));
            if (idx === -1) return;
            const deleted = App.data.products[idx];

            // Cancel any pending undo
            if (this._undoBuffer) {
                clearTimeout(this._undoBuffer.timer);
                this._undoBuffer = null;
            }

            App.data.products.splice(idx, 1);
            App.storage.save();
            this.render();

            // Show undo toast for 5 seconds
            this._undoBuffer = {
                product: { ...deleted, _idx: idx },
                timer: setTimeout(() => { this._undoBuffer = null; }, 5000)
            };
            App.ui.toastWithUndo(`"${deleted.name}" excluído.`, () => this._undoDelete());
        },

        _undoDelete() {
            if (!this._undoBuffer) return;
            const { product, timer } = this._undoBuffer;
            clearTimeout(timer);
            this._undoBuffer = null;
            const { _idx, ...p } = product;
            // Re-insert at original position if possible
            const insertAt = Math.min(_idx, App.data.products.length);
            App.data.products.splice(insertAt, 0, p);
            App.storage.save();
            this.render();
            App.ui.toast('Exclusão desfeita!');
        }
    };
}
