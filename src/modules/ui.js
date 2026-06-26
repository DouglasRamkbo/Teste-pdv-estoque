export function createUi(App) {
    return {
        updateConnectionStatus(isOnline, isForcedOffline = false) {
            const dot = document.getElementById('connection-status');
            if (!dot) return;
            if (isForcedOffline) {
                dot.className = 'w-2 h-2 rounded-full bg-red-500';
                dot.title = 'Offline (Modo de Segurança)';
            } else if (isOnline) {
                dot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
                dot.title = 'Conectado ao Banco de Dados';
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-yellow-500';
                dot.title = 'Tentando conectar...';
            }
        },

        toastTimeout: null,
        toast(msg, isError = false) {
            const el = document.getElementById('toast');
            if (!el) return;
            document.getElementById('toast-message').innerText = msg;
            document.getElementById('toast-title').innerText = isError ? 'Erro' : 'Sucesso';
            document.getElementById('toast-icon').className = isError
                ? 'ph-fill ph-warning-circle text-red-500 text-2xl'
                : 'ph-fill ph-check-circle text-brand-500 text-2xl';
            el.classList.remove('translate-x-full', 'opacity-0');
            if (this.toastTimeout) clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => el.classList.add('translate-x-full', 'opacity-0'), 3000);
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
        }
    };
}
