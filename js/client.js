window.MASTER_DOG_CLIENT = (() => {
	const store = window.MASTER_DOG_STORE;
	const data = window.MASTER_DOG_DATA;
	const byId = (id) => document.getElementById(id);

	function toast(message) {
		let region = byId('toast-region');
		if (!region) {
			region = document.createElement('div');
			region.id = 'toast-region';
			region.className = 'toast-region';
			region.setAttribute('aria-live', 'polite');
			document.body.append(region);
		}
		const item = document.createElement('div');
		item.className = 'toast';
		item.textContent = message;
		region.append(item);
		window.setTimeout(() => item.remove(), 3600);
	}

	function feedback(form, message) {
		const output = form.querySelector('[data-form-feedback]');
		if (output) output.textContent = message;
	}

	function openExternalRequest(professional, message, form) {
		const contacts = store.read('professionalContacts', {});
		const contact = contacts[professional.id];
		if (!contact || !contact.channel) {
			feedback(form, 'Ce professionnel n’a pas activé de canal de contact. Aucun message n’a été envoyé.');
			return;
		}

		let destination;
		if (contact.channel === 'whatsapp') {
			const phone = String(contact.phone || '').replace(/\D/g, '');
			if (phone.length < 8 || phone.length > 15) {
				feedback(form, 'Le numéro WhatsApp configuré est invalide. Vérifiez-le dans les paramètres professionnels.');
				return;
			}
			destination = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
		} else {
			try {
				const url = new URL(contact.facebook);
				if (url.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.me', 'messenger.com', 'www.messenger.com'].includes(url.hostname)) throw new Error('URL non autorisée');
				destination = url.href;
			} catch {
				feedback(form, 'Le lien Facebook / Messenger est invalide ou non autorisé. Aucun message n’a été envoyé.');
				return;
			}
		}

		store.addRequest({ professionalId: professional.id, professionalName: professional.name, service: professional.category === 'shops' ? 'Commande externe préparée' : 'Demande externe préparée' });
		feedback(form, contact.channel === 'whatsapp'
			? 'WhatsApp s’ouvre avec votre message prérempli. Envoyez-le dans WhatsApp pour contacter le professionnel; rien n’est encore confirmé.'
			: 'Le message est préparé. Facebook / Messenger s’ouvre; collez puis envoyez votre message. Rien n’est encore confirmé.');
		window.open(destination, '_blank', 'noopener,noreferrer');
	}

	function populateContactProfiles() {
		const channelField = document.querySelector('[data-contact-channel]');
		if (!channelField || byId('contact-profile')) return;
		const wrapper = document.createElement('label');
		wrapper.className = 'form-field';
		wrapper.innerHTML = '<span>Profil professionnel</span><select id="contact-profile"><option value="">Choisir un profil</option></select>';
		const select = wrapper.querySelector('select');
		data.professionals.forEach((person) => {
			const option = document.createElement('option');
			option.value = person.id;
			option.textContent = `${person.name} · ${person.business}`;
			select.append(option);
		});
		channelField.closest('.form-field').before(wrapper);

		const contacts = store.read('professionalContacts', {});
		const user = store.currentUser();
		const roleCategory = { trainer: 'trainers', veterinarian: 'veterinarians', shop: 'shops' }[user?.role];
		if (roleCategory) select.value = data.professionals.find((person) => person.category === roleCategory)?.id || '';
		select.addEventListener('change', () => {
			const contact = contacts[select.value] || {};
			channelField.value = contact.channel || '';
			document.querySelector('[data-contact-phone]').value = contact.phone || '';
			document.querySelector('[data-contact-facebook]').value = contact.facebook || '';
		});
		if (select.value) select.dispatchEvent(new Event('change'));
	}

	function populateClientFields() {
		const form = document.querySelector('[data-settings-form]');
		if (!form || form.querySelector('[name="dogName"]')) return;
		const user = store.currentUser() || {};
		const section = document.createElement('section');
		section.className = 'dog-settings';
		const title = document.createElement('h3');
		title.textContent = 'Mon chien';
		section.append(title);
		[['dogName', 'Nom'], ['dogBreed', 'Race'], ['dogAge', 'Âge']].forEach(([name, label]) => {
			const field = document.createElement('label');
			field.className = 'form-field';
			field.textContent = label;
			const input = document.createElement('input');
			input.name = name;
			input.value = user[name] || '';
			field.append(input);
			section.append(field);
		});
		form.append(section);
	}

	function populateProfessionalSettings() {
		const form = document.querySelector('[data-pro-settings]');
		if (!form) return;
		const profile = store.read('professionalEdits', {})[form.dataset.proId];
		if (!profile) return;
		form.elements.description.value = profile.description || '';
		form.elements.services.value = (profile.services || []).join(', ');
		form.elements.price.value = profile.price ?? '';
		form.elements.availability.value = profile.availability || '';
		form.elements.hours.value = profile.hours || '';
		form.elements.visible.checked = profile.visible !== false;
	}

	function bindSharedActions() {
		populateContactProfiles();
		populateClientFields();
		populateProfessionalSettings();
		document.addEventListener('click', (event) => {
			const favorite = event.target.closest('[data-favorite]');
			if (favorite) {
				const type = favorite.dataset.favoriteType || 'professional';
				store.toggleFavorite(favorite.dataset.favorite, type);
				const active = store.favorites().some((item) => item.id === favorite.dataset.favorite && item.type === type);
				favorite.classList.toggle('is-active', active);
				favorite.setAttribute('aria-pressed', String(active));
				toast(active ? 'Ajouté à vos favoris sur cet appareil.' : 'Retiré de vos favoris.');
				if (document.body.dataset.page === 'favorites' && !active) {
					favorite.closest('.pro-card, .product-card')?.remove();
					const remaining = store.favorites().length;
					const summary = document.querySelector('.page-heading .muted-copy');
					if (summary) summary.textContent = `${remaining} élément(s) enregistré(s) sur cet appareil.`;
					if (!document.querySelector('.pro-card, .product-card')) {
						document.querySelector('[data-results]')?.remove();
						document.querySelector('.app-main').insertAdjacentHTML('beforeend', '<div class="empty-state"><strong>Votre liste est vide</strong><span>Ajoutez des professionnels ou des produits en touchant le cœur.</span></div>');
					}
				}
				window.MASTER_DOG_NAVIGATION.render();
			}

			const cartButton = event.target.closest('[data-cart]');
			if (cartButton) {
				const quantity = Number(cartButton.closest('.product-detail')?.querySelector('[data-quantity]')?.value) || 1;
				store.addToCart(cartButton.dataset.cart, quantity);
				toast('Produit ajouté au panier de démonstration.');
			}
			const removeCart = event.target.closest('[data-remove-cart]');
			if (removeCart) {
				store.removeFromCart(removeCart.dataset.removeCart);
				toast('Article retiré du panier local.');
				window.setTimeout(() => location.reload(), 250);
			}

			if (event.target.closest('[data-signout]')) {
				store.signOut();
				location.href = `${document.body.dataset.base || ''}index.html`;
			}
			if (event.target.closest('[data-clear-demo]') && window.confirm('Effacer toutes les données de démonstration de ce navigateur ?')) {
				store.clearDemo();
				location.href = `${document.body.dataset.base || ''}index.html`;
			}
			if (event.target.closest('[data-delete-account]') && window.confirm('Supprimer le profil et les données de démonstration locales ?')) {
				store.clearDemo();
				location.href = `${document.body.dataset.base || ''}index.html`;
			}
			if (event.target.closest('[data-save-contact]')) {
				const profileId = byId('contact-profile')?.value;
				const channel = document.querySelector('[data-contact-channel]')?.value;
				if (!profileId) return toast('Choisissez le profil professionnel à configurer.');
				const contacts = store.read('professionalContacts', {});
				const phone = document.querySelector('[data-contact-phone]')?.value.trim() || '';
				const facebook = document.querySelector('[data-contact-facebook]')?.value.trim() || '';
				if (channel === 'whatsapp' && phone.replace(/\D/g, '').length < 8) return toast('Renseignez un numéro WhatsApp valide au format international.');
				if (channel === 'facebook') {
					try {
						const url = new URL(facebook);
						if (url.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.me', 'messenger.com', 'www.messenger.com'].includes(url.hostname)) throw new Error('URL non autorisée');
					} catch { return toast('Utilisez un lien HTTPS facebook.com, m.me ou messenger.com.'); }
				}
				contacts[profileId] = { channel, phone, facebook };
				store.write('professionalContacts', contacts);
				toast('Canal enregistré localement pour ce profil de démonstration.');
			}
			const review = event.target.closest('[data-review-report]');
			if (review) {
				const reports = store.reports();
				const item = reports.find((report) => report.id === review.dataset.reviewReport);
				if (item) {
					item.status = 'examined-local';
					store.write('reports', reports);
					review.closest('.request-row')?.remove();
					toast('Statut local mis à jour; aucun modérateur externe n’est notifié.');
				}
			}
			const localSanction = event.target.closest('[data-local-sanction]');
			if (localSanction) {
				const reports = store.reports();
				const report = reports.find((item) => item.id === localSanction.dataset.report);
				if (!report) return;
				const sanctions = store.read('sanctions', []);
				sanctions.unshift({ id: `sanction-${Date.now()}`, subject: report.target, level: localSanction.dataset.localSanction, reason: report.reason, active: true, createdAt: new Date().toISOString(), reportId: report.id });
				report.status = `${localSanction.dataset.localSanction}-local`;
				store.write('sanctions', sanctions);
				store.write('reports', reports);
				location.reload();
			}
			const reexamine = event.target.closest('[data-reexamine]');
			if (reexamine) {
				const sanctions = store.read('sanctions', []);
				const sanction = sanctions.find((item) => item.id === reexamine.dataset.reexamine);
				if (sanction) {
					sanction.active = false;
					sanction.reexaminedAt = new Date().toISOString();
					store.write('sanctions', sanctions);
					location.reload();
				}
			}
			const dismiss = event.target.closest('[data-dismiss-notification]');
			if (dismiss) {
				store.write('notifications', store.notifications().filter((item) => String(item.id) !== dismiss.dataset.dismissNotification));
				dismiss.closest('.list-row')?.remove();
			}
			if (event.target.closest('[data-mark-all-read]')) {
				store.write('notifications', store.notifications().map((item) => ({ ...item, read: true })));
				location.reload();
			}
		});

		document.addEventListener('submit', (event) => {
			const form = event.target;
			if (form.matches('[data-auth-form]')) {
				event.preventDefault();
				const values = Object.fromEntries(new FormData(form));
				const register = form.dataset.register === 'true';
				const accounts = store.read('demoAccounts', []);
				if (register) {
					if (accounts.some((account) => account.email.toLowerCase() === values.email.toLowerCase())) return feedback(form, 'Un profil de démonstration existe déjà pour cette adresse.');
					  const account = { name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role, city: values.city || '', dogName: values.dogName || '', dogBreed: values.dogBreed || '', dogAge: values.dogAge || '' };
					accounts.push(account);
					store.write('demoAccounts', accounts);
					  store.setUser({ name: account.name, email: account.email, role: account.role, city: account.city, dogName: account.dogName, dogBreed: account.dogBreed, dogAge: account.dogAge });
					location.href = 'mon-espace.html';
				} else {
					const account = accounts.find((item) => item.email.toLowerCase() === values.email.toLowerCase() && item.password === values.password);
					if (!account) return feedback(form, 'Compte local introuvable. Créez d’abord un profil sur cet appareil.');
					const sanction = store.read('sanctions', []).find((item) => item.active && item.subject.toLowerCase() === account.email.toLowerCase() && ['suspension', 'ban'].includes(item.level));
					if (sanction) return feedback(form, `Connexion locale bloquée : ${sanction.level}. Motif : ${sanction.reason}. Un réexamen réel nécessite le serveur.`);
					  store.setUser({ name: account.name, email: account.email, role: account.role, city: account.city, dogName: account.dogName, dogBreed: account.dogBreed, dogAge: account.dogAge });
					location.href = 'mon-espace.html';
				}
			}

			if (form.matches('[data-settings-form]')) {
				event.preventDefault();
				const user = store.currentUser();
				if (!user) return toast('Connectez-vous pour modifier le profil local.');
				const values = Object.fromEntries(new FormData(form));
				const updated = { ...user, ...values };
				store.setUser(updated);
				toast('Profil local mis à jour.');
			}

			if (form.matches('[data-pro-settings]')) {
				event.preventDefault();
				const user = store.currentUser();
				if (!user || user.role === 'client') return feedback(form, 'Un compte professionnel local est nécessaire pour modifier ce profil.');
				const values = Object.fromEntries(new FormData(form));
				const profiles = store.read('professionalEdits', {});
				profiles[form.dataset.proId] = {
					description: values.description.trim(),
					services: values.services.split(',').map((item) => item.trim()).filter(Boolean),
					price: Number(values.price) || 0,
					availability: values.availability.trim(),
					hours: values.hours.trim(),
					visible: form.elements.visible.checked
				};
				store.write('professionalEdits', profiles);
				feedback(form, 'Profil de démonstration mis à jour sur cet appareil.');
			}

			if (form.matches('[data-report-form]')) {
				event.preventDefault();
				const values = Object.fromEntries(new FormData(form));
				store.addReport({ target: values.target, type: values.type, reason: values.reason, description: values.description });
				feedback(form, 'Signalement enregistré sur cet appareil uniquement. Il n’a pas été transmis à une équipe de modération.');
				form.reset();
			}

			if (form.matches('[data-request-form]')) {
				event.preventDefault();
				const person = data.professionals.find((item) => item.id === form.dataset.pro);
				if (!person) return feedback(form, 'Profil professionnel introuvable.');
				const values = Object.fromEntries([...new FormData(form).entries()].filter(([key]) => key !== 'proof'));
				const message = [`Bonjour ${person.name},`, `Je vous contacte via MASTER of DOG.`, ...Object.entries(values).filter(([, value]) => value).map(([key, value]) => `${key} : ${value}`)].join('\n');
				openExternalRequest(person, message, form);
			}

			if (form.matches('[data-review-form]')) {
				event.preventDefault();
				const user = store.currentUser();
				if (!user || user.role !== 'client') return feedback(form, 'Un compte client local est requis pour publier un avis.');
				const values = Object.fromEntries(new FormData(form));
				const reviews = store.read('reviews', {});
				const profileReviews = reviews[form.dataset.pro] || [];
				const review = { author: user.name, email: user.email, rating: Number(values.rating), comment: values.comment.trim(), createdAt: new Date().toISOString() };
				const previous = profileReviews.findIndex((item) => item.email === user.email);
				if (previous >= 0) profileReviews[previous] = review;
				else profileReviews.push(review);
				reviews[form.dataset.pro] = profileReviews;
				store.write('reviews', reviews);
				feedback(form, 'Avis enregistré sur cet appareil uniquement.');
				window.setTimeout(() => location.reload(), 500);
			}

			if (form.matches('[data-appeal-form]')) {
				event.preventDefault();
				const appeals = store.read('appeals', []);
				appeals.unshift({ sanctionId: form.dataset.sanction, message: new FormData(form).get('message').trim(), createdAt: new Date().toISOString(), status: 'local-only' });
				store.write('appeals', appeals);
				feedback(form, 'Demande de réexamen enregistrée sur cet appareil; elle n’a pas été transmise à un modérateur.');
			}

			if (form.matches('[data-reset-form]')) {
				event.preventDefault();
				feedback(form, 'La réinitialisation de mot de passe nécessite un serveur et un envoi d’e-mail; aucune modification n’a été faite.');
			}
		});

		const themePreference = document.querySelector('[data-preference="theme"]');
		if (themePreference) {
			themePreference.checked = store.read('preferences', {}).darkMode !== false;
			document.body.classList.toggle('theme-light', !themePreference.checked);
		}
		themePreference?.addEventListener('change', (event) => {
			document.body.classList.toggle('theme-light', !event.target.checked);
			store.write('preferences', { ...store.read('preferences', {}), darkMode: event.target.checked });
		});
		document.querySelectorAll('[data-preference]:not([data-preference="theme"])').forEach((control) => {
			const preferences = store.read('preferences', {});
			if (control.type === 'checkbox') control.checked = Boolean(preferences[control.dataset.preference]);
			else if (preferences[control.dataset.preference]) control.value = preferences[control.dataset.preference];
			control.addEventListener('change', () => store.write('preferences', { ...store.read('preferences', {}), [control.dataset.preference]: control.type === 'checkbox' ? control.checked : control.value }));
		});
	}

	return { toast, bindSharedActions, openExternalRequest };
})();
