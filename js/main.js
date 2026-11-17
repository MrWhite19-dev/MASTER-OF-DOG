document.addEventListener('DOMContentLoaded', async () => {
	if (!document.querySelector('link[rel="icon"]')) {
		const icon = document.createElement('link');
		icon.rel = 'icon';
		icon.type = 'image/svg+xml';
		icon.href = `${document.body.dataset.base || ''}assets/icons/favicon.svg`;
		document.head.append(icon);
	}
	document.querySelectorAll('.announcement, body > .site-header, body > .site-footer').forEach((element) => element.remove());
	const main = document.querySelector('#app-main');
	if (!main) return;
	await window.MASTER_DOG_CLIENT.syncServerSession();

	main.innerHTML = window.MASTER_DOG_PAGES.render(document.body.dataset.page || 'home');
	window.MASTER_DOG_ADMIN?.init();
	window.MASTER_DOG_NAVIGATION.render();
	window.MASTER_DOG_SEARCH.init();
	window.MASTER_DOG_CLIENT.bindSharedActions();
	initPrivacyAnalytics();

	const footer = document.createElement('footer');
	footer.className = 'app-footer';
	footer.innerHTML = `MASTER of DOG · Comptes et dossiers transmis au serveur configuré. Le catalogue et les commandes publiques sont encore en démonstration. <nav aria-label="Liens utiles"><a href="${document.body.dataset.base || ''}pages/aide.html">Aide</a><a href="${document.body.dataset.base || ''}pages/confidentialite.html">Confidentialité</a><a href="${document.body.dataset.base || ''}pages/conditions.html">Conditions</a><a href="${document.body.dataset.base || ''}pages/signalement.html">Signaler</a></nav><span>${new Date().getFullYear()}</span>`;
	main.after(footer);
});

async function initPrivacyAnalytics() {
	const base = document.body.dataset.base || '';
	try {
		const status = await fetch(`${base}api/track.php?action=status`).then((response) => response.json());
		if (!status.enabled) return;
		const consentKey = 'master-of-dog-analytics-consent';
		const track = async () => {
			const csrf = await fetch(`${base}api/auth.php?action=csrf`, { credentials: 'same-origin' }).then((response) => response.json());
			await fetch(`${base}api/track.php`, {
				method: 'POST', credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
				body: JSON.stringify({ path: location.pathname })
			});
		};
		if (localStorage.getItem(consentKey) === 'accepted') {
			await track();
			return;
		}
		if (localStorage.getItem(consentKey) === 'refused') return;
		const notice = document.createElement('aside');
		notice.className = 'analytics-consent';
		notice.setAttribute('aria-label', 'Préférences de mesure d’audience');
		notice.innerHTML = '<p>Autoriser les statistiques anonymes de fréquentation ? Aucune adresse IP n’est conservée.</p><div><button type="button" data-consent="accept">Autoriser</button><button type="button" data-consent="refuse">Refuser</button></div>';
		notice.addEventListener('click', async (event) => {
			const button = event.target.closest('[data-consent]');
			if (!button) return;
			const accepted = button.dataset.consent === 'accept';
			localStorage.setItem(consentKey, accepted ? 'accepted' : 'refused');
			notice.remove();
			if (accepted) await track();
		});
		document.body.append(notice);
	} catch {
		// Les statistiques restent désactivées en cas d’indisponibilité.
	}
}
