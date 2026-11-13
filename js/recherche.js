window.MASTER_DOG_SEARCH = {
	init() {
		document.querySelector('[data-global-search]')?.addEventListener('submit', (event) => {
			event.preventDefault();
			const formData = new FormData(event.currentTarget);
			const params = new URLSearchParams();
			if (formData.get('q')) params.set('q', formData.get('q').trim());
			if (formData.get('city')) params.set('city', formData.get('city').trim());
			window.location.href = `pages/recherche.html?${params.toString()}`;
		});

		const form = document.querySelector('[data-directory-form]');
		if (!form) return;
		const params = new URLSearchParams(location.search);
		form.elements.q.value = params.get('q') || '';
		form.elements.city.value = params.get('city') || '';

		const renderResults = () => {
			const query = form.elements.q.value.trim().toLocaleLowerCase('fr');
			const city = form.elements.city.value.trim().toLocaleLowerCase('fr');
			const specialty = form.elements.specialty.value;
			const maxPrice = Number(form.elements.price.value) || Infinity;
			const sort = form.elements.sort.value;
			const availability = form.elements.availability.value;
			const minRating = Number(form.elements.rating.value) || 0;
			const category = form.dataset.category;
			const productsOnly = form.dataset.products === 'true';
			const matchesText = (values) => values.join(' ').toLocaleLowerCase('fr').includes(query);
			const reviews = window.MASTER_DOG_STORE.read('reviews', {});

			let professionals = window.MASTER_DOG_DATA.professionals.map(window.MASTER_DOG_STORE.professionalProfile).filter((person) => {
				if (person.visible === false) return false;
				if (category !== 'all' && person.category !== category) return false;
				if (productsOnly && person.category !== 'shops') return false;
				if (person.price > maxPrice || (city && !person.city.toLocaleLowerCase('fr').includes(city))) return false;
				if (specialty && !person.specialties.some((item) => item === specialty)) return false;
				if (minRating) {
					const ownReviews = reviews[person.id] || [];
					if (!ownReviews.length || ownReviews.reduce((sum, item) => sum + item.rating, 0) / ownReviews.length < minRating) return false;
				}
				if (availability === 'today' && !/aujourd'hui/i.test(person.availability)) return false;
				if (availability === 'week' && !/aujourd'hui|demain|cette semaine/i.test(person.availability)) return false;
				return matchesText([person.name, person.business, person.description, ...person.specialties]);
			});
			let products = (productsOnly || category === 'all') ? window.MASTER_DOG_DATA.products.filter((product) => {
				if (product.price > maxPrice || (city && !product.city.toLocaleLowerCase('fr').includes(city))) return false;
				if (minRating) return false;
				if (availability && !/disponible|ouvert/i.test(product.availability)) return false;
				if (specialty && product.category !== specialty) return false;
				return matchesText([product.name, product.category, product.shop, product.city]);
			}) : [];

			const score = (person) => {
				const ownReviews = reviews[person.id] || [];
				return ownReviews.length ? ownReviews.reduce((sum, item) => sum + item.rating, 0) / ownReviews.length : 0;
			};
			const compare = sort === 'rating-desc'
				? (left, right) => score(right) - score(left)
				: (left, right) => sort === 'price-desc' ? right.price - left.price : left.price - right.price;
			if (sort !== 'recommended') {
				professionals = [...professionals].sort(compare);
				products = [...products].sort(compare);
			}

			const results = [...professionals.map((person) => ({ html: window.MASTER_DOG_VIEWS.professionalCard(person), price: person.price })), ...products.map((product) => ({ html: window.MASTER_DOG_VIEWS.productCard(product), price: product.price }))];
			document.querySelector('[data-result-count]').textContent = `${results.length} résultat${results.length === 1 ? '' : 's'} dans les données de démonstration`;
			document.querySelector('[data-results]').innerHTML = results.length ? results.map((item) => item.html).join('') : `<div class="empty-state"><strong>Aucun résultat</strong><span>Modifiez les filtres ou réinitialisez votre recherche.</span></div>`;
		};

		form.addEventListener('input', renderResults);
		form.addEventListener('change', renderResults);
		form.addEventListener('reset', () => window.setTimeout(renderResults));
		renderResults();
	}
};
