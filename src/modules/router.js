export function createRouter(App) {
    return {
        init() { this.navigate('pdv'); },

        navigate(viewId) {
            document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="tab-"]').forEach(el => {
                el.classList.remove('tab-active');
                el.classList.add('tab-inactive');
            });

            const targetView = document.getElementById(`view-${viewId}`);
            const targetTab = document.getElementById(`tab-${viewId}`);
            if (targetView && targetTab) {
                targetView.classList.remove('hidden');
                targetTab.classList.remove('tab-inactive');
                targetTab.classList.add('tab-active');
            }

            if (viewId === 'pdv') {
                if (App.cart) App.cart.populateSelect();
                if (App.reports) App.reports.renderDaily();
                if (App.caixa) App.caixa.render();
            }
            if (viewId === 'dashboard') {
                if (App.dashboard) App.dashboard.render();
            }
            if (viewId === 'historico') {
                if (App.orders) App.orders.render();
            }
            if (viewId === 'relatorios') {
                if (App.reports) { App.reports.populateCustomerSelect(); App.reports.renderGeneral(); }
            }
        }
    };
}
