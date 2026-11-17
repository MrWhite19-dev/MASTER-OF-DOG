
window.MASTER_DOG_NAVIGATION = (() => {
	const base = document.body.dataset.base || '';
	const path = (file) => `${base}${file}`;

	function render() {
		const activePage = document.body.dataset.page || 'home';
		const user = window.MASTER_DOG_STORE.currentUser();
		const favoritesCount = window.MASTER_DOG_STORE.favorites().length;
		const requestedSection = new URLSearchParams(location.search).get('section');
		const activeKey = activePage === 'admin' ? requestedSection || 'admin' : activePage === 'requests' ? 'reservations' : activePage === 'account' ? 'profile' : activePage;
		const header = document.querySelector('#site-header') || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
		header.id = 'site-header';
		const topLinks = user?.role === 'super_admin' ? [
			['admin', 'Vue générale', 'pages/super-admin.html'],
			['users', 'Utilisateurs', 'pages/super-admin.html?section=users'],
			['reports', 'Signalements', 'pages/super-admin.html?section=reports'],
			['reviews', 'Avis', 'pages/super-admin.html?section=reviews']
		] : [
			['home', 'Accueil', 'index.html'],
			['favorites', `Favoris (${favoritesCount})`, 'pages/favoris.html'],
			['reservations', 'Réservations', 'pages/reservation.html'],
			['notifications', 'Notifications', 'pages/notifications.html'],
			['profile', 'Profil', user ? 'pages/mon-espace.html' : 'pages/connexion.html']
		];
		header.innerHTML = `<header class="app-header"><a class="app-logo" href="${path(user?.role === 'super_admin' ? 'pages/super-admin.html' : 'index.html')}" aria-label="MASTER of DOG, accueil"><img class="app-logo__image" src="${path('assets/logo/logo_dog.png')}" alt=""><span class="app-logo__word">MASTER <em>of</em> DOG</span></a>
			<nav class="app-top-nav" id="app-top-nav" aria-label="Navigation principale">${topLinks.map(([key, label, file]) => `<a href="${path(file)}" ${activeKey === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
			<div class="app-top-actions">${user ? `<a class="app-user-chip" href="${path(user.role === 'super_admin' ? 'pages/super-admin.html' : 'pages/mon-espace.html')}"><span class="app-user-chip__avatar">${user.name.slice(0, 1).toUpperCase()}</span>${user.name}</a>` : `<a class="button button--subtle button--compact" href="${path('pages/connexion.html')}">Connexion</a>`}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="app-top-nav" aria-label="Ouvrir le menu">☰</button></div></header>`;

		const tabbar = document.querySelector('#mobile-tabbar') || document.body.appendChild(document.createElement('nav'));
		tabbar.id = 'mobile-tabbar';
		tabbar.className = 'mobile-tabbar';
		tabbar.setAttribute('aria-label', 'Navigation principale sur mobile');
		const tabs = [
			['home', 'Accueil', '⌂', 'index.html'],
			['favorites', 'Favoris', '♡', 'pages/favoris.html'],
			['reservations', 'Réserv.', '▤', 'pages/reservation.html'],
			['notifications', 'Alertes', '◉', 'pages/notifications.html'],
			['profile', 'Profil', '◯', user ? 'pages/mon-espace.html' : 'pages/connexion.html']
		];
		if (user?.role === 'super_admin') tabs.splice(0, tabs.length, ['admin', 'Admin', '◆', 'pages/super-admin.html'], ['users', 'Comptes', '◉', 'pages/super-admin.html?section=users'], ['reports', 'Dossiers', '▤', 'pages/super-admin.html?section=reports'], ['notifications', 'Alertes', '◌', 'pages/super-admin.html?section=notifications'], ['account', 'Compte', '◯', 'pages/super-admin.html?section=account']);
		tabbar.innerHTML = tabs.map(([key, label, icon, file]) => `<a href="${path(file)}" aria-label="${key === 'reservations' ? 'Réservations' : label}" ${activeKey === key ? 'aria-current="page"' : ''}><span class="mobile-tabbar__icon" aria-hidden="true">${icon}</span><span>${label}</span>${key === 'favorites' && favoritesCount ? `<span class="mobile-tabbar__count">${favoritesCount}</span>` : ''}</a>`).join('');

		const menuToggle = header.querySelector('.menu-toggle');
		const menu = header.querySelector('.app-top-nav');
		menuToggle.addEventListener('click', () => {
			const open = menuToggle.getAttribute('aria-expanded') === 'true';
			menuToggle.setAttribute('aria-expanded', String(!open));
			menuToggle.setAttribute('aria-label', open ? 'Ouvrir le menu' : 'Fermer le menu');
			menu.classList.toggle('is-open', !open);
		});
	}

	return { render };
})();
