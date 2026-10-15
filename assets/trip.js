// Disegna un viaggio a partire dai dati JSON decifrati (vedi src/trips/*.json).
const TripView = (() => {
  const TABS = [
    ['plan', 'Programma', 'list-numbers'],
    ['Da vedere', 'Da vedere', 'binoculars'],
    ['Idee', 'Idee', 'lightbulb'],
    ['Eventi', 'Eventi', 'ticket'],
    ['Cibo', 'Cibo', 'fork-knife'],
    ['story', 'Storia', 'book-open'],
  ];
  const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const WDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = n => `<i class="ph ph-${n}" aria-hidden="true"></i>`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const short = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  // Foto: indirizzi diretti di Wikimedia ricavati in anticipo (t.imgs); altrimenti Special:FilePath, che fa 2 reindirizzamenti
  let IMGS = {};
  const img = (name, w) => {
    const m = IMGS[name];
    if (m) {
      const ws = Object.keys(m).map(Number).sort((a, b) => a - b);
      return m[ws.find(x => x >= w) || ws[ws.length - 1]];
    }
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name.replace(/ /g, '_')) + '?width=' + w;
  };
  const srcset = (name, widths = [500, 960, 1920]) => IMGS[name]
    ? Object.entries(IMGS[name]).map(([w, u]) => `${u} ${w}w`).join(', ')
    : widths.map(w => `${img(name, w)} ${w}w`).join(', ');
  const mapUrl = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const dirUrl = d => 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(d.from) +
    '&destination=' + encodeURIComponent(d.to) + (d.via && d.via.length ? '&waypoints=' + encodeURIComponent(d.via.join('|')) : '');

  // Sul telefono i link web di Maps aprono prima una scheda del browser, che carica Maps web in sottofondo
  // e rallenta l'app. Qui si apre direttamente l'app Google Maps.
  const UA = navigator.userAgent;
  const IS_ANDROID = /Android/i.test(UA);
  const IS_IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  function mapsLink(web, ios) {
    if (IS_ANDROID) {
      const intent = 'intent://' + web.replace(/^https:\/\//, '') + '#Intent;scheme=https;package=com.google.android.apps.maps;' +
        'S.browser_fallback_url=' + encodeURIComponent(web) + ';end';
      return `href="${esc(intent)}"`;
    }
    if (IS_IOS) return `href="${esc(ios)}" data-web="${esc(web)}"`;
    return `href="${esc(web)}" target="_blank" rel="noopener"`;
  }
  // Luoghi su Android: link geo: invece della ricerca web, che in Maps restava bloccata a caricare la scheda.
  // Con le coordinate si apre direttamente il punto con il nome; senza, una ricerca per nome.
  const mapLink = (q, ll, label) => {
    if (IS_ANDROID) {
      const geo = ll ? `geo:${ll[0]},${ll[1]}?q=${ll[0]},${ll[1]}(${encodeURIComponent(label || q)})` : 'geo:0,0?q=' + encodeURIComponent(q);
      return `href="${esc(geo)}"`;
    }
    return mapsLink(mapUrl(q), 'comgooglemaps://?q=' + encodeURIComponent(q));
  };
  const dirLink = d => mapsLink(dirUrl(d), 'comgooglemaps://?directionsmode=driving&saddr=' + encodeURIComponent(d.from) +
    '&daddr=' + [...(d.via || []), d.to].map(encodeURIComponent).join('+to:'));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  function todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  function dayList(t, today, cls = '') {
    return `<ul class="days${cls}">` + t.days.map((d, i) => {
      const dt = parse(d.date);
      return `<li><a href="#d${i + 1}" data-day="${i}">
        <span class="dbox"><b>${dt.getDate()}</b><span>${MONTHS[dt.getMonth()]}</span></span>
        <span class="txt"><strong>${esc(d.place)}${d.date === today ? '<span class="today-tag">Oggi</span>' : ''}</strong>
          <span>${esc(d.route)}</span>
          <span class="meta">${d.drive && d.drive.time ? `<span>${icon(d.drive.icon || 'car-profile')}${esc(d.drive.time)}</span>` : ''}${d.night ? `<span>${icon('bed')}${esc(d.night)}</span>` : ''}</span>
        </span>
        <span class="go">${icon('caret-right')}</span></a></li>`;
    }).join('') + '</ul>';
  }

  // Etichette dei locali: prezzo (€-€€€€) e tipo, con icona per leggerle a colpo d'occhio
  const TAGS = { veg: ['leaf', 'Vegetariano'], vegan: ['plant', 'Vegano'], ricercato: ['sparkle', 'Ricercato'],
    tipico: ['house-line', 'Tipico'], michelin: ['star', 'Guida Michelin'], pranzo: ['sun', 'Pranzo'], dolci: ['cake', 'Caffè e dolci'] };
  const tag = k => /^€+$/.test(k) ? `<span class="price" aria-label="Fascia di prezzo ${k.length} su 4">${k}</span>`
    : TAGS[k] ? `<span>${icon(TAGS[k][0])}${TAGS[k][1]}</span>` : `<span>${esc(k)}</span>`;

  const GMAPS = '<img class="gm" src="assets/vendor/googlemaps.svg" alt="" width="22" height="22">';

  // num: contatore condiviso per numerare i luoghi come i segnaposto della mappa del giorno
  function items(list, num) {
    return '<ul class="items">' + list.map(it => {
      const n = num && it.ll ? ++num.n : 0;
      return `<li>
      ${it.img ? `<img class="thumb" src="${img(it.img, 240)}" srcset="${img(it.img, 240)} 1x, ${img(it.img, 500)} 2x" alt="" loading="lazy" decoding="async">` : ''}
      <div class="body">
        <div class="head"><span class="t">${n ? `<span class="n" aria-label="Punto ${n} sulla mappa">${n}</span>` : ''}${esc(it.t)}${it.check ? '<span class="chk">da verificare</span>' : ''}</span>
        ${it.q ? `<a class="icon-btn gmap" ${mapLink(it.q, it.ll, it.t)} aria-label="Apri ${esc(it.t)} in Google Maps">${GMAPS}</a>` : ''}</div>
        <p class="d">${it.d || ''}</p>${it.tags ? '<p class="tags">' + it.tags.map(tag).join('') + '</p>' : ''}
      </div></li>`;
    }).join('') + '</ul>';
  }

  // Mappe leggere: Leaflet (copia locale) e tile OpenStreetMap, caricati solo quando una mappa entra nello schermo
  const LEAFLET = 'assets/vendor/leaflet/';
  const COARSE = window.matchMedia('(pointer: coarse)').matches;
  let leafletP;
  const loadLeaflet = () => leafletP || (leafletP = new Promise((ok, ko) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET + 'leaflet.min.css';
    const js = document.createElement('script');
    js.src = LEAFLET + 'leaflet.min.js';
    js.onload = () => ok(window.L);
    js.onerror = () => { leafletP = null; ko(); };
    document.head.append(css, js);
  }));
  // Mappa del giorno: solo i luoghi da vedere, nello stesso ordine (e numero) della lista
  function dayPoints(d) {
    const pts = [];
    (d.sections || []).filter(s => s.tab === 'Da vedere')
      .forEach((s, k) => (s.items || []).forEach(it => it.ll && pts.push({ ll: it.ll, t: it.t, q: it.q, s: k })));
    return pts;
  }

  async function drawMap(el, t) {
    let L;
    try { L = await loadLeaflet(); } catch (e) {
      el.innerHTML = '<p class="map-err">La mappa non si carica: serve la connessione.</p>';
      el.dataset.ready = '';
      return;
    }
    const map = L.map(el, { scrollWheelZoom: false, dragging: !COARSE, tap: false, zoomSnap: .5 });
    el._map = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const pin = (cls, html, w = 36) => {
      const h = /sm/.test(cls) ? 26 : 36;
      return L.divIcon({ className: '', html: `<span class="pin ${cls}">${html}</span>`, iconSize: [w, h], iconAnchor: [w / 2, h / 2], popupAnchor: [0, -h / 2] });
    };
    const fit = ll => ll.length > 1 ? map.fitBounds(ll, { padding: [36, 36], maxZoom: 15 }) : map.setView(ll[0], 14);

    if (el.dataset.map === 'day') {
      const pts = dayPoints(t.days[Number(el.dataset.i)]);
      pts.forEach((p, k) => L.marker(p.ll, { icon: pin('num', k + 1), title: p.t, riseOnHover: true })
        .bindPopup(`<b>${k + 1}. ${esc(p.t)}</b>` + (p.q ? `<a class="btn" ${mapLink(p.q, p.ll, p.t)}>${GMAPS}Apri in Google Maps</a>` : ''))
        .addTo(map));
      // Con soste lungo la strada i punti sono lontani: si inquadra il gruppo della città
      let view = pts.map(p => p.ll);
      const b = L.latLngBounds(view);
      if (pts.length > 1 && b.getNorthWest().distanceTo(b.getSouthEast()) > 30000) {
        const last = pts[pts.length - 1].s;
        view = pts.filter(p => p.s === last).map(p => p.ll);
      }
      fit(view);
    } else {
      // Mappa del viaggio: il percorso completo e una tappa per ogni notte
      const route = [];
      // Percorso stradale precalcolato (drive.path) se c'è, altrimenti le tappe in linea dritta
      t.days.forEach(d => (d.drive ? d.drive.path || d.drive.ll || [] : []).forEach(ll => {
        const last = route[route.length - 1];
        if (ll && !(last && last[0] === ll[0] && last[1] === ll[1])) route.push(ll);
      }));
      if (route.length > 1) L.polyline(route, { color: '#b4441c', weight: 4, opacity: .85, lineJoin: 'round' }).addTo(map);
      const first = t.days[0].drive && t.days[0].drive.ll && t.days[0].drive.ll[0];
      const close = (a, b) => Math.abs(a[0] - b[0]) < .03 && Math.abs(a[1] - b[1]) < .03;
      const home = [];
      const stops = [];
      t.days.forEach((d, i) => {
        const ll = d.drive && d.drive.ll ? d.drive.ll[d.drive.ll.length - 1] : d.ll;
        if (!ll || !d.night || d.night === 'In volo') return;
        if (first && close(ll, first)) { home.push(i); return; }
        const near = stops.find(s => close(s.ll, ll));
        near ? near.days.push(i) : stops.push({ ll, days: [i] });
      });
      stops.forEach(s => {
        // Giorni consecutivi come intervallo: 4-5; ritorni nello stesso posto separati da virgola: 1-2,21
        const runs = [];
        s.days.forEach(i => { const r = runs[runs.length - 1]; r && r[1] === i - 1 ? r[1] = i : runs.push([i, i]); });
        const label = runs.map(([a, b]) => a === b ? `${a + 1}` : `${a + 1}-${b + 1}`).join(',');
        const html = s.days.map(i => `<a href="#d${i + 1}">Giorno ${i + 1}, ${esc(t.days[i].place)}</a>`).join('');
        // Con molte tappe i segnaposto sono più piccoli, così il percorso resta visibile
        const small = stops.length > 10;
        L.marker(s.ll, { icon: pin('num' + (small ? ' sm' : ''), label, (small ? 26 : 36) + (label.length - 1) * (small ? 7 : 8)), title: 'Giorno ' + label }).bindPopup(html).addTo(map);
      });
      if (first) L.marker(first, { icon: pin('start', icon('flag')), title: 'Partenza' })
        .bindPopup('<b>Partenza' + (home.length ? ' e arrivo' : '') + `, ${esc(t.days[0].drive.from)}</b>` +
          home.map(i => `<a href="#d${i + 1}">Giorno ${i + 1}, ${esc(t.days[i].place)}</a>`).join('')).addTo(map);
      fit(route.length ? route : stops.map(s => s.ll));
    }

    // Sul telefono la mappa non blocca lo scorrimento della pagina finché non la si tocca
    if (COARSE) {
      el.insertAdjacentHTML('beforeend', `<button type="button" class="map-hint">${icon('hand-pointing')}Tocca per muovere la mappa</button>`);
      const hint = el.querySelector('.map-hint');
      L.DomEvent.disableClickPropagation(hint);
      hint.addEventListener('click', () => { map.dragging.enable(); hint.remove(); });
    }
  }

  function table(tb) {
    // Su telefono una tabella larga non si legge: ogni riga diventa una scheda
    return '<div class="rows">' + tb.rows.map(r => `<div class="card"><strong>${esc(r[0])}</strong>` +
      r.slice(1).map((c, j) => `<p><b>${esc(tb.head[j + 1])}:</b> ${esc(c)}</p>`).join('') + '</div>').join('') + '</div>';
  }

  function panels(d, i) {
    const out = [];
    if (d.plan && d.plan.length) out.push(['plan', '<ol class="plan">' + d.plan.map(p => `<li>${p}</li>`).join('') + '</ol>']);
    for (const key of ['Da vedere', 'Idee', 'Eventi', 'Cibo']) {
      const secs = (d.sections || []).filter(s => s.tab === key);
      if (!secs.length) continue;
      const sights = key === 'Da vedere';
      const num = sights ? { n: 0 } : null;
      const map = sights && dayPoints(d).length ? `<div class="map map-day" data-map="day" data-i="${i}" role="region" aria-label="Mappa dei luoghi da vedere"></div>` : '';
      out.push([key, map + secs.map(s => `<h3>${esc(s.title)}</h3>` + (s.text ? `<p class="lead">${s.text}</p>` : '') +
        (s.items ? items(s.items, num) : '') + (s.table ? table(s.table) : '')).join('')]);
    }
    if (d.story) out.push(['story', `<p class="story">${d.story}</p>`]);
    const saved = store.get('viaggi.tab.' + i);
    const active = out.some(p => p[0] === saved) ? saved : out[0] && out[0][0];
    const tabs = out.map(([key]) => {
      const [, label, ic] = TABS.find(t => t[0] === key);
      return `<button class="tab" role="tab" id="t${i}-${key}" aria-controls="p${i}-${key}" aria-selected="${key === active}" tabindex="${key === active ? 0 : -1}" data-key="${key}">${icon(ic)}${label}</button>`;
    }).join('');
    const bodies = out.map(([key, html]) =>
      `<div class="panel" role="tabpanel" id="p${i}-${key}" aria-labelledby="t${i}-${key}"${key === active ? '' : ' hidden'}>${html}</div>`).join('');
    return out.length ? `<div class="tabs" role="tablist" aria-label="Sezioni del giorno">${tabs}</div>${bodies}` : '';
  }

  function booking(b) {
    const kind = { hotel: ['bed', 'Hotel'], camp: ['tent', 'Campeggio'], dinner: ['fork-knife', 'Cena'] }[b.type] || ['bed', 'Alloggio'];
    return `<div class="lrow">${icon(kind[0])}<div class="lbody">
      <span class="kind">${kind[1]}${b.when ? ', ' + esc(b.when) : ''}</span>
      <strong class="name">${esc(b.name)}</strong>
      ${b.price ? `<p class="when">${esc(b.price)}</p>` : ''}
      ${b.status ? `<p class="ok">${icon('check-circle')}${esc(b.status)}</p>` : ''}
      ${b.info ? `<p class="info">${esc(b.info)}</p>` : ''}
      ${b.q ? `<div class="actions"><a class="btn" ${mapLink(b.q, b.ll, b.name)}>${GMAPS}Mappa</a>
        ${b.type !== 'dinner' ? `<a class="btn" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(b.q)}" target="_blank" rel="noopener">${icon('images')}Foto</a>` : ''}
        ${b.url ? `<a class="btn" href="${esc(b.url)}" target="_blank" rel="noopener">${icon('arrow-square-out')}${/booking\.com/.test(b.url) ? 'Booking' : 'Sito'}</a>` : ''}</div>` : ''}
      </div></div>`;
  }

  function day(d, i, n, today, past) {
    const dt = parse(d.date);
    return `<article class="day" id="d${i + 1}" data-i="${i}">
      <p class="day-k">Giorno ${i + 1} di ${n}, ${WDAYS[dt.getDay()]} ${short(dt)}${d.date === today ? ', oggi' : ''}</p>
      <h2>${esc(d.place)}</h2>
      <p class="day-route">${esc(d.route)}</p>
      ${d.summary ? `<p class="day-sum">${esc(d.summary)}</p>` : ''}
      ${d.photos && d.photos.length ? '<div class="photos">' + d.photos.map((p, k) => `<figure>
        <img src="${img(p.img, 800)}" srcset="${srcset(p.img)}" sizes="(min-width:1024px) 250px, 84vw" alt="${esc(p.title)}" loading="lazy" decoding="async"${k ? '' : ' fetchpriority="low"'}>
        <figcaption><b>${esc(p.title)}</b>${esc(p.text)}</figcaption></figure>`).join('') + '</div>' : ''}
      ${d.notes && d.notes.length ? `<div class="note">${icon('warning-circle')}<div>${d.notes.map(x => `<p>${x}</p>`).join('')}</div></div>` : ''}
      ${d.care && d.care.length ? `<div class="care"><strong>${icon(CARE.icon || 'heart')}${esc(CARE.title || 'Attenzioni')}</strong><ul>${d.care.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      ${d.drive || (d.bookings && d.bookings.length) ? `<div class="card logi">
        ${d.drive ? `<div class="lrow">${icon(d.drive.icon || 'car-profile')}<div class="lbody">
          <strong class="name">${esc(d.drive.label || 'In auto')}${d.drive.time ? ', ' + esc(d.drive.time) : ''}</strong>
          ${d.drive.text ? `<p class="info">${esc(d.drive.text)}</p>` : ''}
          ${past ? '' : `<div class="actions"><a class="btn pri" ${dirLink(d.drive)}>${icon('navigation-arrow')}Naviga</a></div>`}</div></div>` : ''}
        ${(d.bookings || []).map(booking).join('')}</div>` : ''}
      ${panels(d, i)}
    </article>`;
  }

  function info(t, key) {
    const p = t.practical;
    if (!p) return '';
    const done = store.get(key) || {};
    return `<section class="block" id="info"><h2>Info pratiche</h2><div class="info-grid">
      ${p.hotels ? `<div class="card"><h3>Hotel</h3><ul class="kv">${p.hotels.rows.map(r => `<li><span>${esc(r[0])}, ${esc(r[1])}</span><span>${esc(r[2])}</span></li>`).join('')}
        <li class="tot"><span>Totale</span><span>${esc(p.hotels.total)}</span></li></ul>${p.hotels.note ? `<p class="small">${esc(p.hotels.note)}</p>` : ''}</div>` : ''}
      ${p.roads ? `<div class="card"><h3>Strade e pedaggi</h3><ul class="kv">${p.roads.rows.map(r => `<li><span>${esc(r[0])}</span><span>${esc(r[1])}</span></li>`).join('')}</ul>
        ${p.roads.note ? `<p class="small">${esc(p.roads.note)}</p>` : ''}</div>` : ''}
      ${p.care ? `<div class="card care-card"><h3>${icon(p.care.icon || 'heart')} ${esc(p.care.title || 'Attenzioni')}</h3>${p.care.lead ? `<p class="small" style="margin:0 0 12px">${esc(p.care.lead)}</p>` : ''}
        <ul class="tips">${p.care.tips.map(x => `<li>${icon(x.icon)}<span>${x.text}</span></li>`).join('')}</ul>
        ${p.care.hospitals ? `<h3 style="margin-top:20px">Ospedali lungo il percorso</h3>${items(p.care.hospitals)}` : ''}</div>` : ''}
      ${p.tips ? `<div class="card"><h3>In viaggio</h3><ul class="tips">${p.tips.map(x => `<li>${icon(x.icon)}<span>${x.text}</span></li>`).join('')}</ul></div>` : ''}
      ${p.todo ? `<div class="card"><h3>Da fare</h3><ul class="todo">${p.todo.map((x, k) => {
        const on = k in done ? done[k] : !!x.done;
        return `<li><label><input type="checkbox" data-k="${k}"${on ? ' checked' : ''}><span>${esc(x.t)}</span></label></li>`;
      }).join('')}</ul><p class="small">Le spunte restano salvate su questo dispositivo.</p></div>` : ''}
    </div></section>`;
  }

  let CARE = {};

  function render(t, root) {
    CARE = t.care || {};
    IMGS = t.imgs || {};
    const today = todayIso();
    const n = t.days.length;
    const todayIdx = t.days.findIndex(d => d.date === today);
    const s = parse(t.start), e = parse(t.end);
    const dates = `${short(s)}${s.getFullYear() !== e.getFullYear() ? ' ' + s.getFullYear() : ''} - ${short(e)} ${e.getFullYear()}`;
    const todoKey = 'viaggi.todo.' + t.title;
    document.title = t.title;

    root.innerHTML = `
      <a class="skip" href="#contenuto">Vai al contenuto</a>
      <header class="t-hero">
        ${t.cover ? `<img src="${img(t.cover.img, 1600)}" srcset="${srcset(t.cover.img, [960, 1600, 1920])}" sizes="100vw" alt="${esc(t.cover.alt)}" fetchpriority="high">` : ''}
        <a class="t-back" href="index.html">${icon('arrow-left')}Viaggi</a>
        <div class="in">
          <h1>${esc(t.title)}</h1>
          <p class="t-dates">${dates}</p>
          ${t.summary ? `<p class="sum">${esc(t.summary)}</p>` : ''}
        </div>
      </header>
      <nav class="t-top" aria-label="Navigazione giorni"><div class="in">
        <a class="icon-btn" href="index.html" aria-label="Tutti i viaggi">${icon('arrow-left')}</a>
        <button class="t-cur" type="button" data-open-days><small>Panoramica</small><strong>${esc(t.title)}</strong></button>
        <button class="icon-btn" type="button" data-step="-1" aria-label="Giorno precedente">${icon('caret-left')}</button>
        <button class="icon-btn" type="button" data-step="1" aria-label="Giorno successivo">${icon('caret-right')}</button>
      </div></nav>
      <div class="t-wrap">
        <aside class="t-side" aria-label="Giorni">${dayList(t, today)}
          <div class="side-links"><a href="#panoramica">${icon('map-trifold')}Panoramica</a><a href="#info">${icon('info')}Info pratiche</a></div></aside>
        <main class="t-main" id="contenuto" tabindex="-1">
          <section class="block" id="panoramica"><h2>Il viaggio in breve</h2>
            ${t.facts ? '<ul class="facts">' + t.facts.map(f => `<li>${icon(f.icon)}<span>${esc(f.text)}</span></li>`).join('') + '</ul>' : ''}
            ${t.days.some(d => d.ll || d.drive && d.drive.ll) ? '<div class="map map-trip" data-map="trip" role="region" aria-label="Mappa del viaggio"></div>' : ''}
            ${dayList(t, today, ' timeline')}</section>
          ${t.days.map((d, i) => day(d, i, n, today, parse(t.end) < parse(today))).join('')}
          ${info(t, todoKey)}
          <footer class="t-foot">Foto da Wikimedia Commons, serve la connessione. Prezzi e orari da verificare prima della partenza.</footer>
        </main>
      </div>
      <nav class="t-bar" aria-label="Menu">
        <a href="#panoramica">${icon('map-trifold')}Inizio</a>
        <button type="button" data-open-days>${icon('list')}Giorni</button>
        ${todayIdx >= 0 ? `<a class="today" href="#d${todayIdx + 1}">${icon('calendar-check')}Oggi</a>` : ''}
        <a href="#info">${icon('info')}Info</a>
      </nav>
      <dialog class="sheet" aria-label="Giorni del viaggio">
        <div class="sheet-h"><strong>Giorni</strong><button class="icon-btn" type="button" data-close aria-label="Chiudi">${icon('x')}</button></div>
        ${dayList(t, today)}
      </dialog>`;

    wire(root, t, todoKey);
  }

  function wire(root, t, todoKey) {
    const days = [...root.querySelectorAll('article.day')];
    const cur = root.querySelector('.t-cur');
    const sheet = root.querySelector('dialog.sheet');
    let current = -1;

    // Schede del giorno: la scheda attiva resta visibile nella riga scorrevole
    const reveal = (bar, btn) => { bar.scrollLeft = btn.offsetLeft - bar.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2; };
    root.querySelectorAll('.tabs').forEach(bar => {
      const on = bar.querySelector('[aria-selected="true"]');
      if (on) reveal(bar, on);
    });
    root.querySelectorAll('.tabs').forEach(bar => bar.addEventListener('click', e => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      const art = btn.closest('article');
      art.querySelectorAll('.tab').forEach(b => { b.setAttribute('aria-selected', b === btn); b.tabIndex = b === btn ? 0 : -1; });
      art.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== btn.getAttribute('aria-controls'); });
      const m = art.querySelector('.panel:not([hidden]) .map');
      if (m && m._map) setTimeout(() => m._map.invalidateSize(), 0);
      store.set('viaggi.tab.' + art.dataset.i, btn.dataset.key);
      reveal(bar, btn);
      const top = bar.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * .6) bar.scrollIntoView({ block: 'start' });
    }));

    // Tastiera: frecce, Home e Fine spostano la scheda attiva (schema ARIA delle schede)
    root.querySelectorAll('.tabs').forEach(bar => bar.addEventListener('keydown', e => {
      const tabs = [...bar.querySelectorAll('.tab')];
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      const t = tabs[(j + tabs.length) % tabs.length];
      t.focus();
      t.click();
    }));

    // Foglio dei giorni
    root.querySelectorAll('[data-open-days]').forEach(b => b.addEventListener('click', () => {
      if (window.matchMedia('(min-width:1024px)').matches) { root.querySelector('#panoramica').scrollIntoView(); return; }
      sheet.showModal();
    }));
    sheet.addEventListener('click', e => {
      if (e.target === sheet || e.target.closest('[data-close]') || e.target.closest('a')) sheet.close();
    });

    // Giorno corrente in base alla posizione reale: l'ultimo giorno il cui inizio è salito
    // nel terzo alto dello schermo. Un margine fisso non basta: dopo un salto il giorno
    // precedente resta visibile di pochi pixel sotto la barra e veniva preso per quello corrente.
    const topBar = () => root.querySelector('.t-top').getBoundingClientRect().height;
    const dayAt = () => {
      const limit = topBar() + window.innerHeight * .35;
      let i = -1;
      days.forEach((d, k) => { if (d.getBoundingClientRect().top <= limit) i = k; });
      return i;
    };

    // Giorno precedente / successivo
    root.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
      const next = Math.min(days.length - 1, Math.max(0, dayAt() + Number(b.dataset.step)));
      days[next].scrollIntoView();
      setCurrent(next);
    }));

    // Giorno visibile: aggiorna barra superiore ed elenco laterale
    const setCurrent = i => {
      if (i === current) return;
      current = i;
      if (i < 0) {
        cur.innerHTML = `<small>Panoramica</small><strong>${esc(t.title)}</strong>`;
      } else {
        const d = t.days[i], dt = parse(d.date);
        cur.innerHTML = `<small>Giorno ${i + 1} di ${days.length}</small><strong>${esc(d.place)}, ${WDAYS[dt.getDay()]} ${short(dt)}</strong>`;
      }
      root.querySelectorAll('.days a').forEach(a => a.classList.toggle('on', Number(a.dataset.day) === i));
      root.querySelector('[data-step="-1"]').disabled = i <= 0;
      root.querySelector('[data-step="1"]').disabled = i >= days.length - 1;
    };
    setCurrent(-1);
    // L'observer segnala quando l'inizio di un giorno attraversa il terzo alto dello schermo
    const io = new IntersectionObserver(() => setCurrent(dayAt()), { rootMargin: '0px 0px -65% 0px' });
    days.forEach(d => io.observe(d));
    window.addEventListener('scrollend', () => setCurrent(dayAt()));
    setCurrent(dayAt());

    // Mappe: si disegnano solo quando arrivano vicino allo schermo
    const mio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting || e.target.dataset.ready) return;
      e.target.dataset.ready = '1';
      drawMap(e.target, t);
    }), { rootMargin: '300px 0px' });
    root.querySelectorAll('[data-map]').forEach(m => mio.observe(m));

    // iPhone: se l'app Google Maps non c'è, dopo un attimo apre Maps sul web
    root.addEventListener('click', e => {
      const a = e.target.closest('a[data-web]');
      if (!a) return;
      setTimeout(() => { if (document.visibilityState === 'visible') location.href = a.dataset.web; }, 1500);
    });

    // Lista "da fare" salvata sul dispositivo
    root.querySelectorAll('.todo input').forEach(inp => inp.addEventListener('change', () => {
      const done = store.get(todoKey) || {};
      done[inp.dataset.k] = inp.checked;
      store.set(todoKey, done);
    }));
  }

  return { render };
})();
