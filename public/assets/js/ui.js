/* ===================== INTERFACE ===================== */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s =>
    String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const EXAMPLES = [
    'soufre colza reprise',
    'blé épi 1 cm temps sec',
    'maïs starter sol calcaire',
    'tournesol bore',
    'luzerne implantation sol acide',
    'équivalent ammo en bio',
    'orge jaunissement entre les nervures',
    'potasse pomme de terre',
  ];
  const PILL = [
    ['N', 'N', 'N'],
    ['P2O5', 'P2O5', 'P'],
    ['K2O', 'K2O', 'K'],
    ['SO3', 'SO3', 'S'],
    ['MgO', 'MgO', 'Mg'],
    ['CaO', 'CaO', 'Ca'],
    ['VN', 'VN', 'Ca'],
    ['B', 'B', 'B'],
    ['Mn', 'Mn', 'Mn'],
    ['Zn', 'Zn', 'Zn'],
  ];
  const ELCOL = { N: 'N', P: 'P', K: 'K', S: 'S', Mg: 'Mg', pH: 'Ca', MO: 'MO', B: 'B', Mn: 'Mn', Zn: 'Zn' };
  const PROFILE_KEY = 'moteur-engrais-profil-v1';

  let ctx = loadProfile(defaultCtx());
  let view = 'conseil';
  let tab = 'all';

  function loadProfile(c) {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return c;
      const p = JSON.parse(raw);
      if (typeof p.ab === 'boolean') c.ab = p.ab;
      if (p.pH) c.pH = p.pH;
      c.superficiel = !!p.superficiel;
      c.pluvieux = !!p.pluvieux;
      c.pro = !!p.pro;
      if (p.prio) c.prio = p.prio;
      if (Array.isArray(p.equip)) c.equip = new Set(p.equip.filter(e => EQUIP[e]));
      if (Array.isArray(p.own)) c.own = new Set(p.own.filter(e => OWN[e]));
    } catch (e) {
      /* stockage indisponible */
    }
    return c;
  }
  function saveProfile() {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          ab: ctx.ab,
          pH: ctx.pH,
          superficiel: ctx.superficiel,
          pluvieux: ctx.pluvieux,
          pro: ctx.pro,
          prio: ctx.prio,
          equip: [...ctx.equip],
          own: [...ctx.own],
        }),
      );
    } catch (e) {
      /* stockage indisponible */
    }
  }

  /* ---------- Facettes ---------- */
  function buildFacets() {
    const cropSel = $('#f-crop');
    cropSel.innerHTML =
      '<option value="">Toutes cultures</option>' +
      CROPS.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    $('#f-needs').innerHTML = EL_ORDER.map(
      el =>
        `<button type="button" data-el="${el}" aria-pressed="false"><span class="dot" style="background:var(--c-${ELCOL[el]})"></span>${esc(EL[el].label)}</button>`,
    ).join('');
    $('#f-equip').innerHTML = Object.entries(EQUIP)
      .map(([k, v]) => `<label><input type="checkbox" value="${k}"> ${esc(v)}</label>`)
      .join('');
    $('#f-own').innerHTML = Object.entries(OWN)
      .map(([k, v]) => `<label><input type="checkbox" value="${k}"> ${esc(v)}</label>`)
      .join('');
  }
  function syncFacets() {
    $('#f-crop').value = ctx.crop || '';
    const crop = ctx.crop ? CBYID[ctx.crop] : null;
    const st = $('#f-stage');
    st.innerHTML = crop
      ? '<option value="">Choisir le stade</option>' +
        crop.stages.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
      : '<option value="">Choisir d\'abord une culture</option>';
    st.disabled = !crop;
    st.value = ctx.stage || '';
    document
      .querySelectorAll('#f-needs button')
      .forEach(b => b.setAttribute('aria-pressed', ctx.needs.has(b.dataset.el) ? 'true' : 'false'));
    document.querySelectorAll('input[name="ph"]').forEach(r => {
      r.checked = r.value === ctx.pH;
    });
    document.querySelectorAll('input[name="meteo"]').forEach(r => {
      r.checked = r.value === ctx.meteo;
    });
    document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.checked = (r.value === 'ab') === ctx.ab;
    });
    document.querySelectorAll('input[name="prio"]').forEach(r => {
      r.checked = r.value === ctx.prio;
    });
    $('#f-sup').checked = ctx.superficiel;
    $('#f-pluv').checked = ctx.pluvieux;
    $('#f-pro').checked = ctx.pro;
    document.querySelectorAll('#f-equip input').forEach(i => {
      i.checked = ctx.equip.has(i.value);
    });
    document.querySelectorAll('#f-own input').forEach(i => {
      i.checked = ctx.own.has(i.value);
    });
  }
  function bindFacets() {
    $('#f-crop').addEventListener('change', e => {
      ctx.crop = e.target.value || null;
      ctx.stage = null;
      ctx.stageMiss = false;
      ctx.tv = {};
      update();
    });
    $('#f-stage').addEventListener('change', e => {
      ctx.stage = e.target.value || null;
      ctx.stageMiss = false;
      ctx.tv = {};
      update();
    });
    $('#f-needs').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const el = b.dataset.el;
      ctx.needs.has(el) ? ctx.needs.delete(el) : ctx.needs.add(el);
      ctx.symptoms.clear();
      tab = 'all';
      update();
    });
    document.querySelectorAll('input[name="ph"]').forEach(r =>
      r.addEventListener('change', () => {
        ctx.pH = r.value;
        update(true);
      }),
    );
    document.querySelectorAll('input[name="meteo"]').forEach(r =>
      r.addEventListener('change', () => {
        ctx.meteo = r.value;
        update();
      }),
    );
    document.querySelectorAll('input[name="mode"]').forEach(r =>
      r.addEventListener('change', () => {
        ctx.ab = r.value === 'ab';
        update(true);
      }),
    );
    document.querySelectorAll('input[name="prio"]').forEach(r =>
      r.addEventListener('change', () => {
        ctx.prio = r.value;
        update(true);
      }),
    );
    $('#f-sup').addEventListener('change', e => {
      ctx.superficiel = e.target.checked;
      update(true);
    });
    $('#f-pluv').addEventListener('change', e => {
      ctx.pluvieux = e.target.checked;
      update(true);
    });
    $('#f-pro').addEventListener('change', e => {
      ctx.pro = e.target.checked;
      ctx.tv = {};
      update(true);
    });
    $('#f-equip').addEventListener('change', e => {
      e.target.checked ? ctx.equip.add(e.target.value) : ctx.equip.delete(e.target.value);
      update(true);
    });
    $('#f-own').addEventListener('change', e => {
      e.target.checked ? ctx.own.add(e.target.value) : ctx.own.delete(e.target.value);
      update(true);
    });
    $('#f-reset').addEventListener('click', () => {
      const keep = { equip: ctx.equip, own: ctx.own, ab: ctx.ab };
      ctx = Object.assign(defaultCtx(), keep);
      $('#q').value = '';
      tab = 'all';
      update();
    });
  }

  /* ---------- Requête ---------- */
  function runQuery(q) {
    if (!q.trim()) return;
    ctx = ctxFromParse(parse(q), ctx);
    tab = 'all';
    view = 'conseil';
    update(true);
    if (window.innerWidth < 900)
      $('#results').scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
  }

  /* ---------- Puces « situation prise en compte » ---------- */
  function chipList() {
    const out = [];
    const crop = ctx.crop ? CBYID[ctx.crop] : null;
    if (crop) out.push({ k: 'crop', l: 'Culture', v: crop.name });
    if (crop && ctx.stage) out.push({ k: 'stage', l: 'Stade', v: crop.stages.find(s => s.id === ctx.stage).name });
    ctx.needs.forEach(el => out.push({ k: 'need:' + el, l: 'Besoin', v: EL[el].label }));
    ctx.symptoms.forEach(s =>
      out.push({
        k: 'sym:' + s,
        l: 'Symptôme',
        v: {
          jaune: 'jaunissement',
          internerv: 'entre les nervures',
          violet: 'teinte violacée',
          bords: 'bords des feuilles',
          bore: 'cœur, tige ou capitule',
          cuillere: 'feuilles en cuillère',
        }[s],
      }),
    );
    if (ctx.product) out.push({ k: 'product', l: 'Produit', v: PBYID[ctx.product].name });
    if (ctx.pH !== 'inconnu')
      out.push({ k: 'ph', l: 'Sol', v: { acide: 'acide', neutre: 'pH neutre', calcaire: 'calcaire' }[ctx.pH] });
    if (ctx.superficiel) out.push({ k: 'sup', l: 'Sol', v: 'superficiel ou filtrant' });
    if (ctx.pluvieux) out.push({ k: 'pluv', l: 'Hiver', v: 'pluvieux' });
    if (ctx.meteo !== 'normale')
      out.push({ k: 'meteo', l: 'Météo', v: ctx.meteo === 'sec' ? 'sec et chaud' : 'pluie annoncée' });
    if (ctx.ab) out.push({ k: 'ab', l: 'Mode', v: 'agriculture biologique' });
    if (ctx.prio !== 'equilibre')
      out.push({
        k: 'prio',
        l: 'Priorité',
        v: { cout: 'coût', rapidite: 'rapidité', sol: 'fertilité du sol' }[ctx.prio],
      });
    ctx.own.forEach(o => out.push({ k: 'own:' + o, l: 'Sur la ferme', v: OWN[o].toLowerCase() }));
    return out;
  }
  function removeChip(k) {
    if (k === 'crop') {
      ctx.crop = null;
      ctx.stage = null;
    } else if (k === 'stage') ctx.stage = null;
    else if (k.startsWith('need:')) ctx.needs.delete(k.slice(5));
    else if (k.startsWith('sym:')) ctx.symptoms.delete(k.slice(4));
    else if (k === 'product') {
      ctx.product = null;
      ctx.equiv = false;
    } else if (k === 'ph') ctx.pH = 'inconnu';
    else if (k === 'sup') ctx.superficiel = false;
    else if (k === 'pluv') ctx.pluvieux = false;
    else if (k === 'meteo') ctx.meteo = 'normale';
    else if (k === 'ab') ctx.ab = false;
    else if (k === 'prio') ctx.prio = 'equilibre';
    else if (k.startsWith('own:')) ctx.own.delete(k.slice(4));
    ctx.tv = {};
    update(true);
  }
  function renderChips() {
    const list = chipList();
    $('#understood').innerHTML = list.length
      ? '<span class="lbl">Pris en compte :</span>' +
        list
          .map(
            c =>
              `<span class="chip">${esc(c.l)} <b>${esc(c.v)}</b><button type="button" data-chip="${esc(c.k)}" aria-label="Retirer ${esc(c.l)} ${esc(c.v)}">×</button></span>`,
          )
          .join('')
      : '<span class="lbl">Tapez une culture, un stade, un besoin, un symptôme ou un nom de produit.</span>';
  }

  /* ---------- Rendu : éléments communs ---------- */
  function pills(p) {
    return PILL.filter(([k]) => p.c[k])
      .map(
        ([k, lab, col]) =>
          `<span class="pill" style="border-left-color:var(--c-${col})">${lab} <b>${esc(fmtPct(p.c[k]))}</b>${k === 'VN' ? '' : ' %'}</span>`,
      )
      .join('');
  }
  function synShort(p, n) {
    return p.syn
      .split(';')
      .map(s =>
        s
          .replace(/[«»]/g, '')
          .replace(/\([^)]*\)/g, '')
          .trim(),
      )
      .filter(Boolean)
      .slice(0, n || 3)
      .join(', ');
  }
  function speedTxt(p) {
    return p.speed === 3 ? 'Action rapide' : p.speed === 2 ? 'Action moyenne' : 'Action lente';
  }
  function abTxt(p) {
    return p.ab === 'oui' ? 'AB : oui' : p.ab === 'non' ? 'AB : non' : 'AB : sous conditions';
  }

  function resItem(r, i) {
    const p = r.p;
    let dose = '';
    if (r.dose) {
      const d = r.dose;
      const also = d.also.length ? ' ; apporte aussi ' + d.also.map(([k, v]) => `${fmtNum(v)} kg ${k}`).join(', ') : '';
      dose = `<p class="dose">≈ <strong>${esc(fmtQty(p, d.qty))}</strong> pour ${esc(fmtNum(d.v))} ${esc(EL[d.el].unit)}/ha${esc(also)}.</p>`;
    }
    const badges = [speedTxt(p), abTxt(p)];
    if (p.ntype) badges.push('Directive nitrates : type ' + p.ntype);
    if (p.cl) badges.push('Contient du chlore');
    return `<li class="res">
      <div class="num" aria-hidden="true">${i + 1}</div>
      <div>
        <div class="res-head">
          <h3><button type="button" data-product="${p.id}">${esc(p.name)}</button></h3>
          <span class="score" title="Pertinence dans votre situation"><span class="bar"><i style="width:${r.score}%"></i></span><b>${r.score}</b><span class="sr"> sur 100</span></span>
        </div>
        <p class="meta">${esc(p.cat)}. Aussi appelé ${esc(synShort(p))}.</p>
        <div class="nutr">${pills(p)}</div>
        ${dose}
        <ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${r.warn.length ? `<ul class="warn">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        <div class="badges">${badges.map(b => `<span>${esc(b)}</span>`).join('')}</div>
      </div>
    </li>`;
  }

  /* ---------- Rendu : fiche produit ---------- */
  function focusPanel(p) {
    const eq = equivalents(p, ctx);
    const fits = goodFits(p, ctx);
    let abNote = '';
    if (ctx.ab && p.ab === 'non' && p.prov.N)
      abNote = `<div class="banner info"><span><strong>En agriculture biologique,</strong> aucun engrais azoté minéral n'est autorisé. Les équivalents ci-dessous sont des engrais organiques : leur azote dépend de la minéralisation, il est plus lent et plus coûteux à l'unité.</span></div>`;
    else if (ctx.ab && p.ab === 'non')
      abNote = `<div class="banner warn"><span>Ce produit n'est pas utilisable en agriculture biologique.</span></div>`;
    return `<section class="panel focus" aria-labelledby="focus-t">
      <button type="button" class="close" data-closefocus>Fermer la fiche</button>
      <h2 id="focus-t">${esc(p.name)}</h2>
      <p class="sub">${esc(p.cat)}${p.formule && p.formule !== '—' ? ', ' + esc(p.formule) : ''}</p>
      <div class="nutr">${pills(p)}</div>
      ${abNote}
      <dl class="facts">
        <dt>Synonymes</dt><dd>${esc(p.syn)}</dd>
        <dt>Équivalents étrangers</dt><dd>${esc(p.etr)}</dd>
        <dt>Forme, solubilité</dt><dd>${esc(p.forme)}</dd>
        ${p.autres ? `<dt>Autres éléments</dt><dd>${esc(p.autres)}</dd>` : ''}
        <dt>Effet sur le pH</dt><dd>${esc(p.ph)}</dd>
        <dt>Agriculture biologique</dt><dd>${esc(p.abTxt)}</dd>
        <dt>À savoir</dt><dd>${esc(p.rem)}</dd>
      </dl>
      ${
        eq.length
          ? `<h3>${ctx.equiv ? 'Équivalents' : 'Produits proches'}${ctx.ab ? ' utilisables en AB' : ''}</h3>
        <ul class="mini">${eq.map(e => `<li><button type="button" class="lnk" data-product="${e.q.id}">${esc(e.q.name)}</button><span class="pillrow">${pills(e.q)}</span><span class="why-x">${esc(e.notes.length ? e.notes.join(', ') : 'composition très proche')}</span></li>`).join('')}</ul>`
          : ''
      }
      ${fits.length ? `<h3>Se classe parmi les trois premiers pour</h3><div class="fits">${fits.map(f => `<button type="button" data-goto="${f.c.id}|${f.st.id}">${esc(f.c.name)}, ${esc(f.st.name.charAt(0).toLowerCase() + f.st.name.slice(1))}</button>`).join('')}</div>` : ''}
    </section>`;
  }

  /* ---------- Rendu : repères culture × stade ---------- */
  function stagePanel(crop, stage, needs) {
    const order = needs.slice().sort((a, b) => b.lvl - a.lvl);
    const lv = { 2: 'Prioritaire', 1: 'Selon situation', 0: 'Inutile ici' };
    return `<section class="panel" aria-labelledby="stage-t">
      <h2 id="stage-t">${esc(crop.name)} : ${esc(stage.name.charAt(0).toLowerCase() + stage.name.slice(1))}</h2>
      <p class="sub">Exigence COMIFER : phosphore ${esc(crop.exP)}, potasse ${esc(crop.exK)}. Sensibilité à l'acidité : ${esc(crop.acid)}.${crop.legume ? ' Légumineuse.' : ''}</p>
      <ul class="needs">${order
        .map(
          n => `<li>
          <div class="need-el"><span class="el"><i style="background:var(--c-${ELCOL[n.el]})"></i>${esc(EL[n.el].label)}</span><span class="lvl l${n.lvl}">${lv[n.lvl]}</span></div>
          <div class="need-note">${esc(n.note)}${n.target != null && n.lvl > 0 ? ` <strong>${n.lvl === 2 ? 'Repère' : 'Repère si besoin'} : ${esc(fmtNum(n.target))} ${esc(EL[n.el].unit)}/ha.</strong>` : ''}${n.src ? ` <span class="src">${esc(n.src)}</span>` : ''}</div>
        </li>`,
        )
        .join('')}</ul>
      <p class="foot">Les doses d'azote, de phosphore et de potasse s'établissent par la méthode du bilan et l'analyse de terre. Les périodes d'épandage et plafonds dépendent du programme d'actions nitrates de votre zone.</p>
    </section>`;
  }

  /* ---------- Rendu principal ---------- */
  function renderResults() {
    const root = $('#results');
    if (view === 'methode') {
      root.innerHTML = $('#tpl-method').innerHTML;
      return;
    }
    const r = rankAll(ctx);
    let h = '';
    if (ctx.stageMiss && r.crop)
      h += `<div class="banner warn"><span>Stade non reconnu pour ${esc(r.crop.name)} : choisissez-le ci-dessous.</span></div>`;
    r.warns.forEach(w => {
      h += `<div class="banner ${w.kind}"><span>${esc(w.text)}</span></div>`;
    });
    ctx.symptoms.forEach(s => {
      if (s === 'jaune' && ctx.symptoms.has('internerv')) return;
      h += `<div class="banner info"><span><strong>Piste à confirmer.</strong> ${esc(SYMPTOMS[s].text)} Une analyse de plante ou une bande témoin permet de trancher avant d'investir.</span></div>`;
    });
    if (ctx.product) h += focusPanel(PBYID[ctx.product]);
    if (r.crop && r.stage) h += stagePanel(r.crop, r.stage, r.needs);
    if (r.crop && !r.stage && !r.implicitVeg) {
      h += `<section class="panel"><h2>${esc(r.crop.name)} : à quel stade ?</h2><p class="sub">Le stade change les besoins, les formes adaptées et les produits possibles.</p>
        <div class="stagepick">${r.crop.stages.map(s => `<button type="button" data-stage="${s.id}">${esc(s.name)}</button>`).join('')}</div></section>`;
    }
    if (!r.T.length && !ctx.product && !r.crop && !r.warns.length) {
      h += `<section class="panel empty"><h2>Décrivez votre situation</h2>
        <p class="sub">Une culture et un stade suffisent pour commencer. Vous pouvez aussi chercher un besoin, un symptôme ou un produit par l'un de ses noms (« ammo », « Super 18 », « perlurée »…).</p>
        <div class="examples-in">${EXAMPLES.map(x => `<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div></section>`;
    }
    if (r.T.length) {
      const withUnit = r.T.filter(t => EL[t.el].unit);
      h += `<section class="panel" aria-labelledby="res-t"><h2 id="res-t">Produits adaptés</h2>
        <p class="sub">Classés selon votre situation. Ouvrez un nom pour voir sa fiche et ses équivalents.</p>`;
      if (withUnit.length) {
        h += `<div class="targets"><span class="t-lbl">Objectif par hectare, pour calculer la quantité de produit</span>${withUnit
          .map(
            t =>
              `<label>${esc(EL[t.el].label)} (${esc(EL[t.el].unit)})<input type="number" min="0" step="any" inputmode="decimal" data-tv="${t.el}" value="${r.tv[t.el] != null ? esc(r.tv[t.el]) : ''}" placeholder="à définir"></label>`,
          )
          .join('')}</div>`;
      }
      if (r.T.length > 1) {
        const tabs = [['all', 'Tous les besoins']].concat(r.T.map(t => [t.el, EL[t.el].label]));
        if (!tabs.some(x => x[0] === tab)) tab = 'all';
        h += `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${esc(l)}</button>`).join('')}</div>`;
      }
      h += `<div id="list"></div></section>`;
    }
    root.innerHTML = h;
    if (r.T.length) renderList(r);
  }
  function renderList(r) {
    r = r || rankAll(ctx);
    const host = $('#list');
    if (!host) return;
    const prio = r.T.filter(t => t.w === 1);
    let h = '',
      top;
    if (tab === 'all' && prio.length >= 2) {
      h += `<h3 class="sec">Le meilleur choix pour chaque besoin prioritaire</h3><ul class="best">`;
      for (const t of prio) {
        const best = (r.byEl[t.el] || []).slice(0, 3);
        h += `<li><div class="best-el"><i style="background:var(--c-${ELCOL[t.el]})"></i>${esc(EL[t.el].label)}</div>`;
        if (!best.length) {
          h += `<div class="why-x">Aucun produit disponible dans votre situation.</div></li>`;
          continue;
        }
        const b0 = best[0];
        const d = b0.dose ? ` ≈ ${fmtQty(b0.p, b0.dose.qty)} pour ${fmtNum(b0.dose.v)} ${EL[b0.dose.el].unit}/ha.` : '';
        const reason = b0.why.find((w, i) => i > 0) || '';
        h += `<div><button type="button" class="lnk best-name" data-product="${b0.p.id}">${esc(b0.p.name)}</button><span class="best-score">${b0.score}</span>
          <p class="why-x">${esc(reason)}${esc(d)}</p>
          ${
            best.length > 1
              ? `<p class="alt">Alternatives : ${best
                  .slice(1)
                  .map(x => `<button type="button" class="lnk" data-product="${x.p.id}">${esc(x.p.name)}</button>`)
                  .join(', ')}</p>`
              : ''
          }
          <button type="button" class="see" data-tab="${t.el}">Voir le classement ${esc(EL[t.el].label.toLowerCase())}</button></div></li>`;
      }
      h += `</ul>`;
      top = r.ok.filter(x => r.T.filter(t => x.p.prov[t.el] && !(t.orgOnly && !x.p.organic)).length >= 2).slice(0, 5);
      if (top.length)
        h += `<h3 class="sec">Produits qui couvrent plusieurs besoins à la fois</h3><ol class="rank">${top.map(resItem).join('')}</ol>`;
    } else {
      const list = tab === 'all' || !r.byEl[tab] ? r.ok : r.byEl[tab];
      top = list.filter((x, i) => i < 8 && (x.score >= 40 || i < 3));
      h += top.length
        ? `<ol class="rank">${top.map(resItem).join('')}</ol>`
        : `<p class="sub">Aucun produit ne répond à ces critères. Vérifiez le matériel disponible ou le mode de production.</p>`;
    }
    const rest = (tab === 'all' ? r.ok : []).filter(x => !top.includes(x)).slice(0, 15);
    if (rest.length)
      h += `<details class="more"><summary>Autres possibilités (${rest.length})</summary><ul class="mini">${rest
        .map(
          x =>
            `<li><button type="button" class="lnk" data-product="${x.p.id}">${esc(x.p.name)}</button><span>${x.score}</span><span class="why-x">${esc(x.warn[0] || x.why[1] || x.why[0] || '')}</span></li>`,
        )
        .join('')}</ul></details>`;
    if (tab === 'all' && r.out.length)
      h += `<details class="more"><summary>Écartés dans votre situation (${r.out.length})</summary><ul class="mini">${r.out
        .map(
          x =>
            `<li><button type="button" class="lnk" data-product="${x.p.id}">${esc(x.p.name)}</button><span></span><span class="why-x">${esc(x.excl.join(' '))}</span></li>`,
        )
        .join('')}</ul></details>`;
    host.innerHTML = h;
  }

  function update(save) {
    syncFacets();
    renderChips();
    renderResults();
    document
      .querySelectorAll('.views button')
      .forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view ? 'true' : 'false'));
    if (save) saveProfile();
  }

  /* ---------- Délégation d'événements ---------- */
  function bindGlobal() {
    $('#search').addEventListener('submit', e => {
      e.preventDefault();
      runQuery($('#q').value);
    });
    $('#examples').innerHTML =
      '<span>Exemples :</span>' +
      EXAMPLES.slice(0, 5)
        .map(x => `<button type="button" data-ex="${esc(x)}">${esc(x)}</button>`)
        .join('');
    document.addEventListener('click', e => {
      const t = e.target;
      const ex = t.closest('[data-ex]');
      if (ex) {
        $('#q').value = ex.dataset.ex;
        runQuery(ex.dataset.ex);
        return;
      }
      const chip = t.closest('[data-chip]');
      if (chip) {
        removeChip(chip.dataset.chip);
        return;
      }
      const pr = t.closest('[data-product]');
      if (pr) {
        ctx.product = pr.dataset.product;
        view = 'conseil';
        update();
        $('#results').scrollIntoView({ block: 'start' });
        return;
      }
      if (t.closest('[data-closefocus]')) {
        ctx.product = null;
        ctx.equiv = false;
        update();
        return;
      }
      const go = t.closest('[data-goto]');
      if (go) {
        const [c, s] = go.dataset.goto.split('|');
        ctx.crop = c;
        ctx.stage = s;
        ctx.product = null;
        ctx.needs.clear();
        ctx.symptoms.clear();
        ctx.tv = {};
        tab = 'all';
        update();
        return;
      }
      const sp = t.closest('[data-stage]');
      if (sp) {
        ctx.stage = sp.dataset.stage;
        ctx.stageMiss = false;
        ctx.tv = {};
        update();
        return;
      }
      const tb = t.closest('[data-tab]');
      if (tb) {
        tab = tb.dataset.tab;
        document
          .querySelectorAll('.tabs [data-tab]')
          .forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
        renderList();
        return;
      }
      const v = t.closest('[data-view]');
      if (v) {
        view = v.dataset.view;
        update();
        return;
      }
    });
    document.addEventListener('input', e => {
      const i = e.target.closest('[data-tv]');
      if (!i) return;
      const v = parseFloat(String(i.value).replace(',', '.'));
      ctx.tv[i.dataset.tv] = isNaN(v) ? '' : v;
      renderList();
    });
  }

  function init() {
    buildFacets();
    bindFacets();
    bindGlobal();
    const det = $('#facets');
    if (window.innerWidth > 900) det.open = true;
    update();
  }
  init();
})();
