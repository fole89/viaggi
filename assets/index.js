// Login e landing: decifra l'elenco dei viaggi e lo mostra.
(() => {
  const $ = id => document.getElementById(id);
  const DAY = 86400000;
  const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtNoYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();

  // Dopo il login torna al viaggio richiesto (viaggio.html rimanda qui con #t=...)
  const next = (location.hash.match(/^#t=([a-f0-9]{20})$/) || [])[1];

  function range(a, b) {
    return a.getFullYear() === b.getFullYear()
      ? fmtNoYear.format(a) + ' - ' + fmt.format(b)
      : fmt.format(a) + ' - ' + fmt.format(b);
  }

  function status(start, end) {
    if (today < start) {
      const n = Math.round((start - today) / DAY);
      return { cls: '', text: n === 1 ? 'Domani' : 'Tra ' + n + ' giorni', past: false };
    }
    if (today <= end) return { cls: 'now', text: 'In corso', past: false };
    return { cls: 'past', text: 'Fatto', past: true };
  }

  function card(t) {
    const start = parse(t.start), end = parse(t.end);
    const days = Math.round((end - start) / DAY) + 1;
    const st = status(start, end);
    const a = document.createElement('a');
    a.className = 'trip' + (st.past ? ' is-past' : '');
    a.href = 'viaggio.html#' + t.data;
    a.innerHTML = '<div class="cover"></div>' +
      '<div class="body"><div class="row"><span class="dates"></span><span class="badge"></span></div><h3></h3><p class="route"></p><p class="tagline"></p>' +
      '<span class="meta"><i class="ph ph-calendar-blank" aria-hidden="true"></i><span></span></span></div>';
    const cover = a.querySelector('.cover');
    cover.style.background = t.cover || 'linear-gradient(160deg,#1f3047,#2c4a6b)';
    if (t.image) { cover.style.backgroundImage = 'url("' + encodeURI(t.image) + '")'; cover.style.backgroundSize = 'cover'; cover.style.backgroundPosition = 'center'; }
    const badge = a.querySelector('.badge');
    badge.textContent = st.text;
    if (st.cls) badge.classList.add(st.cls);
    a.querySelector('.dates').textContent = range(start, end);
    a.querySelector('h3').textContent = t.title;
    a.querySelector('.route').textContent = (t.route || []).join(', ');
    if (t.tagline) a.querySelector('.tagline').textContent = t.tagline; else a.querySelector('.tagline').remove();
    a.querySelector('.meta span').textContent = days + (days === 1 ? ' giorno' : ' giorni') +
      (days > 1 ? ', ' + (days - 1) + (days === 2 ? ' notte' : ' notti') : '');
    return { el: a, past: st.past, start, st };
  }

  function render(trips) {
    const cards = trips.map(card);
    const up = cards.filter(c => !c.past).sort((a, b) => a.start - b.start);
    const past = cards.filter(c => c.past).sort((a, b) => b.start - a.start);
    // Il prossimo viaggio (o quello in corso) è in evidenza; i viaggi fatti sono righe compatte
    if (up.length) up[0].el.classList.add('feature');
    for (const [id, list] of [['upcoming', up], ['past', past]]) {
      const sec = $(id);
      sec.hidden = list.length === 0;
      list.forEach(c => sec.querySelector('.grid').appendChild(c.el));
    }
    const n = trips.length;
    const next = up[0] && (up[0].st.cls === 'now' ? ', uno in corso' : ', il prossimo ' + up[0].st.text.toLowerCase());
    $('summary').textContent = n === 0 ? 'Nessun viaggio, per ora.' : n + (n === 1 ? ' viaggio' : ' viaggi') + (next || '') + '.';
    $('login').hidden = true;
    $('app').hidden = false;
  }

  async function open(raw) {
    const trips = JSON.parse(await Vault.decrypt('data/trips.bin', raw));
    if (next && trips.some(t => t.data === next)) { location.replace('viaggio.html#' + next); return; }
    render(trips);
  }

  function showLogin() {
    $('login').hidden = false;
    $('pw').focus();
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('go').disabled = true;
    $('go').textContent = 'Verifica…';
    $('err').textContent = '';
    try {
      const raw = await Vault.derive($('pw').value);
      await open(raw);
      Vault.save(raw, $('remember').checked);
    } catch (err) {
      $('err').textContent = err.name === 'OperationError' ? 'Password errata.' : 'Errore di caricamento, riprova.';
      $('pw').select();
    } finally {
      $('go').disabled = false;
      $('go').textContent = 'Entra';
    }
  });

  $('logout').addEventListener('click', () => {
    Vault.clear();
    location.replace(location.pathname);
  });

  const saved = Vault.load();
  if (saved) open(saved).catch(() => { Vault.clear(); showLogin(); });
  else showLogin();
})();
