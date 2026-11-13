window.MASTER_DOG_VIEWS = (() => {
  const data = window.MASTER_DOG_DATA;
  const store = window.MASTER_DOG_STORE;
  const path = (file) => `${document.body.dataset.base || ''}${file}`;
  const money = (value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const ratingLabel = (id) => {
    const reviews = store.read('reviews', {})[id] || [];
    if (!reviews.length) return '☆ Aucun avis';
    const average = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
    return `★ ${average.toFixed(1)} · ${reviews.length} avis locaux`;
  };
  const professionalCard = (person) => `<article class="pro-card">
    <a class="pro-card__photo" href="${path('pages/profil-pro.html')}?pro=${encodeURIComponent(person.id)}"><img src="${person.image}" alt="" loading="lazy"><span class="availability"><i></i>${person.availability}</span></a>
    <div class="pro-card__body"><p class="card-kicker">${data.categories[person.category].singular} · ${person.area}</p><a class="pro-card__name" href="${path('pages/profil-pro.html')}?pro=${encodeURIComponent(person.id)}">${person.name}</a><p class="pro-card__business">${person.business}</p><div class="pro-card__meta"><span>${ratingLabel(person.id)}</span><span>Dès ${money(person.price)}</span></div>
    <div class="pro-card__actions"><a class="button button--gold button--compact" href="${path('pages/profil-pro.html')}?pro=${encodeURIComponent(person.id)}">Voir le profil</a><button class="icon-button" type="button" data-favorite="${person.id}" aria-label="Ajouter ${person.name} aux favoris" title="Ajouter aux favoris">♡</button></div></div></article>`;
  const productCard = (product) => `<article class="product-card"><a class="product-card__photo" href="${path('pages/produit.html')}?product=${encodeURIComponent(product.id)}"><img src="${product.image}" alt="" loading="lazy"></a><div class="product-card__body"><p class="card-kicker">${product.category} · ${product.shop}</p><a class="pro-card__name" href="${path('pages/produit.html')}?product=${encodeURIComponent(product.id)}">${product.name}</a><div class="pro-card__meta"><span>${product.availability}</span><strong>${money(product.price)}</strong></div><div class="pro-card__actions"><a class="button button--gold button--compact" href="${path('pages/produit.html')}?product=${encodeURIComponent(product.id)}">Découvrir</a><button class="icon-button" type="button" data-favorite="${product.id}" data-favorite-type="product" aria-label="Ajouter le produit aux favoris" title="Ajouter aux favoris">♡</button><button class="icon-button" type="button" data-cart="${product.id}" aria-label="Ajouter au panier" title="Ajouter au panier">＋</button></div></div></article>`;
  const section = (eyebrow, title, href, content) => `<section class="content-section"><div class="section-title"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><a class="text-action" href="${href}">Voir tout <span>↗</span></a></div>${content}</section>`;

  function home() {
    const categories = Object.entries(data.categories).map(([key, category]) => `<a class="category-tile category-tile--${category.accent}" href="pages/${category.route}"><span class="category-icon" aria-hidden="true">${category.icon}</span><span><strong>${category.title}</strong><small>Explorer les profils</small></span><b aria-hidden="true">↗</b></a>`).join('');
    const trainers = data.professionals.filter((person) => person.category === 'trainers').map(store.professionalProfile).filter((person) => person.visible !== false).map(professionalCard).join('');
    const vets = data.professionals.filter((person) => person.category === 'veterinarians').map(store.professionalProfile).filter((person) => person.visible !== false).map(professionalCard).join('');
    const shops = data.professionals.filter((person) => person.category === 'shops').map(store.professionalProfile).filter((person) => person.visible !== false).map(professionalCard).join('');
    const products = data.products.map(productCard).join('');
    return `<section class="welcome-hero"><div class="welcome-hero__copy"><p class="eyebrow"><span class="status-pulse"></span> Votre compagnon, au cœur de tout</p><h1>Bonjour,<br>que recherchez-vous <em>aujourd’hui ?</em></h1><p class="muted-copy">Des professionnels et des boutiques canines, près de vous.</p>
      <form class="global-search" data-global-search><label class="search-input"><span aria-hidden="true">⌕</span><input name="q" placeholder="Un professionnel, un service…" aria-label="Rechercher un professionnel, un service ou un produit"></label><label class="search-input search-input--place"><span aria-hidden="true">⌖</span><input name="city" placeholder="Ville" aria-label="Ville"></label><button class="button button--gold" type="submit">Rechercher <span>↗</span></button></form>
      <p class="demo-tag">Prototype local · résultats de démonstration</p></div><div class="welcome-hero__brand"><img src="${path('assets/logo/logo_dog.png')}" alt="Logo MASTER of DOG : chien couronné, le meilleur ami de votre chien"></div></section>
      <section class="content-section category-section"><div class="section-title"><div><p class="eyebrow">Trouver la bonne personne</p><h2>Explorez par univers</h2></div></div><div class="category-grid">${categories}</div></section>
      ${section('Sélection locale', 'Dresseurs à découvrir', 'pages/dresseurs.html', `<div class="card-grid">${trainers}</div>`)}
      ${section('Prendre soin de lui', 'Vétérinaires à proximité', 'pages/veterinaires.html', `<div class="card-grid">${vets}</div>`)}
      ${section('Pour les petits plaisirs', 'Boutiques populaires', 'pages/boutiques.html', `<div class="card-grid">${shops}</div>`)}
      ${section('La sélection du moment', 'Essentiels canins', 'pages/boutiques.html', `<div class="card-grid card-grid--products">${products}</div>`)}
      <aside class="join-card"><div><p class="eyebrow">Vous êtes professionnel ?</p><h2>Faites découvrir votre savoir-faire.</h2><p>Créez un profil de démonstration et préparez vos coordonnées de contact.</p></div><a class="button button--light" href="pages/inscription.html?role=professional">Créer un profil <span>↗</span></a></aside>`;
  }
  return { home, professionalCard, productCard, money };
})();
