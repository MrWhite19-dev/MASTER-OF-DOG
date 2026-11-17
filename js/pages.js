window.MASTER_DOG_PAGES = (() => {
  const data = window.MASTER_DOG_DATA;
  const store = window.MASTER_DOG_STORE;
  const money = window.MASTER_DOG_VIEWS.money;
  const escapeHtml = window.MASTER_DOG_VIEWS.escapeHtml || ((value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]));
  const header = (eyebrow, title, description = '') => `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1 class="view-title">${title}</h1>${description ? `<p class="muted-copy">${description}</p>` : ''}</div></header>`;
  const empty = (title, text, action = '') => `<div class="empty-state"><strong>${title}</strong><span>${text}</span>${action ? `<div class="empty-state__action">${action}</div>` : ''}</div>`;

  function directory(categoryId, products = false) {
    const category = data.categories[categoryId] || { title: 'professionnels' };
    const title = categoryId === 'all' ? 'Recherche générale' : products ? 'Boutiques & produits' : category.title;
    const people = data.professionals.filter((person) => categoryId === 'all' || person.category === categoryId);
    const specialties = categoryId === 'all' ? [...new Set(Object.values(data.categories).flatMap((item) => item.specialties))] : category.specialties;
    const specialtyOptions = products ? ['Nourriture', 'Accessoires', 'Jouets', 'Colliers', 'Laisses', 'Produits de soin', 'Paniers et couchages'] : specialties;
    return `${header(products ? 'Le commerce canin' : `Univers ${category.title.toLowerCase()}`, title, products ? 'Explorez les boutiques canines et leurs catalogues de démonstration.' : `Comparez les services ${category.title.toLowerCase()} et contactez directement le professionnel.`)}
      <form class="filter-bar" data-directory-form data-category="${categoryId}" data-products="${products}">
        <label class="filter-control">Recherche<input name="q" placeholder="Nom, service ou mot-clé"></label>
        <label class="filter-control">Ville<input name="city" placeholder="Ex. Lyon"></label>
        <label class="filter-control">${products ? 'Catégorie' : 'Spécialité'}<select name="specialty"><option value="">Toutes</option>${specialtyOptions.map((item) => `<option>${item}</option>`).join('')}</select></label>
        <label class="filter-control">Prix maximum (FCFA)<input name="price" type="number" min="0" inputmode="numeric" placeholder="Sans limite"></label>
        <label class="filter-control">Disponibilité<select name="availability"><option value="">Toutes</option><option value="today">Aujourd’hui</option><option value="week">Cette semaine</option></select></label>
        <label class="filter-control">Note minimale<select name="rating"><option value="0">Toutes les notes</option><option value="3">3+ · avis publiés</option><option value="4">4+ · avis publiés</option><option value="4.5">4,5+ · avis publiés</option></select></label>
        <label class="filter-control">Trier<select name="sort"><option value="recommended">Recommandés</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="rating-desc">Note décroissante</option></select></label>
        <button class="button button--subtle button--compact" type="reset">Réinitialiser</button>
      </form><p class="result-count" data-result-count></p><div class="card-grid directory-results" data-results></div>`;
  }

  function professionalProfile() {
    const id = new URLSearchParams(location.search).get('pro');
    const person = store.professionalProfile(data.professionals.find((item) => item.id === id) || data.professionals[0]);
    const category = data.categories[person.category];
    const reviews = store.read('reviews', {})[person.id] || [];
    const contact = store.read('professionalContacts', {})[person.id];
    const average = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;
    const services = person.services.map((service) => `<div class="list-row"><span>${service}</span><strong>À partir de ${money(person.price)}</strong></div>`).join('');
    const reviewList = reviews.length ? `<p class="rating-summary">★ ${average.toFixed(1)} / 5 · ${reviews.length} avis locaux</p>${reviews.map((review) => `<article class="review-row"><strong>${escapeHtml(review.author)}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span><p>${escapeHtml(review.comment)}</p><small>${new Date(review.createdAt).toLocaleDateString('fr-FR')} · avis local</small></article>`).join('')}` : empty('Aucun avis pour le moment', 'Aucune note ni aucun commentaire fictif ne sont affichés.');
    const reviewForm = store.currentUser()?.role === 'client' ? `<form data-review-form data-pro="${person.id}"><label class="form-field">Votre note<select name="rating" required><option value="">Choisir</option><option value="5">5 étoiles</option><option value="4">4 étoiles</option><option value="3">3 étoiles</option><option value="2">2 étoiles</option><option value="1">1 étoile</option></select></label><label class="form-field">Votre commentaire<textarea name="comment" required></textarea></label><button class="button button--subtle" type="submit">Publier mon avis local</button><p class="form-feedback" data-form-feedback role="status"></p></form>` : `<p class="muted-copy">Connectez-vous avec un compte client pour laisser un avis local.</p>`;
    return `${header(`${category.title} · Profil de démonstration`, person.name, person.business)}<div class="pro-profile" data-pro-id="${person.id}">
      <article class="pro-profile__hero"><img src="${person.image}" alt="Présentation de ${person.name}"><div class="pro-profile__content"><p class="eyebrow">${person.area} · ${person.experience} d’expérience</p><h2>${person.name}</h2><p class="muted-copy">${person.description}</p><p class="notice notice--gold">Profil d’exemple : informations, disponibilité et tarifs sont fictifs. ${reviews.length} avis ajouté(s) localement.</p><h3>Spécialités</h3><div class="tag-list">${person.specialties.map((item) => `<span>${item}</span>`).join('')}</div><h3>Services proposés</h3>${services}<h3>Avis</h3>${reviewList}${reviewForm}</div></article>
      <aside class="pro-profile__side"><div class="profile-price">Dès <strong>${money(person.price)}</strong><small>Tarif de démonstration</small></div><p class="availability-line"><i></i>${person.availability}</p><a class="button button--gold button--full" href="demande.html?pro=${encodeURIComponent(person.id)}">${person.category === 'veterinarians' ? 'Demander une consultation' : person.category === 'shops' ? 'Contacter la boutique' : 'Faire une demande'}</a><button class="button button--subtle button--full" type="button" data-favorite="${person.id}">♡ Ajouter aux favoris</button><p class="notice">${contact?.channel ? `Canal ${contact.channel} activé localement.` : 'Aucun canal de contact configuré pour ce profil. Les demandes restent indisponibles.'}</p><a class="text-action" href="signalement.html?target=${encodeURIComponent(person.id)}">Signaler ce profil</a></aside></div>`;
  }

  function productDetail() {
    const id = new URLSearchParams(location.search).get('product');
    const product = data.products.find((item) => item.id === id) || data.products[0];
    return `${header('Catalogue de démonstration', product.name, `${product.category} · ${product.shop}`)}<div class="product-detail"><img src="${product.image}" alt="${product.name}"><div><p class="eyebrow">${product.availability}</p><h2>${product.name}</h2><p class="muted-copy">Article de démonstration proposé par ${product.shop}, à ${product.city}. Vérifiez les détails directement auprès du professionnel.</p><p class="product-price">${money(product.price)}</p><label class="form-field">Quantité<input type="number" value="1" min="1" max="10" data-quantity></label><button class="button button--gold" type="button" data-cart="${product.id}">＋ Ajouter au panier</button><button class="icon-button" type="button" data-favorite="${product.id}" data-favorite-type="product" aria-label="Ajouter aux favoris">♡</button> <a class="button button--subtle" href="paiement.html">Voir le panier</a><p class="notice">Aucun paiement n’est effectué ici. La commande doit être confirmée par le commerçant.</p></div></div>`;
  }

  function auth(register = false) {
    const roleFields = {
      trainer: '<div class="field-grid"><label class="form-field">Date de naissance<input name="birthDate" type="date"></label><label class="form-field">Années d’expérience<input name="experience" type="number" min="0" max="70"></label></div><label class="form-field">Spécialités<input name="specialties" placeholder="Ex. éducation positive, comportement"></label><label class="form-field">Diplômes et certifications<input name="qualifications"></label><label class="form-field">Zone d’intervention<input name="serviceArea"></label><label class="form-field">Présentation professionnelle<textarea name="professionalDescription"></textarea></label>',
      veterinarian: '<label class="form-field">Clinique ou cabinet<input name="businessName"></label><label class="form-field">Adresse professionnelle<input name="businessAddress" autocomplete="street-address"></label><div class="field-grid"><label class="form-field">Spécialité vétérinaire<input name="specialty"></label><label class="form-field">Années d’expérience<input name="experience" type="number" min="0" max="70"></label></div><label class="form-field">Diplômes et parcours<input name="qualifications"></label>',
      shop: '<label class="form-field">Nom de la boutique<input name="businessName"></label><label class="form-field">Catégorie de boutique<input name="specialty" placeholder="Ex. alimentation, accessoires"></label><label class="form-field">Adresse professionnelle<input name="businessAddress" autocomplete="street-address"></label><div class="field-grid"><label class="form-field">Pays<input name="country"></label><label class="form-field">Quartier<input name="district"></label></div><label class="form-field">Description et produits proposés<textarea name="professionalDescription"></textarea></label>'
    };
    const roleChoices = [
      ['client', '♧', 'Client', 'Prendre soin de votre chien'],
      ['trainer', '✳', 'Dresseur canin', 'Présenter votre activité'],
      ['veterinarian', '+', 'Vétérinaire', 'Rejoindre le réseau santé'],
      ['shop', '◇', 'Boutique canine', 'Présenter votre boutique']
    ];
    const accountFields = register ? `<fieldset class="account-type"><legend>Quel type de compte souhaitez-vous créer ?</legend><div class="account-type__grid">${roleChoices.map(([role, icon, title, description]) => `<button class="account-type__choice account-type__choice--${role}" type="button" data-role-choice="${role}" aria-pressed="${role === 'client'}"><span aria-hidden="true">${icon}</span><strong>${title}</strong><small>${description}</small></button>`).join('')}</div></fieldset>
      <div class="field-grid"><label class="form-field">Prénom<input name="firstName" autocomplete="given-name" required></label><label class="form-field">Nom<input name="lastName" autocomplete="family-name" required></label></div>
      <label class="form-field">Adresse e-mail<input name="email" type="email" autocomplete="email" required></label><label class="form-field">Téléphone<input name="phone" type="tel" autocomplete="tel" required></label>
      <div class="field-grid"><label class="form-field">Pays<input name="country" autocomplete="country-name"></label><label class="form-field">Ville<input name="city" autocomplete="address-level2" required></label></div>
      <div data-role-fields="client"><div class="field-grid"><label class="form-field">Nom du chien (facultatif)<input name="dogName"></label><label class="form-field">Race (facultatif)<input name="dogBreed"></label></div></div>
      ${Object.entries(roleFields).map(([role, fields]) => `<div data-role-fields="${role}" hidden>${fields}<p class="notice">Profil professionnel incomplet : la vérification et les documents justificatifs nécessitent un espace serveur privé. Ne saisissez ni numéro ni copie de pièce d’identité ici.</p></div>`).join('')}
      <label class="form-field">Mot de passe<input name="password" type="password" autocomplete="new-password" minlength="10" data-password required></label><label class="form-field">Confirmer le mot de passe<input name="passwordConfirm" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="check-field"><input name="terms" type="checkbox" required> J’accepte les <a href="conditions.html">conditions de démonstration</a>.</label>` : `<label class="form-field">Adresse e-mail<input name="email" type="email" autocomplete="email" required></label><label class="form-field password-field">Mot de passe<input name="password" type="password" autocomplete="current-password" required><button type="button" class="password-toggle" aria-label="Afficher le mot de passe" aria-pressed="false">Afficher</button></label><label class="check-field"><input name="remember" type="checkbox"> Se souvenir de moi sur cet appareil</label>`;
    const description = register
      ? 'Un compte par rôle. Les profils professionnels restent incomplets jusqu’à leur vérification.'
      : 'Retrouvez votre espace MASTER of DOG.';
    const securityNotice = register
      ? 'Les comptes et profils sont créés sur le serveur. Les profils professionnels restent incomplets jusqu’à vérification. N’envoyez pas de pièces d’identité dans ce formulaire.'
      : 'Connexion vérifiée côté serveur. En cas de suspension ou de blocage, contactez l’administration de la plateforme.';
    return `<section class="form-panel auth-panel"><p class="eyebrow">${register ? 'Rejoindre la communauté' : 'Ravi de vous revoir'}</p><h1>${register ? 'Créer votre compte' : 'Connexion'}</h1><p class="muted-copy">${description}</p><p class="notice notice--gold">${securityNotice}</p><form data-auth-form data-register="${register}">${accountFields}<button class="button button--gold button--full" type="submit">${register ? 'Créer mon compte' : 'Se connecter'}</button><p class="form-feedback" data-form-feedback role="status" aria-live="polite"></p></form><div class="form-links">${register ? 'Déjà un compte ? <a href="connexion.html">Connexion</a>' : 'Pas encore de compte ? <a href="inscription.html">Créer un compte</a> · <a href="mot-de-passe-oublie.html">Mot de passe oublié</a>'}</div></section>`;
  }

  function favorites() {
    const items = store.favorites().map((favorite) => favorite.type === 'product' ? data.products.find((item) => item.id === favorite.id) : data.professionals.find((item) => item.id === favorite.id)).filter(Boolean);
    const cards = items.map((item) => 'business' in item ? window.MASTER_DOG_VIEWS.professionalCard(item) : window.MASTER_DOG_VIEWS.productCard(item)).join('');
    return `${header('Votre sélection', 'Favoris', `${items.length} élément(s) enregistré(s) sur cet appareil.`)}${items.length ? `<div class="card-grid">${cards}</div>` : empty('Votre liste est vide', 'Ajoutez des professionnels ou des produits en touchant le cœur.')}`;
  }

  function reservations() {
    const requests = store.requests();
    const rows = requests.map((request) => `<article class="request-row"><div><p class="eyebrow">Demande externe préparée · ${new Date(request.createdAt).toLocaleDateString('fr-FR')}</p><strong>${escapeHtml(request.professionalName)}</strong><p>${escapeHtml(request.service || request.product || 'Demande')}</p><small>À envoyer dans le canal choisi. Ce n’est pas une réservation confirmée.</small></div><span class="status-pill">Non confirmée</span></article>`).join('');
    return `${header('Suivi personnel', 'Demandes & réservations', 'Une demande externe n’est jamais une réservation confirmée.')}${rows || empty('Aucune demande', 'Aucune réservation fictive n’est créée. Vos demandes locales apparaîtront ici.')}`;
  }

  function notifications() {
    const items = store.notifications();
    const rows = items.map((item) => `<div class="list-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)} · ${item.read ? 'Lue' : 'Non lue'}</small></div><button class="icon-button" type="button" data-dismiss-notification="${item.id}" aria-label="Supprimer">×</button></div>`).join('');
    return `${header('Restez informé', 'Notifications', 'Seules les notifications créées localement seront affichées.')}${items.length ? `<button class="button button--subtle button--compact" type="button" data-mark-all-read>Tout marquer comme lu</button>${rows}` : empty('Tout est calme', 'Aucune notification réelle ou fictive à afficher.')}`;
  }

  function account() {
    const user = store.currentUser();
    if (!user) return `${header('Espace personnel', 'Votre profil')}${empty('Connectez-vous pour accéder au profil local.', '', '<a class="button button--gold" href="connexion.html">Connexion</a>')}`;
    if (user.role === 'super_admin') return `${header('Administration', 'MASTER OF DOG – SUPER ADMIN DASHBOARD', 'Espace réservé au propriétaire de la plateforme.')}<a class="button button--gold" href="super-admin.html">Ouvrir le tableau de bord</a><button class="button button--subtle" type="button" data-signout>Déconnexion</button>`;
    const sanction = store.read('sanctions', []).find((item) => item.active && item.subject.toLowerCase() === user.email.toLowerCase());
    if (sanction && ['suspension', 'ban'].includes(sanction.level)) return `${header('Accès limité localement', 'Compte de démonstration bloqué', `Motif : ${escapeHtml(sanction.reason)} · ${new Date(sanction.createdAt).toLocaleDateString('fr-FR')}`)}<p class="notice notice--gold">Simulation sur cet appareil uniquement. Ce blocage n’est pas une sanction réelle et peut être contourné; seul un backend peut appliquer les permissions.</p><form class="form-panel" data-appeal-form data-sanction="${sanction.id}"><label class="form-field">Demande de réexamen<textarea name="message" required></textarea></label><button class="button button--gold" type="submit">Demander un réexamen local</button><p class="form-feedback" data-form-feedback role="status"></p></form><button class="button button--subtle" type="button" data-signout>Déconnexion locale</button>`;
    const warning = sanction?.level === 'warning' ? `<p class="notice notice--gold">Avertissement local : ${escapeHtml(sanction.reason)}. Ce statut est uniquement enregistré dans ce navigateur.</p>` : '';
    if (user.role !== 'client') {
      const labels = { trainer: 'Dresseur', veterinarian: 'Vétérinaire', shop: 'Boutique' };
      return `${header(`Espace ${labels[user.role] || 'professionnel'}`, `Bonjour ${escapeHtml(user.name)}`, 'Tableau de bord local. Les clients et demandes ne sont pas synchronisés entre utilisateurs.')}${warning}
        <div class="professional-dashboard professional-dashboard--${user.role}"><p class="notice notice--gold">Statut : <strong>${escapeHtml(user.profileStatus || 'profil incomplet')}</strong>. Aucun compte professionnel n’est vérifié. Les modifications restent sur cet appareil et ne sont visibles que dans ce navigateur.</p><div class="dashboard-grid"><a class="dashboard-tile" href="parametres.html"><span>⚙</span><strong>Mon profil professionnel</strong><small>Services, tarifs, horaires et canal choisi</small></a><a class="dashboard-tile" href="reservation.html"><span>▤</span><strong>Demandes externes</strong><small>Aucune synchronisation serveur</small></a><a class="dashboard-tile" href="notifications.html"><span>◉</span><strong>Avis & alertes</strong><small>Aucune donnée fictive</small></a></div><button class="button button--subtle" type="button" data-signout>Déconnexion locale</button></div>`;
    }
    return `${header('Espace personnel', `Bonjour ${escapeHtml(user.name)}`, `Rôle ${escapeHtml(user.role)}`)}${warning}<div class="dashboard-grid"><a class="dashboard-tile" href="favoris.html"><span>♡</span><strong>Mes favoris</strong><small>${store.favorites().length} élément(s)</small></a><a class="dashboard-tile" href="reservation.html"><span>▤</span><strong>Mes demandes</strong><small>${store.requests().length} demande(s)</small></a><a class="dashboard-tile" href="notifications.html"><span>◉</span><strong>Notifications</strong><small>Aucune notification fictive</small></a><a class="dashboard-tile" href="parametres.html"><span>⚙</span><strong>Paramètres</strong><small>Compte, préférences et contact</small></a><a class="dashboard-tile" href="avis.html"><span>☆</span><strong>Avis sur MASTER of DOG</strong><small>Partager un retour à l’équipe</small></a><a class="dashboard-tile" href="reclamation.html"><span>◇</span><strong>Réclamation</strong><small>Contacter l’équipe de la plateforme</small></a></div><button class="button button--subtle" type="button" data-signout>Déconnexion</button>`;
  }

  function settings() {
    const user = store.currentUser() || {};
    const contact = store.read('professionalContact', {});
    const roleCategory = { trainer: 'trainers', veterinarian: 'veterinarians', shop: 'shops' }[user.role];
    const professional = data.professionals.find((person) => person.category === roleCategory);
    const businessFields = professional ? `<section class="settings-panel settings-panel--professional"><h2>Profil professionnel · ${data.categories[roleCategory].singular}</h2><form data-pro-settings data-pro-id="${professional.id}"><label class="form-field">Présentation<textarea name="description">${escapeHtml(professional.description)}</textarea></label><label class="form-field">Services (séparés par des virgules)<input name="services" value="${escapeHtml(professional.services.join(', '))}"></label><div class="field-grid"><label class="form-field">Tarif indicatif (FCFA)<input name="price" type="number" min="0" value="${professional.price}"></label><label class="form-field">Disponibilité<input name="availability" value="${escapeHtml(professional.availability)}"></label></div><label class="form-field">Horaires<input name="hours" placeholder="Ex. Lun–Ven 9h–18h"></label><label class="toggle-row">Profil visible sur cet appareil<input name="visible" type="checkbox" checked></label><button class="button button--gold" type="submit">Enregistrer le profil local</button></form></section>` : '';
    return `${header('Compte & préférences', 'Paramètres', 'Les modifications restent dans ce navigateur de démonstration.')}<div class="settings-layout"><section class="settings-panel"><h2>Compte</h2><form data-settings-form><label class="form-field">Nom<input name="name" value="${escapeHtml(user.name || '')}"></label><label class="form-field">E-mail<input name="email" type="email" value="${escapeHtml(user.email || '')}"></label><label class="form-field">Téléphone<input name="phone" type="tel" value="${escapeHtml(user.phone || '')}"></label><label class="form-field">Ville<input name="city" value="${escapeHtml(user.city || '')}"></label><button class="button button--gold" type="submit">Enregistrer</button></form></section><section class="settings-panel"><h2>Préférences</h2><label class="toggle-row">Mode sombre<input type="checkbox" data-preference="theme" checked></label><label class="form-field">Langue<select data-preference="language"><option value="fr">Français</option><option value="en">English (interface partielle)</option></select></label><label class="toggle-row">Préférences de localisation<input type="checkbox" data-preference="location"></label><h2>Contact professionnel</h2><p class="muted-copy">Paramètres locaux, non publiés sur les autres appareils.</p><label class="form-field">Canal<select data-contact-channel><option value="" ${!contact.channel ? 'selected' : ''}>Désactivé</option><option value="whatsapp" ${contact.channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="facebook" ${contact.channel === 'facebook' ? 'selected' : ''}>Facebook / Messenger</option></select></label><label class="form-field">Téléphone WhatsApp<input data-contact-phone value="${escapeHtml(contact.phone || '')}" placeholder="33612345678"></label><label class="form-field">URL Facebook / Messenger<input data-contact-facebook type="url" value="${escapeHtml(contact.facebook || '')}" placeholder="https://m.me/..."></label><button class="button button--gold" type="button" data-save-contact>Enregistrer le canal</button></section>${businessFields}<section class="settings-panel settings-panel--danger"><h2>Sécurité & données</h2><p class="notice">Pas de gestion de session sécurisée dans une application statique. La suppression efface uniquement les données locales.</p><button class="button button--subtle" type="button" data-clear-demo>Effacer mes données locales</button><button class="button button--danger" type="button" data-delete-account>Supprimer mon profil local</button></section></div>`;
  }

  function request() {
    const person = data.professionals.find((item) => item.id === new URLSearchParams(location.search).get('pro')) || data.professionals[0];
    const isShop = person.category === 'shops';
    const isVet = person.category === 'veterinarians';
    const selectedProduct = data.products.find((item) => item.id === new URLSearchParams(location.search).get('product'));
    const fields = isShop ? `<label class="form-field">Produit souhaité<input name="product" value="${escapeHtml(selectedProduct?.name || '')}" required></label><div class="field-grid"><label class="form-field">Quantité<input name="quantity" type="number" min="1" value="1" required></label><label class="form-field">Taille / variante<input name="variant"></label></div><label class="form-field">Retrait ou livraison<input name="delivery" required></label><label class="form-field">Localisation<input name="location"></label>` : `<label class="form-field">Nom du chien<input name="dogName" required></label><div class="field-grid"><label class="form-field">Race<input name="breed"></label><label class="form-field">Âge<input name="age" placeholder="Ex. 2 ans"></label></div><label class="form-field">${isVet ? 'Motif de consultation' : 'Objectif / difficulté'}<input name="service" required></label>${isVet ? '<label class="form-field">Symptômes observés<textarea name="symptoms"></textarea></label><label class="form-field">Type de consultation<input name="consultation"></label>' : '<label class="form-field">Type de service<input name="serviceType"></label>'}<label class="form-field">Date souhaitée<input name="date" type="date"></label>`;
    return `<section class="form-panel request-panel"><p class="eyebrow">${data.categories[person.category].singular} · ${person.name}</p><h1>${isShop ? 'Préparer une commande' : isVet ? 'Demander une consultation' : 'Faire une demande'}</h1><p class="notice notice--gold">Le message sera préparé puis ouvert dans le canal du professionnel. Il ne sera reçu ni confirmé tant que vous ne l’aurez pas envoyé dans l’application externe.</p><form data-request-form data-pro="${person.id}"><div class="field-grid"><label class="form-field">${isShop ? 'Nom du client' : 'Nom du propriétaire'}<input name="customer" required></label><label class="form-field">Téléphone<input name="phone" type="tel" required></label></div>${fields}<label class="form-field">Informations complémentaires<textarea name="details"></textarea></label><button class="button button--gold button--full" type="submit">${isShop ? 'Envoyer ma commande' : isVet ? 'Demander une consultation' : 'Envoyer ma demande'}</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>`;
  }

  function checkout() {
    const cart = store.cart();
    const rows = cart.map((entry) => {
      const product = data.products.find((item) => item.id === entry.id);
      if (!product) return '';
      const shop = data.professionals.find((person) => person.category === 'shops' && person.business === product.shop);
      return `<article class="request-row"><img class="cart-thumb" src="${product.image}" alt=""><div><strong>${product.name}</strong><small>${product.shop} · ${money(product.price)} · Quantité ${entry.quantity || 1}</small></div><button class="icon-button" type="button" data-remove-cart="${product.id}" aria-label="Retirer ${product.name}">×</button>${shop ? `<a class="button button--gold button--compact" href="demande.html?pro=${encodeURIComponent(shop.id)}&product=${encodeURIComponent(product.id)}">Préparer la commande</a>` : ''}</article>`;
    }).join('');
    const total = cart.reduce((sum, entry) => sum + (data.products.find((item) => item.id === entry.id)?.price || 0) * (entry.quantity || 1), 0);
    return `${header('Boutique', 'Panier de démonstration', 'Aucun paiement ni commande réelle n’est effectué.')}${rows || empty('Votre panier est vide', 'Ajoutez un produit depuis une boutique.', '<a class="button button--gold" href="boutiques.html">Explorer les boutiques</a>')}${cart.length ? `<div class="checkout-total"><strong>Total indicatif</strong><strong>${money(total)}</strong></div><p class="notice">Chaque commande est préparée séparément avec la boutique via son canal externe. Elle n’est pas confirmée avant envoi et accord du professionnel.</p>` : ''}`;
  }

  function passwordReset() {
    const token = new URLSearchParams(location.search).get('token') || '';
    return `<section class="form-panel"><p class="eyebrow">Accès au compte</p><h1>${token ? 'Choisir un nouveau mot de passe' : 'Mot de passe oublié'}</h1><p class="notice notice--gold">${token ? 'Le lien sécurisé expire après une heure et ne peut être utilisé qu’une seule fois.' : 'Si cette adresse est associée à un compte, un lien de réinitialisation sera envoyé.'}</p><form data-reset-form data-reset-token="${escapeHtml(token)}">${token ? '<label class="form-field">Nouveau mot de passe<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><label class="form-field">Confirmer le mot de passe<input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" required></label>' : '<label class="form-field">Adresse e-mail<input name="email" type="email" autocomplete="email" required></label>'}<button class="button button--gold button--full" type="submit">${token ? 'Modifier le mot de passe' : 'Demander un lien sécurisé'}</button><p class="form-feedback" data-form-feedback role="status"></p><a class="text-action" href="connexion.html">Retour à la connexion</a></form></section>`;
  }

  function report() {
    const target = Number(new URLSearchParams(location.search).get('targetUserId')) || '';
    return `<section class="form-panel"><p class="eyebrow">Communauté & sécurité</p><h1>Signaler un compte</h1><p class="notice notice--gold">Votre identité est communiquée à l’équipe de modération. Les justificatifs sont conservés dans un stockage privé.</p><form data-report-form enctype="multipart/form-data"><label class="form-field">Identifiant du compte concerné<input name="targetUserId" type="number" min="1" value="${target}" required></label><label class="form-field">Motif<select name="reason" required><option value="">Choisir un motif</option><option>Fraude ou arnaque</option><option>Comportement abusif</option><option>Harcèlement</option><option>Faux professionnel</option><option>Informations mensongères</option><option>Mauvaise prestation</option><option>Non-respect d’un contrat</option><option>Comportement dangereux envers un animal</option><option>Autre</option></select></label><label class="form-field">Description détaillée<textarea name="description" maxlength="10000" required></textarea></label><label class="form-field">Preuve facultative · JPEG, PNG ou PDF · 10 Mo max<input name="proof" type="file" accept="image/jpeg,image/png,application/pdf"></label><button class="button button--gold button--full" type="submit">Envoyer le signalement</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>`;
  }

  function complaint() {
    return `<section class="form-panel"><p class="eyebrow">Assistance MASTER of DOG</p><h1>Déposer une réclamation</h1><p class="notice notice--gold">Le dossier est associé à votre compte et reçoit une référence de suivi.</p><form data-complaint-form enctype="multipart/form-data"><label class="form-field">Objet<input name="subject" maxlength="200" required></label><label class="form-field">Description<textarea name="description" maxlength="10000" required></textarea></label><label class="form-field">Pièce justificative facultative · JPEG, PNG ou PDF · 10 Mo max<input name="proof" type="file" accept="image/jpeg,image/png,application/pdf"></label><button class="button button--gold button--full" type="submit">Envoyer la réclamation</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>`;
  }

  function platformReview() {
    return `<section class="form-panel"><p class="eyebrow">Votre retour</p><h1>Avis sur MASTER of DOG</h1><p class="notice">Cet avis concerne la plateforme, pas un professionnel.</p><form data-platform-review><label class="form-field">Votre note<select name="rating" required><option value="">Choisir une note</option><option value="5">5 étoiles</option><option value="4">4 étoiles</option><option value="3">3 étoiles</option><option value="2">2 étoiles</option><option value="1">1 étoile</option></select></label><label class="form-field">Commentaire, suggestion ou remarque<textarea name="comment" maxlength="5000" required></textarea></label><button class="button button--gold button--full" type="submit">Envoyer mon avis</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>`;
  }

  function moderation() {
    const reports = store.reports();
    const sanctions = store.read('sanctions', []);
    const rows = reports.map((item) => `<article class="request-row"><div><p class="eyebrow">${escapeHtml(item.reason)} · ${new Date(item.createdAt).toLocaleDateString('fr-FR')}</p><strong>${escapeHtml(item.target)}</strong><p>${escapeHtml(item.description)}</p><small>Statut local : ${escapeHtml(item.status)}</small></div><div class="moderation-actions"><button class="button button--subtle button--compact" type="button" data-review-report="${item.id}">Examiner</button><button class="button button--subtle button--compact" type="button" data-local-sanction="warning" data-report="${item.id}">Avertir</button><button class="button button--subtle button--compact" type="button" data-local-sanction="suspension" data-report="${item.id}">Suspendre</button><button class="button button--danger button--compact" type="button" data-local-sanction="ban" data-report="${item.id}">Bannir</button></div></article>`).join('');
    const history = sanctions.map((item) => `<article class="request-row"><div><p class="eyebrow">${escapeHtml(item.level)} · ${new Date(item.createdAt).toLocaleDateString('fr-FR')}</p><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(item.reason)} · ${item.active ? 'Active localement' : 'Réexaminée'}</small></div>${item.active ? `<button class="button button--subtle button--compact" type="button" data-reexamine="${item.id}">Réexaminer / réactiver</button>` : ''}</article>`).join('');
    return `${header('Outils de démonstration', 'Signalements locaux', 'Espace non protégé : les dossiers, avertissements, suspensions, bannissements et réexamens ne sont enregistrés que dans ce navigateur. Ils ne changent aucune permission réelle.')}${rows || empty('Aucun signalement local', 'Aucun signalement de démonstration n’a été créé.')}<section class="content-section"><div class="section-title"><h2>Historique local des décisions</h2></div>${history || empty('Aucune sanction locale', 'Les décisions locales apparaîtront ici.')}</section>`;
  }

  function legal() {
    const title = document.body.dataset.title || 'Informations';
    const help = title === 'Centre d’aide';
    const privacy = title === 'Confidentialité';
    const content = help
      ? `<section class="settings-panel"><h2>Comment contacter un professionnel ?</h2><p>Ouvrez son profil et préparez une demande. Le canal choisi peut être WhatsApp ou Facebook / Messenger; vous devez ensuite envoyer le message dans l’application externe.</p><h2>Une demande est-elle une réservation ?</h2><p>Non. Une demande préparée ou envoyée par un canal externe n’est pas une réservation confirmée. Attendez l’accord du professionnel.</p><h2>Comment signaler un profil ?</h2><p>Depuis un profil, utilisez « Signaler ». Dans ce prototype, le signalement reste sur votre navigateur et n’est pas transmis à une équipe.</p><a class="text-action" href="signalement.html">Créer un signalement</a></section>`
      : privacy
        ? `<section class="settings-panel"><h2>Données de ce prototype</h2><p>Les préférences, favoris, comptes de démonstration, avis et demandes préparées sont enregistrés dans le stockage local du navigateur. Ils ne sont ni partagés ni protégés par un serveur.</p><h2>Coordonnées et preuves</h2><p>Les coordonnées saisies dans un formulaire de demande sont utilisées pour préparer le lien externe. Les preuves jointes à un signalement ne sont pas téléversées dans cette version.</p><h2>Liens externes</h2><p>WhatsApp et Facebook / Messenger appliquent leurs propres politiques lorsque vous choisissez d’ouvrir ces services.</p><p class="notice notice--gold">Texte informatif de prototype, à faire valider juridiquement avant production.</p></section>`
        : `<section class="settings-panel"><h2>Utilisation de la démonstration</h2><p>Les professionnels, tarifs et disponibilités fournis sont des données de démonstration. Les comptes et avis restent locaux et ne sont pas vérifiés.</p><h2>Demandes externes</h2><p>Vous restez responsable de l’envoi du message dans le canal externe. Aucun paiement, réservation ou commande n’est finalisé par cette interface.</p><h2>Modération et sanctions</h2><p>Aucun signalement, avertissement, bannissement ou recours n’est traité par un serveur dans cette version.</p><p class="notice notice--gold">Texte de prototype, non contractuel. Des conditions complètes et une politique de confidentialité validées sont requises avant lancement.</p></section>`;
    return `${header('MASTER of DOG', title)}${content}`;
  }

  function render(page) {
    const views = {
      home: () => window.MASTER_DOG_VIEWS.home(),
      trainers: () => directory('trainers'),
      veterinarians: () => directory('veterinarians'),
      shops: () => directory('shops', true),
      search: () => directory('all'),
      profile: professionalProfile,
      product: productDetail,
      checkout,
      admin: () => '<section id="admin-app" aria-live="polite"><div class="admin-empty">Chargement du tableau de bord sécurisé…</div></section>',
      login: () => auth(false),
      register: () => auth(true),
      'password-reset': passwordReset,
      favorites,
      reservations,
      notifications,
      account,
      settings,
      request,
      report,
      complaint,
      'platform-review': platformReview,
      moderation,
      requests: reservations,
      legal
    };
    return (views[page] || views.home)();
  }

  return { render, directory };
})();
