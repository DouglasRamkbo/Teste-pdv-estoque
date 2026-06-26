import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';

export function createAuth(App, auth) {
    const googleProvider = new GoogleAuthProvider();

    return {
        async loginWithEmail(email, password) {
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (e) {
                const msgs = {
                    'auth/invalid-credential': 'Email ou senha incorretos.',
                    'auth/user-not-found': 'Usuário não encontrado.',
                    'auth/wrong-password': 'Senha incorreta.',
                    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
                    'auth/invalid-email': 'Email inválido.',
                    'auth/network-request-failed': 'Sem conexão.'
                };
                App.ui.toast(msgs[e.code] || `Erro: ${e.code}`, true);
                throw e;
            }
        },

        async registerWithEmail(email, password) {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
            } catch (e) {
                const msgs = {
                    'auth/email-already-in-use': 'Email já cadastrado.',
                    'auth/weak-password': 'Senha fraca (mín. 6 caracteres).',
                    'auth/invalid-email': 'Email inválido.'
                };
                App.ui.toast(msgs[e.code] || `Erro: ${e.code}`, true);
                throw e;
            }
        },

        async loginWithGoogle() {
            try {
                await signInWithPopup(auth, googleProvider);
            } catch (e) {
                if (e.code !== 'auth/popup-closed-by-user') {
                    App.ui.toast('Erro ao entrar com Google.', true);
                }
            }
        },

        async resetPassword(email) {
            try {
                await sendPasswordResetEmail(auth, email);
                App.ui.toast('Email de redefinição enviado!');
            } catch (e) {
                App.ui.toast('Erro ao enviar email de redefinição.', true);
            }
        },

        async logout() {
            if (!confirm('Deseja sair da conta?')) return;
            if (App.storage.flushPendingSave) App.storage.flushPendingSave();
            if (App.storage._unsubscribe) { App.storage._unsubscribe(); App.storage._unsubscribe = null; }
            App.data.products = []; App.data.orders = []; App.data.cart = [];
            App.currentUser = null;
            localStorage.removeItem('foz_store_id');
            await signOut(auth);
            this.showLoginScreen();
        },

        continueOffline() {
            if (App.storage._unsubscribe) { App.storage._unsubscribe(); App.storage._unsubscribe = null; }
            this.hideLoginScreen();
            App.enableOfflineMode();
        },

        showLoginScreen() {
            document.getElementById('modal-auth')?.classList.remove('hidden');
            document.getElementById('main-app')?.classList.add('invisible', 'pointer-events-none');
        },

        hideLoginScreen() {
            document.getElementById('modal-auth')?.classList.add('hidden');
            document.getElementById('main-app')?.classList.remove('invisible', 'pointer-events-none');
        },

        switchTab(tab) {
            const isLogin = tab === 'login';
            document.getElementById('auth-login-form')?.classList.toggle('hidden', !isLogin);
            document.getElementById('auth-register-form')?.classList.toggle('hidden', isLogin);
            document.getElementById('auth-reset-form')?.classList.add('hidden');
            const lt = document.getElementById('auth-tab-login');
            const rt = document.getElementById('auth-tab-register');
            lt?.classList.toggle('tab-active', isLogin);
            lt?.classList.toggle('tab-inactive', !isLogin);
            rt?.classList.toggle('tab-active', !isLogin);
            rt?.classList.toggle('tab-inactive', isLogin);
        },

        showReset() {
            document.getElementById('auth-login-form')?.classList.add('hidden');
            document.getElementById('auth-register-form')?.classList.add('hidden');
            document.getElementById('auth-reset-form')?.classList.remove('hidden');
        },

        async handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const btn = document.getElementById('auth-login-btn');
            btn.disabled = true; btn.textContent = 'Entrando...';
            try { await this.loginWithEmail(email, password); }
            finally { btn.disabled = false; btn.textContent = 'Entrar'; }
        },

        async handleRegister(e) {
            e.preventDefault();
            const email = document.getElementById('auth-reg-email').value.trim();
            const password = document.getElementById('auth-reg-password').value;
            const confirmPw = document.getElementById('auth-reg-confirm').value;
            if (password !== confirmPw) return App.ui.toast('Senhas não coincidem.', true);
            const btn = document.getElementById('auth-register-btn');
            btn.disabled = true; btn.textContent = 'Criando...';
            try { await this.registerWithEmail(email, password); }
            finally { btn.disabled = false; btn.textContent = 'Criar Conta'; }
        },

        async handleReset(e) {
            e.preventDefault();
            const email = document.getElementById('auth-reset-email').value.trim();
            await this.resetPassword(email);
            this.switchTab('login');
        }
    };
}
