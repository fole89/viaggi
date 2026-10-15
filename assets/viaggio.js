// Pagina viaggio: decifra i dati del viaggio indicato nell'hash e li disegna con TripView.
(async () => {
  const id = (location.hash.match(/^#([a-f0-9]{20})/) || [])[1];
  const raw = Vault.load();
  if (!id) { location.replace('index.html'); return; }
  if (!raw) { location.replace('index.html#t=' + id); return; }

  let content;
  try {
    content = await Vault.decrypt('data/' + id + '.bin', raw);
  } catch (err) {
    if (err.name === 'OperationError') { Vault.clear(); location.replace('index.html#t=' + id); }
    else document.getElementById('msg').textContent = 'Viaggio non trovato.';
    return;
  }

  // L'hash serve per l'id del viaggio: le ancore interne non devono sostituirlo
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView();
  });
  try {
    TripView.render(JSON.parse(content), document.getElementById('root'));
  } catch (err) {
    document.getElementById('msg').textContent = 'Il viaggio non si apre: formato non valido.';
  }
})();
