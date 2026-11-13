document.addEventListener('DOMContentLoaded', () => {
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

	main.innerHTML = window.MASTER_DOG_PAGES.render(document.body.dataset.page || 'home');
	window.MASTER_DOG_NAVIGATION.render();
	window.MASTER_DOG_SEARCH.init();
	window.MASTER_DOG_CLIENT.bindSharedActions();

	const footer = document.createElement('footer');
	footer.className = 'app-footer';
	footer.innerHTML = `MASTER of DOG · Prototype local. Les comptes, demandes et signalements ne sont pas transmis à un serveur. <nav aria-label="Liens utiles"><a href="${document.body.dataset.base || ''}pages/aide.html">Aide</a><a href="${document.body.dataset.base || ''}pages/confidentialite.html">Confidentialité</a><a href="${document.body.dataset.base || ''}pages/conditions.html">Conditions</a><a href="${document.body.dataset.base || ''}pages/signalement.html">Signaler</a></nav><span>${new Date().getFullYear()}</span>`;
	main.after(footer);
});
