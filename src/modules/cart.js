export function createCart(App) {
    return {
        populateSelect() {
            const select = document.getElementById('cart-product-select');
            if (!select) return;
            const searchTerm = (document.getElementById('cart-search-product')?.value ?? '').toLowerCase();
            const threshold = App.data.config.lowStockThreshold ?? 5;

            select.innerHTML = '<option value="">Selecione um produto...</option>';
            [...App.data.products].sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
                if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) return;
                const option = document.createElement('option');
                option.value = p.id;
                const lowFlag = p.qty > 0 && p.qty <= threshold ? ' ⚠️' : '';
                option.text = p.qty > 0 ? `${p.name}${lowFlag}` : `🚫 ${p.name} (Sem estoque)`;
                if (p.qty <= 0) option.disabled = true;
                select.appendChild(option);
            });
            select.onchange = () => this.updatePreview(select.value);
        },

        updatePreview(id) {
            const box = document.getElementById('product-preview-info');
            if (!id) { box?.classList.add('hidden'); return; }
            const p = App.data.products.find(x => String(x.id) === String(id));
            if (p) {
                box.classList.remove('hidden');
                document.getElementById('preview-name').textContent = p.name;
                document.getElementById('preview-stock-badge').textContent = `Estoque: ${p.qty}`;
                document.getElementById('preview-price').textContent = App.utils.formatMoney(p.price);
                const fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                document.getElementById('preview-img').src = App.utils.safeImgUrl(p.img) || fallback;
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
            if (!id) return App.ui.toast('Selecione um produto', true);
            if (!qty || qty < 1) return App.ui.toast('Quantidade inválida.', true);
            const product = App.data.products.find(p => String(p.id) === String(id));
            if (!product) return App.ui.toast('Produto não encontrado.', true);
            const inCart = App.data.cart.find(c => String(c.productId) === String(id));
            const currentQty = inCart ? inCart.qty : 0;
            if ((currentQty + qty) > product.qty) return App.ui.toast('Estoque insuficiente!', true);

            if (inCart) { inCart.qty += qty; inCart.total = inCart.qty * inCart.price; }
            else App.data.cart.push({ productId: product.id, name: product.name, img: product.img, price: product.price, cost: product.cost, qty, total: qty * product.price });

            document.getElementById('cart-qty').value = 1;
            select.value = '';
            this.updatePreview(null);
            this.render();
            App.ui.toast('Adicionado!');
        },

        remove(index) { App.data.cart.splice(index, 1); this.render(); },

        render() {
            const container = document.getElementById('cart-items-container');
            if (!container) return;
            container.innerHTML = '';
            let subtotal = 0;

            const discountVal = parseFloat(document.getElementById('cart-discount-value')?.value ?? 0) || 0;
            const discountType = document.getElementById('cart-discount-type')?.value ?? '%';

            if (App.data.cart.length === 0) {
                container.innerHTML = `<div class="text-center text-gray-500 mt-10"><i class="ph ph-basket text-4xl mb-2 opacity-50"></i><p class="text-sm">Carrinho vazio.</p></div>`;
                document.getElementById('btn-finalize').disabled = true;
            } else {
                document.getElementById('btn-finalize').disabled = false;
                const fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0YjU1NjMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
                App.data.cart.forEach((item, index) => {
                    subtotal += item.total;
                    const div = document.createElement('div');
                    div.className = 'bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center gap-3 relative group animate-fade-in';
                    const imgSrc = App.utils.escapeHtml(App.utils.safeImgUrl(item.img) || fallback);
                    div.innerHTML = `
                        <img src="${imgSrc}" class="w-10 h-10 rounded object-cover border border-gray-600">
                        <div class="flex-1 min-w-0">
                            <p class="text-white text-sm font-medium truncate">${App.utils.escapeHtml(item.name)}</p>
                            <p class="text-gray-400 text-xs">${item.qty}x ${App.utils.formatMoney(item.price)}</p>
                        </div>
                        <div class="font-bold text-brand-400 text-sm">${App.utils.formatMoney(item.total)}</div>
                        <button onclick="App.cart.remove(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110"><i class="ph-bold ph-x"></i></button>`;
                    container.appendChild(div);
                });
            }

            const discount = discountType === '%'
                ? subtotal * (Math.min(discountVal, 100) / 100)
                : Math.min(discountVal, subtotal);
            const total = subtotal - discount;

            document.getElementById('cart-count').innerText = App.data.cart.length;
            const subEl = document.getElementById('cart-subtotal');
            if (subEl) subEl.innerText = App.utils.formatMoney(subtotal);
            const discEl = document.getElementById('cart-discount-display');
            if (discEl) discEl.innerText = discount > 0 ? `- ${App.utils.formatMoney(discount)}` : App.utils.formatMoney(0);
            document.getElementById('cart-total').innerText = App.utils.formatMoney(total);
        },

        finalize() {
            const customer = document.getElementById('cart-customer-name').value.trim() || 'Consumidor Final';
            const payment = document.getElementById('cart-payment-method').value;
            const notes = document.getElementById('cart-notes')?.value.trim() ?? '';
            if (!payment) return App.ui.toast('Selecione o pagamento.', true);

            const discountVal = parseFloat(document.getElementById('cart-discount-value')?.value ?? 0) || 0;
            const discountType = document.getElementById('cart-discount-type')?.value ?? '%';

            for (const item of App.data.cart) {
                const prod = App.data.products.find(p => String(p.id) === String(item.productId));
                if (!prod || prod.qty < item.qty) return App.ui.toast(`Estoque insuficiente para: ${item.name}`, true);
            }

            let orderSubtotal = 0, orderProfit = 0;
            App.data.cart.forEach(item => {
                orderSubtotal += item.total;
                orderProfit += (item.price - item.cost) * item.qty;
                const prod = App.data.products.find(p => String(p.id) === String(item.productId));
                if (prod) prod.qty -= item.qty;
            });

            const discount = discountType === '%'
                ? orderSubtotal * (Math.min(discountVal, 100) / 100)
                : Math.min(discountVal, orderSubtotal);
            const orderTotal = orderSubtotal - discount;
            orderProfit -= discount;

            const orderId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now().toString(36) + Math.random().toString(36).slice(2));

            App.data.orders.unshift({
                id: orderId, date: new Date().toISOString(), customer, payment,
                items: [...App.data.cart], subtotal: orderSubtotal, discount, discountType,
                total: orderTotal, profit: orderProfit, notes, status: 'concluida', editHistory: []
            });

            App.data.cart = [];
            App.storage.save();
            this.render();
            this.populateSelect();
            document.getElementById('cart-customer-name').value = '';
            document.getElementById('cart-payment-method').value = '';
            const notesEl = document.getElementById('cart-notes');
            if (notesEl) notesEl.value = '';
            const discValEl = document.getElementById('cart-discount-value');
            if (discValEl) discValEl.value = '';
            App.ui.toast('Venda finalizada!');
            App.reports.renderDaily();
            App.renderAll();
        }
    };
}
