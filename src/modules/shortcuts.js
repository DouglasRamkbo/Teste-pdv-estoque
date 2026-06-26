export function createShortcuts(App) {
    return {
        init() {
            document.addEventListener('keydown', (e) => {
                const tag = document.activeElement?.tagName;
                const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

                if (e.key === 'Escape') {
                    document.querySelectorAll('[id^="modal-"]').forEach(m => {
                        if (!m.classList.contains('hidden')) App.ui.closeModal(m.id);
                    });
                    return;
                }

                if (inInput) return;

                switch (e.key) {
                    case 'F2': e.preventDefault(); App.cart?.finalize(); break;
                    case 'F3': e.preventDefault(); App.router.navigate('pdv'); break;
                    case 'F4': e.preventDefault(); App.router.navigate('estoque'); break;
                    case 'F5': e.preventDefault(); App.router.navigate('historico'); break;
                    case 'F6': e.preventDefault(); App.router.navigate('relatorios'); break;
                    case 'F7': e.preventDefault(); App.router.navigate('dashboard'); break;
                    case 'n': case 'N': {
                        const pdvView = document.getElementById('view-pdv');
                        if (pdvView && !pdvView.classList.contains('hidden')) {
                            e.preventDefault();
                            document.getElementById('cart-search-product')?.focus();
                        }
                        break;
                    }
                    case '+': case '=': {
                        const pdvView = document.getElementById('view-pdv');
                        if (pdvView && !pdvView.classList.contains('hidden')) {
                            e.preventDefault();
                            App.cart?.adjustQty(1);
                        }
                        break;
                    }
                    case '-': {
                        const pdvView = document.getElementById('view-pdv');
                        if (pdvView && !pdvView.classList.contains('hidden')) {
                            e.preventDefault();
                            App.cart?.adjustQty(-1);
                        }
                        break;
                    }
                    case '?': {
                        e.preventDefault();
                        const hint = document.getElementById('shortcuts-hint');
                        if (hint) hint.classList.toggle('hidden');
                        break;
                    }
                }
            });
        }
    };
}
