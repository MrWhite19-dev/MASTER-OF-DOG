window.MASTER_DOG_ADMIN = (() => {
  let root;

  const base = document.body.dataset.base || '';
  const sections = [
    ['overview', 'Vue générale', '◆'], ['users', 'Utilisateurs', '◉'],
    ['professionals', 'Profils professionnels', '✳'], ['requests', 'Demandes', '▤'],
    ['reports', 'Signalements', '⚑'], ['complaints', 'Réclamations', '◇'],
    ['reviews', 'Avis plateforme', '☆'], ['notifications', 'Notifications', '◌'],
    ['visitors', 'Fréquentation', '⌁'], ['activity', 'Journal admin', '≡'],
    ['settings', 'Paramètres', '⚙'], ['account', 'Mon compte', '◯']
  ];
  const labels = {
    active: 'Actif', suspended: 'Suspendu', banned: 'Banni', locked: 'Bloqué',
    new: 'Nouveau compte', incomplete: 'Profil incomplet', pending: 'En attente',
    review: 'En examen', verified: 'Vérifié', rejected: 'Refusé', more_info: 'Infos demandées',
    reviewing: 'En examen', resolved: 'Résolu', closed: 'Classé', answered: 'Répondu', hidden: 'Masqué'
  };
  let currentSection = new URLSearchParams(location.search).get('section') || 'overview';
  let usersPage = 1;
  let pollTimer;
  let lastOverview;
  let initialized = false;

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const formatDate = (value) => value ? new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z')).toLocaleString('fr-FR') : '—';
  const status = (value) => `<span class="admin-status admin-status--${escapeHtml(value)}">${escapeHtml(labels[value] || value || '—')}</span>`;
  const endpoint = (action, params = {}) => {
    const query = new URLSearchParams({ action, ...params });
    return `${base}api/admin.php?${query}`;
  };

  async function getCsrf() {
    const response = await fetch(`${base}api/auth.php?action=csrf`, { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok || !data.csrfToken) throw new Error(data.error || 'Session admin expirée.');
    return data.csrfToken;
  }

  async function apiGet(action, params = {}) {
    const response = await fetch(endpoint(action, params), { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Chargement impossible.');
    return data;
  }

  async function apiPost(action, payload) {
    const csrfToken = await getCsrf();
    const response = await fetch(endpoint(action), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Action impossible.');
    return data;
  }

  function shell() {
    root.innerHTML = `<div class="admin-shell"><aside class="admin-sidebar"><p class="admin-sidebar__title">MASTER OF DOG</p><nav class="admin-sidebar__nav" aria-label="Administration">${sections.map(([key, label, icon]) => `<a class="admin-nav-link" href="?section=${key}" data-section="${key}" ${currentSection === key ? 'aria-current="page"' : ''}><span class="admin-nav-link__icon" aria-hidden="true">${icon}</span>${label}</a>`).join('')}</nav></aside><div class="admin-content"><header class="admin-topline"><div><p class="eyebrow">SUPER ADMIN DASHBOARD</p><h1 data-section-title>Vue générale</h1><p>Données directes de MASTER OF DOG</p></div><div class="admin-topline__actions"><button class="icon-button admin-notice-button" type="button" data-notifications aria-label="Notifications administrateur" title="Notifications administrateur" data-count="0">◌</button><button class="button button--subtle button--compact" type="button" data-admin-signout>Déconnexion</button></div></header><section data-admin-panel aria-live="polite"><div class="admin-empty">Chargement des données…</div></section></div></div>`;
    root.querySelector('[data-admin-signout]').addEventListener('click', signOut);
    root.querySelector('[data-notifications]').addEventListener('click', () => navigate('notifications'));
    root.querySelectorAll('[data-section]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.dataset.section);
    }));
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
  }

  function navigate(section) {
    if (!sections.some(([key]) => key === section)) section = 'overview';
    currentSection = section;
    history.replaceState(null, '', `?section=${encodeURIComponent(section)}`);
    root.querySelectorAll('[data-section]').forEach((link) => {
      if (link.dataset.section === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    root.querySelector('[data-section-title]').textContent = sections.find(([key]) => key === section)?.[1] || 'Administration';
    loadSection();
  }

  function stat(label, value, note = '') {
    return `<article class="admin-stat"><span>${escapeHtml(label)}</span><strong>${Number(value || 0).toLocaleString('fr-FR')}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</article>`;
  }

  function chart(title, rows, valueKey, period, color = 'gold') {
    const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
    const bars = rows.map((row) => {
      const value = Number(row[valueKey] || 0);
      const height = Math.max(value ? 4 : 1, Math.round(value / max * 100));
      return `<span class="admin-chart__bar admin-chart__bar--${color}" style="height:${height}%" title="${escapeHtml(row.period || row.visit_date)} · ${value}"><small>${escapeHtml(String(row.period || row.visit_date).slice(5))}</small></span>`;
    }).join('');
    return `<section class="admin-section"><div class="admin-section__heading"><h2>${escapeHtml(title)}</h2>${period || ''}</div>${rows.length ? `<div class="admin-chart" role="img" aria-label="${escapeHtml(title)}">${bars}</div>` : '<div class="admin-empty">Aucune donnée pour cette période.</div>'}</section>`;
  }

  async function renderOverview() {
    const days = new URLSearchParams(location.search).get('days') || '30';
    const data = await apiGet('overview', { days });
    lastOverview = data;
    const roleStats = data.roles.map((item) => stat(({ client: 'Clients', trainer: 'Dresseurs', veterinarian: 'Vétérinaires', shop: 'Boutiques' })[item.role_key] || item.role_key, item.total)).join('');
    const verificationCount = data.verification.reduce((sum, item) => sum + Number(item.total), 0);
    const reportCount = data.reports.reduce((sum, item) => sum + Number(item.total), 0);
    root.querySelector('[data-admin-panel]').innerHTML = `<div class="admin-stat-grid">${stat('Utilisateurs inscrits', data.users.total)}${stat('Comptes actifs', data.users.active)}${stat('Comptes suspendus', data.users.suspended)}${stat('Comptes bannis / bloqués', Number(data.users.banned) + Number(data.users.locked), `${data.users.banned} bannis · ${data.users.locked} bloqués`)}${roleStats}${stat('Demandes de vérification', verificationCount)}${stat('Signalements ouverts', reportCount)}${stat('Visiteurs aujourd’hui', data.visitors.today)}${stat('Visites totales', data.visitors.visits, `${data.visitors.unique_visitors} visiteurs uniques`)}${stat('Avis plateforme', data.platformReviews.total, `Note moyenne ${data.platformReviews.average || '—'} / 5`)}</div>${chart('Inscriptions', data.signupsChart, 'total', `<select class="admin-period" data-chart-period aria-label="Période des graphiques"><option value="7" ${days === '7' ? 'selected' : ''}>7 jours</option><option value="30" ${days === '30' ? 'selected' : ''}>30 jours</option><option value="90" ${days === '90' ? 'selected' : ''}>90 jours</option><option value="365" ${days === '365' ? 'selected' : ''}>12 mois</option></select>`)}${chart('Visiteurs uniques par jour', data.visitorChart, 'visitors', '', 'blue')}`;
    root.querySelector('[data-chart-period]').addEventListener('change', (event) => {
      history.replaceState(null, '', `?section=overview&days=${event.target.value}`);
      renderOverview().catch(showError);
    });
  }

  function userRow(user) {
    const fullName = `${user.first_name} ${user.last_name}`;
    const typeLabel = ({ client: 'Client', trainer: 'Dresseur', veterinarian: 'Vétérinaire', shop: 'Boutique' })[user.role_key] || user.role_key;
    const sanctionButtons = user.account_status === 'active'
      ? `<button class="button button--subtle" data-sanction="suspend" data-user="${user.id}">Suspendre</button><button class="button button--danger" data-sanction="ban" data-user="${user.id}">Bannir</button><button class="button button--subtle" data-sanction="lock" data-user="${user.id}">Bloquer</button>`
      : `<button class="button button--subtle" data-restore="${user.id}">Rétablir</button>`;
    const verifyButtons = user.role_key !== 'client' && user.role_key !== 'super_admin'
      ? `<button class="button button--subtle" data-verify="verified" data-user="${user.id}">Valider</button><button class="button button--subtle" data-verify="rejected" data-user="${user.id}">Refuser</button><button class="button button--subtle" data-verify="more_info" data-user="${user.id}">Demander infos</button>`
      : '';
    return `<tr><td><strong>${escapeHtml(fullName)}</strong><small>#${user.id} · ${escapeHtml(typeLabel)}</small></td><td>${escapeHtml(user.email)}<small>${escapeHtml(user.phone || 'Téléphone non renseigné')}</small></td><td>${status(user.account_status)}<small>${status(user.verification_status)}</small></td><td>${formatDate(user.created_at)}</td><td><div class="admin-actions"><button class="button button--subtle" data-profile="${user.id}">Dossier</button>${sanctionButtons}${verifyButtons}</div></td></tr>`;
  }

  async function renderUsers(professionalsOnly = false) {
    const formData = new FormData(root.querySelector('[data-user-filters]') || document.createElement('form'));
    const params = Object.fromEntries(formData.entries());
    if (professionalsOnly) params.role = params.role || 'trainer,veterinarian,shop';
    params.page = String(usersPage);
    const data = await apiGet('users', params);
    const rows = data.items.map(userRow).join('');
    root.querySelector('[data-user-results]').innerHTML = rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Utilisateur</th><th>Contact</th><th>Compte / vérification</th><th>Inscription</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="admin-empty">Aucun compte correspondant.</div>';
    const pageCount = Math.max(1, Math.ceil(data.total / data.limit));
    root.querySelector('[data-pagination]').innerHTML = `<span>${data.total} compte(s) · page ${data.page} / ${pageCount}</span><div class="admin-pagination__actions"><button class="button button--subtle button--compact" data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? 'disabled' : ''}>Précédent</button><button class="button button--subtle button--compact" data-page="${Math.min(pageCount, data.page + 1)}" ${data.page >= pageCount ? 'disabled' : ''}>Suivant</button></div>`;
  }

  function usersPanel(professionalsOnly = false) {
    return `<section class="admin-section"><h2>${professionalsOnly ? 'Profils professionnels' : 'Comptes utilisateurs'}</h2><form class="admin-toolbar" data-user-filters><label class="form-field">Recherche<input name="q" type="search" placeholder="Nom, e-mail ou identifiant"></label><label class="form-field">Catégorie<select name="role"><option value="">Toutes</option><option value="client">Client</option><option value="trainer">Dresseur</option><option value="veterinarian">Vétérinaire</option><option value="shop">Boutique</option></select></label><label class="form-field">Statut<select name="status"><option value="">Tous</option><option value="active">Actif</option><option value="suspended">Suspendu</option><option value="banned">Banni</option><option value="locked">Bloqué</option></select></label><label class="form-field">Du<input name="from" type="date"></label><label class="form-field">Au<input name="to" type="date"></label><label class="form-field">Tri<select name="sort"><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option></select></label><button class="button button--gold button--compact" type="submit">Filtrer</button></form><div data-user-results><div class="admin-empty">Chargement…</div></div><div class="admin-pagination" data-pagination></div></section>`;
  }

  function simpleTable(title, items, columns, emptyText) {
    if (!items.length) return `<section class="admin-section"><h2>${escapeHtml(title)}</h2><div class="admin-empty">${escapeHtml(emptyText)}</div></section>`;
    const headers = columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('');
    const rows = items.map((item) => `<tr>${columns.map(([key]) => `<td>${key === 'status' ? status(item[key]) : escapeHtml(item[key] ?? '—')}</td>`).join('')}</tr>`).join('');
    return `<section class="admin-section"><h2>${escapeHtml(title)}</h2><div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  async function renderReports() {
    const [reports, complaints] = await Promise.all([apiGet('reports'), apiGet('complaints')]);
    const reportRows = reports.items.map((item) => `<tr><td><strong>${escapeHtml(item.reference_code)}</strong><small>${formatDate(item.created_at)}</small></td><td>${escapeHtml(item.reporter_first_name)} ${escapeHtml(item.reporter_last_name)}<small>ID ${item.reporter_id}</small></td><td>${escapeHtml(item.target_first_name)} ${escapeHtml(item.target_last_name)}<small>${escapeHtml(item.target_role)} · ID ${item.target_id}</small></td><td>${escapeHtml(item.reason)}<small>${escapeHtml(item.description)}</small></td><td>${status(item.status)}</td><td><div class="admin-actions"><button class="button button--subtle" data-case="report" data-id="${item.id}" data-status="reviewing">Examiner</button><button class="button button--subtle" data-case="report" data-id="${item.id}" data-status="resolved">Résoudre</button><button class="button button--danger" data-case="report" data-id="${item.id}" data-status="rejected">Rejeter</button></div></td></tr>`).join('');
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Signalements (${reports.items.length})</h2>${reportRows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Référence</th><th>Émetteur</th><th>Compte signalé</th><th>Motif</th><th>Statut</th><th>Traitement</th></tr></thead><tbody>${reportRows}</tbody></table></div>` : '<div class="admin-empty">Aucun signalement reçu.</div>'}</section>${simpleTable('Réclamations (' + complaints.items.length + ')', complaints.items, [['reference_code', 'Référence'], ['subject', 'Objet'], ['first_name', 'Compte'], ['status', 'Statut'], ['created_at', 'Date']], 'Aucune réclamation reçue.')}`;
  }

  async function renderComplaints() {
    const data = await apiGet('complaints');
    const rows = data.items.map((item) => `<tr><td><strong>${escapeHtml(item.reference_code)}</strong><small>${formatDate(item.created_at)}</small></td><td>${escapeHtml(item.first_name)} ${escapeHtml(item.last_name)}<small>${escapeHtml(item.role_key)} · ${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.subject)}<small>${escapeHtml(item.description)}</small></td><td>${status(item.status)}</td><td><div class="admin-actions"><button class="button button--subtle" data-case="complaint" data-id="${item.id}" data-status="reviewing">Examiner</button><button class="button button--subtle" data-case="complaint" data-id="${item.id}" data-status="resolved">Résoudre</button><button class="button button--danger" data-case="complaint" data-id="${item.id}" data-status="rejected">Rejeter</button></div></td></tr>`).join('');
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Réclamations (${data.items.length})</h2>${rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Référence</th><th>Auteur</th><th>Objet</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="admin-empty">Aucune réclamation.</div>'}</section>`;
  }

  async function renderReviews() {
    const data = await apiGet('reviews');
    const rows = data.items.map((item) => `<tr><td>${'★'.repeat(Number(item.rating))}${'☆'.repeat(5 - Number(item.rating))}<small>${formatDate(item.created_at)}</small></td><td>${escapeHtml(item.first_name)} ${escapeHtml(item.last_name)}<small>${escapeHtml(item.role_key)} · #${item.user_id}</small></td><td>${escapeHtml(item.comment)}${item.admin_reply ? `<small>Réponse : ${escapeHtml(item.admin_reply)}</small>` : ''}</td><td>${status(item.status)}</td><td><div class="admin-actions"><button class="button button--subtle" data-review="${item.id}" data-review-status="answered">Répondre</button><button class="button button--danger" data-review="${item.id}" data-review-status="hidden">Masquer</button></div></td></tr>`).join('');
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Avis sur MASTER OF DOG (${data.items.length})</h2>${rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Note</th><th>Auteur</th><th>Commentaire</th><th>Statut</th><th>Modération</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="admin-empty">Aucun avis plateforme.</div>'}</section>`;
  }

  async function renderNotifications() {
    const data = await apiGet('notifications');
    const unread = data.items.filter((item) => !item.read_at).length;
    root.querySelector('[data-notifications]').dataset.count = String(unread);
    const rows = data.items.map((item) => `<tr><td>${escapeHtml(item.title)}<small>${escapeHtml(item.event_type)} · ${escapeHtml(item.reference_type)} ${item.reference_id || ''}</small></td><td>${escapeHtml(item.summary)}</td><td>${formatDate(item.created_at)}</td><td>${item.read_at ? 'Lue' : `<button class="button button--subtle button--compact" data-read="${item.id}">Marquer lue</button>`}</td></tr>`).join('');
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Notifications (${unread} non lue(s))</h2>${rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Événement</th><th>Résumé</th><th>Date</th><th>État</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="admin-empty">Aucune notification.</div>'}</section>`;
  }

  async function renderActivity() {
    const data = await apiGet('activity');
    const rows = data.items.map((item) => `<tr><td>${formatDate(item.created_at)}</td><td>${escapeHtml(item.admin_email)}</td><td>${escapeHtml(item.action_type)}</td><td>${escapeHtml(item.target_type || '')} ${item.target_id || ''}<small>${escapeHtml(item.details || '')}</small></td></tr>`).join('');
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Historique des actions (${data.items.length})</h2>${rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Cible / détails</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="admin-empty">Aucune action admin enregistrée.</div>'}</section>`;
  }

  async function renderSettings() {
    root.querySelector('[data-admin-panel]').innerHTML = `<section class="admin-section"><h2>Paramètres serveur</h2><p class="muted-copy">La configuration MySQL, la clé applicative, le SMTP et le stockage privé sont lus depuis un fichier placé hors de la racine publique. Les secrets ne sont pas affichés ni modifiables depuis ce tableau de bord.</p><p class="notice notice--gold">Aucun fournisseur Google, SMTP ou service de signature électronique n’est activé sans identifiants de service configurés.</p><h2>Conservation des données</h2><p class="muted-copy">Les sanctions et décisions sont conservées dans leur journal. Les règles de conservation et de suppression des justificatifs doivent être validées avant production.</p></section>`;
  }

  async function renderAccount() {
    const data = await fetch(`${base}api/auth.php?action=me`, { credentials: 'same-origin' }).then((response) => response.json());
    const user = data.user;
    root.querySelector('[data-admin-panel]').innerHTML = user ? `<section class="admin-section"><h2>Compte super-administrateur</h2><div class="admin-detail"><dl><dt>Identifiant</dt><dd>${user.id}</dd><dt>Nom</dt><dd>${escapeHtml(user.name)}</dd><dt>E-mail</dt><dd>${escapeHtml(user.email)}</dd></dl><dl><dt>Rôle</dt><dd>${escapeHtml(user.role)}</dd><dt>Statut</dt><dd>${status(user.accountStatus)}</dd><dt>Vérification</dt><dd>${status(user.profileStatus)}</dd></dl></div><p class="notice">Le rôle est lu depuis MySQL à chaque requête protégée ; il ne peut pas être modifié dans cette interface.</p></section>` : '<div class="admin-empty">Session expirée.</div>';
  }

  async function renderVisitors() {
    const data = await apiGet('overview', { days: new URLSearchParams(location.search).get('days') || '30' });
    const v = data.visitors;
    const panel = root.querySelector('[data-admin-panel]');
    panel.innerHTML = `<div class="admin-stat-grid">${stat('Aujourd’hui', v.today)}${stat('7 derniers jours', v.last_7_days)}${stat('30 derniers jours', v.last_30_days)}${stat('90 derniers jours', v.last_90_days)}${stat('12 derniers mois', v.last_12_months)}${stat('Visites cumulées', v.visits)}${stat('Visiteurs uniques', v.unique_visitors)}${stat('Visiteurs connectés', v.connected_visitors)}${stat('Visiteurs non connectés', v.anonymous_visitors)}</div>${chart('Visites et visiteurs uniques', data.visitorChart, 'visits', `<select class="admin-period" data-chart-period aria-label="Période"><option value="7">7 jours</option><option value="30" selected>30 jours</option><option value="90">90 jours</option><option value="365">12 mois</option></select>`)}`;
    panel.querySelector('[data-chart-period]').addEventListener('change', async (event) => {
      history.replaceState(null, '', `?section=visitors&days=${event.target.value}`);
      try { await renderVisitors(); } catch (error) { showError(error); }
    });
  }

  async function showProfile(userId) {
    const data = await apiGet('profile', { id: String(userId) });
    const user = data.user;
    const profileRows = Object.entries(data.profile || {}).filter(([key]) => key !== 'user_id' && key !== 'profile_data' && key !== 'created_at' && key !== 'updated_at').map(([key, value]) => `<dt>${escapeHtml(key.replaceAll('_', ' '))}</dt><dd>${escapeHtml(typeof value === 'object' && value !== null ? JSON.stringify(value) : value || '—')}</dd>`).join('');
    const docs = data.documents.map((item) => `<li>${escapeHtml(item.document_type)} · ${escapeHtml(item.original_name)} · ${status(item.review_status)} · ${Number(item.size_bytes).toLocaleString('fr-FR')} octets · <a href="${base}api/admin.php?action=professional-document&id=${item.id}">Télécharger</a></li>`).join('') || '<li>Aucun justificatif enregistré.</li>';
    const actions = data.actions.map((item) => `<li>${escapeHtml(item.action_type)} · ${escapeHtml(item.reason)} · ${formatDate(item.starts_at)} · ${item.reversed_at ? 'Levée le ' + formatDate(item.reversed_at) : item.ends_at ? 'Fin ' + formatDate(item.ends_at) : 'Active'}</li>`).join('') || '<li>Aucune sanction.</li>';
    const dialog = document.createElement('dialog');
    dialog.className = 'admin-dialog';
    dialog.innerHTML = `<form method="dialog"><button class="icon-button admin-dialog__close" aria-label="Fermer">×</button></form><h2>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)} · #${user.id}</h2><p>${escapeHtml(user.email)} · ${escapeHtml(user.role_key)} · ${status(user.account_status)} ${status(user.verification_status)}</p><section><h3>Profil</h3><dl class="admin-detail">${profileRows || '<dd>Informations non renseignées.</dd>'}</dl></section><section><h3>Documents (réservés à l’administration)</h3><ul>${docs}</ul></section><section><h3>Historique des sanctions</h3><ul>${actions}</ul></section>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  async function loadSection() {
    const panel = root.querySelector('[data-admin-panel]');
    panel.innerHTML = '<div class="admin-empty">Chargement des données…</div>';
    try {
      if (currentSection === 'overview') await renderOverview();
      else if (currentSection === 'users' || currentSection === 'professionals' || currentSection === 'requests') {
        root.querySelector('[data-section-title]').textContent = ({ users: 'Utilisateurs', professionals: 'Profils professionnels', requests: 'Demandes professionnelles' })[currentSection];
        panel.innerHTML = usersPanel(currentSection !== 'users');
        await renderUsers(currentSection !== 'users');
      } else if (currentSection === 'reports') await renderReports();
      else if (currentSection === 'complaints') await renderComplaints();
      else if (currentSection === 'reviews') await renderReviews();
      else if (currentSection === 'notifications') await renderNotifications();
      else if (currentSection === 'visitors') await renderVisitors();
      else if (currentSection === 'activity') await renderActivity();
      else if (currentSection === 'settings') await renderSettings();
      else if (currentSection === 'account') await renderAccount();
    } catch (error) {
      showError(error);
    }
  }

  function showError(error) {
    const panel = root.querySelector('[data-admin-panel]');
    if (panel) panel.innerHTML = `<div class="notice notice--gold" role="alert">${escapeHtml(error.message || 'Erreur de chargement.')}</div>`;
    if (/super administrateur|Connexion requise/i.test(error.message || '')) {
      window.setTimeout(() => { location.href = `${base}pages/connexion.html`; }, 700);
    }
  }

  async function onSubmit(event) {
    if (!event.target.matches('[data-user-filters]')) return;
    event.preventDefault();
    usersPage = 1;
    try { await renderUsers(currentSection !== 'users'); } catch (error) { showError(error); }
  }

  async function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    try {
      if (button.dataset.page) {
        usersPage = Number(button.dataset.page);
        await renderUsers(currentSection !== 'users');
      } else if (button.dataset.profile) {
        await showProfile(button.dataset.profile);
      } else if (button.dataset.sanction) {
        const reason = prompt('Motif obligatoire de cette mesure :');
        if (!reason?.trim()) return;
        let durationHours = null;
        if (button.dataset.sanction === 'suspend' || button.dataset.sanction === 'lock' || button.dataset.sanction === 'ban') {
          const duration = prompt('Durée en heures (1 à 8760), vide pour indéfinie :');
          durationHours = duration?.trim() ? Number(duration) : null;
          if (durationHours !== null && (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760)) throw new Error('Durée invalide.');
        }
        if (!confirm(`Confirmer ${button.dataset.sanction} pour le compte #${button.dataset.user} ?`)) return;
        await apiPost('sanction', { userId: Number(button.dataset.user), type: button.dataset.sanction, reason: reason.trim(), durationHours });
        await renderUsers(currentSection !== 'users');
      } else if (button.dataset.restore) {
        const reason = prompt('Motif obligatoire de la levée de sanction :');
        if (!reason?.trim() || !confirm(`Rétablir le compte #${button.dataset.restore} ? L’historique sera conservé.`)) return;
        await apiPost('restore', { userId: Number(button.dataset.restore), reason: reason.trim() });
        await renderUsers(currentSection !== 'users');
      } else if (button.dataset.verify) {
        const reason = prompt(`Motif obligatoire pour le statut « ${labels[button.dataset.verify] || button.dataset.verify} » :`);
        if (!reason?.trim() || !confirm('Confirmer la décision de vérification ?')) return;
        await apiPost('verification', { userId: Number(button.dataset.user), status: button.dataset.verify, reason: reason.trim() });
        await renderUsers(currentSection !== 'users');
      } else if (button.dataset.case) {
        const reason = prompt('Note de traitement obligatoire :');
        if (!reason?.trim() || !confirm('Confirmer le changement de statut du dossier ?')) return;
        const complaint = button.dataset.case === 'complaint';
        await apiPost(complaint ? 'complaint-status' : 'report-status', { [complaint ? 'complaintId' : 'reportId']: Number(button.dataset.id), status: button.dataset.status, reason: reason.trim() });
        complaint ? await renderComplaints() : await renderReports();
      } else if (button.dataset.review) {
        const nextStatus = button.dataset.reviewStatus;
        const reply = nextStatus === 'answered' ? prompt('Votre réponse à cet avis :') : '';
        if (nextStatus === 'answered' && !reply?.trim()) return;
        if (!confirm(nextStatus === 'hidden' ? 'Masquer cet avis ?' : 'Enregistrer la réponse ?')) return;
        await apiPost('review-moderate', { reviewId: Number(button.dataset.review), status: nextStatus, reply: reply?.trim() || '' });
        await renderReviews();
      } else if (button.dataset.read) {
        await apiPost('notification-read', { notificationId: Number(button.dataset.read) });
        await renderNotifications();
      }
    } catch (error) {
      showError(error);
    }
  }

  async function signOut() {
    try {
      const response = await fetch(`${base}api/auth.php?action=csrf`, { credentials: 'same-origin' });
      const { csrfToken } = await response.json();
      await fetch(`${base}api/auth.php?action=logout`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: '{}' });
    } catch { /* La redirection reste possible si la session a déjà expiré. */ }
    window.MASTER_DOG_STORE.signOut();
    location.href = `${base}pages/connexion.html`;
  }

  function init() {
    if (initialized) return;
    root = document.getElementById('admin-app');
    if (!root) return;
    initialized = true;
    shell();
    loadSection();
    pollTimer = window.setInterval(async () => {
      try {
        const data = await apiGet('notifications');
        const count = data.items.filter((item) => !item.read_at).length;
        root.querySelector('[data-notifications]').dataset.count = String(count);
        if (currentSection === 'notifications') await renderNotifications();
      } catch {
        window.clearInterval(pollTimer);
      }
    }, 30000);
  }

  return { init, loadSection };
})();
