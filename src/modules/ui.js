export function createUi(App) {
    return {
        updateConnectionStatus(isOnline, isForcedOffline = false) {
            const dot = document.getElementById('connection-status');
            if (!dot) return;
            if (isForcedOffline) {
                dot.className = 'w-2 h-2 rounded-full bg-red-500';
                dot.title = 'Offline';
            } else if (isOnline) {
                dot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
                dot.title = 'Conectado';
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-yellow-500';
                dot.title = 'Conectando...';
            }
        },

        toastTimeout: null,
        toast(msg, isError = false) {
            const el = document.getElementById('toast');
            if (!el) return;
            // Hide any undo button for plain toasts
            const undoBtn = document.getElementById('toast-undo-btn');
            if (undoBtn) undoBtn.classList.add('hidden');
            document.getElementById('toast-message').innerText = msg;
            document.getElementById('toast-title').innerText = isError ? 'Erro' : 'Sucesso';
            document.getElementById('toast-icon').className = isError
                ? 'ph-fill ph-warning-circle text-red-500 text-2xl'
                : 'ph-fill ph-check-circle text-brand-500 text-2xl';
            el.classList.remove('translate-x-full', 'opacity-0');
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => el.classList.add('translate-x-full', 'opacity-0'), 3000);
        },

        toastWithUndo(msg, onUndo) {
            const el = document.getElementById('toast');
            if (!el) return;
            document.getElementById('toast-message').innerText = msg;
            document.getElementById('toast-title').innerText = 'Ação';
            document.getElementById('toast-icon').className = 'ph-fill ph-trash text-yellow-500 text-2xl';

            const undoBtn = document.getElementById('toast-undo-btn');
            if (undoBtn) {
                undoBtn.classList.remove('hidden');
                // Clone to remove old listeners
                const fresh = undoBtn.cloneNode(true);
                undoBtn.replaceWith(fresh);
                fresh.addEventListener('click', () => {
                    onUndo();
                    el.classList.add('translate-x-full', 'opacity-0');
                    if (this.toastTimeout) clearTimeout(this.toastTimeout);
                });
            }

            el.classList.remove('translate-x-full', 'opacity-0');
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                el.classList.add('translate-x-full', 'opacity-0');
                if (undoBtn) document.getElementById('toast-undo-btn')?.classList.add('hidden');
            }, 5000);
        },

        updateHeaderDate() {
            const d = new Date();
            const str = d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const el = document.getElementById('header-date');
            if (el) el.innerText = str.charAt(0).toUpperCase() + str.slice(1);
        },

        updateBranding() {
            const name = App.data.config.companyName;
            document.title = `${name} - Gestor 3.0`;
            const el = document.getElementById('app-header-title');
            if (el) el.innerText = name;
        },

        openModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('hidden');
        },

        closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
            App.data.currentModalOrder = null;
        },

        toggleDarkMode() {
            const html = document.documentElement;
            const isLight = html.classList.toggle('light-mode');
            localStorage.setItem('foz_theme', isLight ? 'light' : 'dark');
            const btn = document.getElementById('dark-mode-toggle');
            if (btn) {
                btn.title = isLight ? 'Modo Escuro' : 'Modo Claro';
                btn.innerHTML = isLight
                    ? '<i class="ph-bold ph-moon text-lg"></i>'
                    : '<i class="ph-bold ph-sun text-lg"></i>';
            }
        },

        initTheme() {
            const saved = localStorage.getItem('foz_theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const useLight = saved === 'light' || (saved === null && !prefersDark);
            if (useLight) {
                document.documentElement.classList.add('light-mode');
                const btn = document.getElementById('dark-mode-toggle');
                if (btn) {
                    btn.title = 'Modo Escuro';
                    btn.innerHTML = '<i class="ph-bold ph-moon text-lg"></i>';
                }
            }
        },

        updateUserDisplay(user) {
            const emailEl = document.getElementById('header-user-email');
            if (emailEl) emailEl.textContent = user?.email || 'Offline';
        }
    };
}
