window.MASTER_DOG_PROFILE = (() => {
  const base = document.body.dataset.base || '';
  const roles = {
    client: { title: 'Profil propriétaire', documents: [] },
    trainer: { title: 'Dossier dresseur canin', documents: [['identity', 'Pièce d’identité'], ['professional_proof', 'Justificatif professionnel']] },
    veterinarian: { title: 'Dossier vétérinaire', documents: [['identity', 'Pièce d’identité'], ['cv', 'CV professionnel'], ['diploma', 'Diplôme']] },
    shop: { title: 'Dossier boutique canine', documents: [['identity', 'Pièce d’identité'], ['shop_logo', 'Logo de la boutique'], ['shop_photo', 'Photo de la boutique']] }
  };
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const api = (path) => `${base}api/${path}`;
  const fieldLabel = (name) => ({
    country: 'Pays', city: 'Ville', dog_name: 'Nom du chien', dog_breed: 'Race', dog_age: 'Âge du chien',
    birth_date: 'Date de naissance', experience_years: 'Années d’expérience', specialties: 'Spécialités (séparées par des virgules)',
    qualifications: 'Diplômes et certifications', description: 'Présentation professionnelle', service_area: 'Zone d’intervention',
    clinic_name: 'Clinique ou cabinet', clinic_address: 'Adresse de la clinique', clinic_phone: 'Téléphone de la clinique',
    specialty: 'Spécialité', registration_number: 'Inscription à l’ordre (si applicable)', career_description: 'Parcours professionnel',
    district: 'Quartier', shop_name: 'Nom de la boutique', category: 'Catégorie de boutique', business_email: 'E-mail commercial',
    business_phone: 'Téléphone commercial', address: 'Adresse de la boutique', latitude: 'Latitude GPS', longitude: 'Longitude GPS',
    maps_url: 'Lien Google Maps (HTTPS)', opening_hours: 'Horaires d’ouverture (JSON)', products: 'Produits (séparés par des virgules)',
    services: 'Services (séparés par des virgules)', delivery_terms: 'Conditions de livraison'
  })[name] || name;
  const specs = {
    client: ['country', 'city', 'dog_name', 'dog_breed', 'dog_age'],
    trainer: ['country', 'city', 'birth_date', 'experience_years', 'specialties', 'qualifications', 'description', 'service_area'],
    veterinarian: ['country', 'city', 'clinic_name', 'clinic_address', 'clinic_phone', 'specialty', 'registration_number', 'qualifications', 'experience_years', 'career_description'],
    shop: ['country', 'city', 'district', 'shop_name', 'category', 'description', 'business_email', 'business_phone', 'address', 'latitude', 'longitude', 'maps_url', 'opening_hours', 'products', 'services', 'delivery_terms']
  };
  const jsonFields = ['specialties', 'pricing', 'availability', 'opening_hours', 'products', 'services'];
  const commaFields = ['specialties', 'products', 'services'];

  function inputField(name, profile) {
    let value = profile?.[name] ?? '';
    if (jsonFields.includes(name) && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        value = commaFields.includes(name) && Array.isArray(parsed) ? parsed.join(', ') : JSON.stringify(parsed);
      } catch { }
    }
    const type = name === 'birth_date' ? 'date'
      : name === 'experience_years' ? 'number'
        : name === 'latitude' || name === 'longitude' ? 'number'
          : name === 'business_email' ? 'email'
            : name === 'maps_url' ? 'url' : 'text';
    const step = name === 'latitude' || name === 'longitude' ? ' step="any"' : '';
    const multi = ['description', 'career_description', 'qualifications', 'delivery_terms', 'opening_hours'].includes(name);
    const control = multi
      ? `<textarea name="${name}" data-profile-input>${escapeHtml(value)}</textarea>`
      : `<input name="${name}" type="${type}"${step}${name === 'experience_years' ? ' min="0" max="70"' : ''} value="${escapeHtml(value)}" data-profile-input>`;
    return `<label class="form-field">${fieldLabel(name)}${control}</label>`;
  }

  async function getProfile() {
    const response = await fetch(api('profile.php?action=me'), { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de charger le dossier.');
    return data;
  }

  async function post(action, body, json = false) {
    const csrfResponse = await fetch(api('auth.php?action=csrf'), { credentials: 'same-origin' });
    const csrfData = await csrfResponse.json();
    if (!csrfResponse.ok || !csrfData.csrfToken) throw new Error(csrfData.error || 'Session expirée.');
    const response = await fetch(api(`profile.php?action=${encodeURIComponent(action)}`), {
      method: 'POST', credentials: 'same-origin',
      headers: json ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfData.csrfToken } : { 'X-CSRF-Token': csrfData.csrfToken },
      body: json ? JSON.stringify({ ...body, csrf_token: csrfData.csrfToken }) : body
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer le dossier.');
    return data;
  }

  function statusLabel(status) {
    return ({ new: 'Nouveau compte', incomplete: 'Profil incomplet', pending: 'En attente de vérification', review: 'En cours de vérification', more_info: 'Informations complémentaires demandées', verified: 'Compte vérifié', rejected: 'Dossier refusé' })[status] || status;
  }

  async function render() {
    const main = document.querySelector('#app-main');
    try {
      const data = await getProfile();
      const user = data.user;
      if (!user || !specs[user.role]) throw new Error('Dossier utilisateur indisponible.');
      const role = roles[user.role];
      const profile = data.profile || {};
      const documentRows = data.documents.map((item) => `<li><span><strong>${escapeHtml(item.document_type)}</strong><small>${escapeHtml(item.original_name)} · ${Number(item.size_bytes).toLocaleString('fr-FR')} octets</small></span><span>${statusLabel(item.review_status)}</span><a class="button button--subtle button--compact" href="${api(`profile.php?action=document&id=${item.id}`)}">Télécharger</a></li>`).join('') || '<li>Aucun document transmis.</li>';
      const documentOptions = role.documents.map(([type, label]) => `<option value="${type}">${label}</option>`).join('');
      main.innerHTML = `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(role.title)}</p><h1 class="view-title">Mon dossier</h1><p class="muted-copy">Profil relié au compte #${user.id} · ${escapeHtml(user.email)}</p></div></header><div class="profile-file"><section class="profile-file__section profile-file__section--identity"><h2>Informations personnelles</h2><p class="notice notice--gold profile-file__status">Statut : <strong>${escapeHtml(statusLabel(user.profileStatus))}</strong>${user.role !== 'client' && user.profileStatus !== 'verified' ? ' · Le profil professionnel ne sera pas présenté comme vérifié avant décision administrative.' : ''}</p><form data-profile-form><div class="field-grid"><label class="form-field">Prénom<input name="firstName" value="${escapeHtml(user.firstName)}" required></label><label class="form-field">Nom<input name="lastName" value="${escapeHtml(user.lastName)}" required></label></div><label class="form-field">Adresse e-mail<input value="${escapeHtml(user.email)}" readonly aria-readonly="true"></label><label class="form-field">Téléphone<input name="phone" type="tel" value="${escapeHtml(user.phone || '')}"></label><div class="field-grid">${specs[user.role].map((name) => inputField(name, profile)).join('')}</div><button class="button button--gold" type="submit">Enregistrer mon dossier</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>${documentOptions ? `<section class="profile-file__section"><h2>Documents justificatifs</h2><p class="profile-file__help">PDF, JPEG ou PNG · 10 Mo maximum par document. Fichiers conservés dans le stockage privé du serveur.</p><form class="profile-file__upload" data-document-form enctype="multipart/form-data"><label class="form-field">Document<select name="document_type" required>${documentOptions}</select></label><label class="form-field">Fichier<input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required></label><button class="button button--gold" type="submit">Transmettre</button><p class="form-feedback" data-form-feedback role="status"></p></form></section>` : ''}<section class="profile-file__section profile-file__documents"><h2>Documents transmis</h2><ul class="profile-file__list">${documentRows}</ul></section></div>`;
      main.querySelector('[data-profile-form]').addEventListener('submit', saveProfile);
      main.querySelector('[data-document-form]')?.addEventListener('submit', uploadDocument);
    } catch (error) {
      main.innerHTML = `<section class="form-panel"><h1>Mon dossier</h1><p class="notice notice--gold" role="alert">${escapeHtml(error.message)}</p><a class="button button--gold" href="connexion.html">Connexion</a></section>`;
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const user = window.MASTER_DOG_STORE.currentUser();
    const fields = specs[user?.role] || [];
    const values = Object.fromEntries(new FormData(form));
    const profile = Object.fromEntries(fields.map((name) => [name, values[name] ?? '']));
    try {
      await post('update', { firstName: values.firstName, lastName: values.lastName, phone: values.phone, profile }, true);
      form.querySelector('[data-form-feedback]').textContent = 'Dossier enregistré sur le serveur.';
      await render();
    } catch (error) {
      form.querySelector('[data-form-feedback]').textContent = error.message;
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const result = await post('document', new FormData(form));
      form.querySelector('[data-form-feedback]').textContent = result.missingDocuments.length
        ? `Document reçu. Dossier incomplet : ${result.missingDocuments.join(', ')}.`
        : 'Documents requis reçus. Le dossier attend la vérification administrative.';
      await render();
    } catch (error) {
      form.querySelector('[data-form-feedback]').textContent = error.message;
    }
  }

  function init() {
    if (document.body.dataset.page === 'profile-file') render();
  }

  return { init };
})();
