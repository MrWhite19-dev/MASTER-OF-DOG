window.MASTER_DOG_STORE = (() => {
  const prefix = 'master-of-dog-demo:';
  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(prefix + key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  const updateList = (key, callback) => {
    const list = read(key, []);
    callback(list);
    write(key, list);
    return list;
  };

  return {
    demoNotice: 'Données de démonstration enregistrées uniquement dans ce navigateur. Ce stockage ne protège pas les comptes et ne synchronise rien entre utilisateurs.',
    read,
    write,
    currentUser: () => read('user', null),
    setUser: (user) => write('user', user),
    professionalProfile: (person) => ({ ...person, ...(read('professionalEdits', {})[person.id] || {}) }),
    signOut: () => { try { localStorage.removeItem(prefix + 'user'); } catch { /* Stockage local indisponible. */ } },
    favorites: () => read('favorites', []),
    toggleFavorite: (id, type = 'professional') => updateList('favorites', (items) => {
      const index = items.findIndex((item) => item.id === id && item.type === type);
      if (index >= 0) items.splice(index, 1);
      else items.push({ id, type });
    }),
    requests: () => read('requests', []),
    addRequest: (request) => updateList('requests', (items) => items.unshift({ ...request, id: `req-${Date.now()}`, status: 'prepared', createdAt: new Date().toISOString() })),
    reports: () => read('reports', []),
    addReport: (report) => updateList('reports', (items) => items.unshift({ ...report, id: `report-${Date.now()}`, status: 'local-review', createdAt: new Date().toISOString() })),
    notifications: () => read('notifications', []),
    cart: () => read('cart', []),
    addToCart: (id, quantity = 1) => updateList('cart', (items) => {
      const item = items.find((entry) => entry.id === id);
      if (item) item.quantity += quantity;
      else items.push({ id, quantity });
    }),
    removeFromCart: (id) => updateList('cart', (items) => {
      const index = items.findIndex((entry) => entry.id === id);
      if (index >= 0) items.splice(index, 1);
    }),
    toggleCart: (id) => updateList('cart', (items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) items.splice(index, 1);
      else items.push({ id, quantity: 1 });
    }),
    clearDemo: () => {
      try {
        Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key));
      } catch { /* Stockage local indisponible. */ }
    }
  };
})();
