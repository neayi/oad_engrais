/* =====================================================================
   MOTEUR : compréhension de la requête, besoins, filtrage, classement.
   Dépend de PRODUCTS (data/products.json) et de rules.js.
   ===================================================================== */
const PBYID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));


/* ---------- Contexte par défaut ---------- */
function defaultCtx() {
  return {
    crop: null, stage: null, needs: new Set(), product: null, symptoms: new Set(), equiv: false,
    pH: 'inconnu', superficiel: false, pluvieux: false, pro: false,
    meteo: 'normale', ab: false, prio: 'equilibre',
    equip: new Set(Object.keys(EQUIP).filter(e => e !== 'injecteur')),
    own: new Set(), tv: {}, stageTags: [],
  };
}

/* ---------- Besoins du stade, ajustés au contexte ---------- */
function hasCond(ctx, c) {
  return c === 'acide' ? ctx.pH === 'acide' : c === 'calcaire' ? ctx.pH === 'calcaire'
    : c === 'superficiel' ? ctx.superficiel : c === 'pluvieux' ? ctx.pluvieux : false;
}
function stageNeeds(crop, stage, ctx) {
  if (!stage) return [];
  return stage.needs.map(n => {
    let lvl = n.lvl, note = n.note, target = n.target != null ? n.target : null;
    if (n.el === 'pH') {
      if (ctx.pH === 'calcaire') { lvl = 0; note = 'Sol calcaire : aucun chaulage nécessaire.'; }
      else if (ctx.pH === 'acide') { if (lvl >= 1) lvl = 2; }
      else if (ctx.pH === 'neutre' && lvl >= 1 && (crop.pHTarget || 6) < 7) { lvl = 0; note = "pH correct : pas de redressement nécessaire ; surveiller l'évolution par l'analyse de terre."; }
    } else if (lvl === 1 && n.up && n.up.some(c => hasCond(ctx, c))) lvl = 2;
    if (ctx.pro && n.targetPro != null) target = n.targetPro;
    return Object.assign({}, n, { lvl, note, target });
  });
}


/* ---------- Cibles de la recherche ---------- */
function computeTargets(crop, stage, ctx, needs) {
  const list = [], warns = [];
  let user = [...ctx.needs];
  let symptomEls = [];
  ctx.symptoms.forEach(s => {
    if (s === 'jaune' && ctx.symptoms.has('internerv')) return;
    symptomEls = symptomEls.concat(SYMPTOMS[s].els);
  });
  user = [...new Set(user.concat(symptomEls))];
  if (user.length) {
    for (const el of user) {
      const n = needs.find(x => x.el === el);
      if (crop && crop.legume && el === 'N') {
        warns.push({ kind: 'stop', text: `${crop.name} : légumineuse, pas d'apport d'azote. La fixation symbiotique couvre les besoins, et un apport d'azote réduit la nodulation.` });
        continue;
      }
      if (n && n.lvl === 0) warns.push({ kind: 'warn', text: `${EL[el].label} à ce stade : ${n.note}` });
      list.push({ el, w: 1, lvl: n ? Math.max(n.lvl, 1) : 2, note: n ? n.note : null, src: n ? n.src : null, target: n ? n.target : null, orgOnly: n ? n.orgOnly : false });
    }
  } else {
    for (const n of needs) if (n.lvl > 0) list.push({ el: n.el, w: n.lvl === 2 ? 1 : 0.35, lvl: n.lvl, note: n.note, src: n.src, target: n.target, orgOnly: n.orgOnly });
  }
  return { list, warns };
}

/* ---------- Évaluation d'un produit ---------- */
function listFr(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }

function evaluate(p, T, ctx, crop, stage, needs) {
  const why = [], warn = [], excl = [];
  const phase = stage ? stage.phase : null;
  const perennial = crop && crop.perennial;
  let sumW = 0, cov = 0, prioW = 0, covPrio = 0;
  const covered = [];
  for (const t of T) {
    let l = (p.prov[t.el] || 0) / 2;
    if (t.orgOnly && !p.organic) l = 0;
    sumW += t.w; cov += t.w * l;
    if (t.w === 1) { prioW += 1; covPrio += l; }
    if (l > 0) covered.push({ el: t.el, main: l === 1 });
  }
  if (cov === 0) return null;

  // --- Exclusions ---
  if (phase === 'fond' && p.foliarOnly) excl.push('Application foliaire : il faut une culture en place.');
  if (phase === 'veg' || phase === 'tardif') {
    if (p.id === 'cyan') excl.push('Phytotoxique : à apporter avant le semis.');
    else if (p.prov.pH && !perennial) excl.push("Amendement basique : à apporter en interculture, pas sur une culture en place.");
    else if (p.organic && p.speed === 1 && !perennial) excl.push('Produit organique à action lente : à épandre avant le semis.');
  }
  if (p.id === 'nh3' && !(crop && crop.id === 'mais' && stage && (stage.id === 'fond' || stage.id === 'f68')))
    excl.push("Injection d'ammoniac anhydre : pratique non adaptée à cette culture ou à ce stade.");
  if (crop && crop.clSensitive && p.cl && (phase === 'semis' || phase === 'veg'))
    excl.push("Chlore : à éviter sur pomme de terre à l'approche de la plantation.");
  const pT = T.find(t => t.el === 'P');
  if (pT && ctx.pH === 'calcaire' && p.pav === 'acide' && p.prov.P === 2)
    excl.push("Phosphate insoluble dans l'eau : inefficace en sol calcaire.");

  if (ctx.ab && p.ab === 'non') excl.push('Non utilisable en agriculture biologique.');
  if (!p.equip.some(e => ctx.equip.has(e))) excl.push('Matériel nécessaire non disponible : ' + p.equip.map(e => EQUIP[e].toLowerCase()).join(' ou ') + '.');
  // --- Score ---
  let s = (prioW ? 55 * covPrio / prioW : 55 * cov / sumW) + 15 * cov / sumW;
  const cv = covered.map(c => EL[c.el].label.toLowerCase() + (c.main ? '' : ' (en partie)'));
  why.push('Couvre : ' + listFr(cv) + '.');

  if (phase === 'veg' || phase === 'tardif') {
    s += p.speed === 3 ? 12 : p.speed === 2 ? 4 : -25;
    if (p.speed === 3) why.push('Action rapide, adaptée à une culture en place.');
    if (p.speed === 1) warn.push('Action lente : peu efficace sur une culture en place.');
  } else if (phase === 'semis') {
    s += p.speed === 3 ? 8 : p.speed === 2 ? 2 : -10;
  }

  const nTargeted = T.some(t => t.el === 'N');
  if (p.prov.N) {
    let r = p.volat || 0;
    if (ctx.pH === 'calcaire' && p.nh4) r += 1;
    const f = ctx.meteo === 'sec' ? 1.6 : ctx.meteo === 'pluie' ? 0.5 : 1;
    if (r > 0) {
      s -= 5 * r * f;
      if (r * f >= 1.5) {
        if (p.organic && p.liquid) warn.push("Pertes d'ammoniac importantes en surface : pendillards, enfouissement rapide ou épandage juste avant une pluie.");
        else if (phase === 'fond' || phase === 'semis') warn.push("Sensible à la volatilisation ammoniacale : enfouir rapidement ou épandre avant une pluie.");
        else warn.push("Sensible à la volatilisation ammoniacale (sol calcaire, temps sec et venteux) : apporter quand au moins 15 mm de pluie sont attendus sous 15 jours.");
      }
    }
    if (nTargeted && ctx.meteo === 'sec' && (p.volat || 0) <= 0.5 && !p.organic && p.speed === 3 && !p.liquid) {
      s += 4; why.push('Peu sensible à la volatilisation : forme la plus sûre par temps sec.');
    }
    if (nTargeted && ctx.meteo === 'pluie' && (p.volat || 0) >= 2 && !p.organic) why.push('Pluie annoncée : le risque de volatilisation est fortement réduit.');
  }
  const nNeed = needs.find(n => n.el === 'N');
  if (p.prov.N && !nTargeted) {
    if ((nNeed && nNeed.lvl === 0) || (crop && crop.legume)) {
      s -= 8 * p.prov.N; warn.push(crop && crop.legume ? "Apporte de l'azote, inutile sur une légumineuse." : "Apporte de l'azote alors que la culture n'en a pas besoin à ce stade.");
    }
  }
  if (ctx.pH === 'acide' && (p.acid || 0) <= -1.5) { s -= 10; warn.push('Très acidifiant : à limiter en sol acide.'); }
  if (pT && ctx.pH === 'acide' && p.pav === 'acide' && p.prov.P) { s += 12; why.push(p.id === 'pnt' ? 'Phosphate naturel bien solubilisé en sol acide.' : 'Phosphore peu soluble, mais bien valorisé en sol acide.'); }
  if (pT && ctx.pH === 'calcaire' && p.pav === 'soluble' && p.prov.P) { s += 5; why.push("Phosphore soluble dans l'eau, à privilégier en sol calcaire."); }
  if (pT && ctx.pH === 'calcaire' && p.pav === 'acide' && p.prov.P === 1) { s -= 15; warn.push('Phosphore peu disponible en sol calcaire.'); }
  if (crop && crop.clSensitive && p.cl && (phase === 'fond' || !phase)) { s -= 12; warn.push("Contient du chlore : sur pomme de terre, l'apporter tôt (automne-hiver) ou préférer une forme sulfate."); }
  if (crop && crop.id === 'betterave' && p.na) { s += 6; why.push('Le sodium est valorisé par la betterave.'); }
  if (p.foliar && (phase === 'veg' || phase === 'tardif')) why.push('Utilisable en pulvérisation foliaire.');
  if (p.prov.pH && T.some(t => t.el === 'pH')) {
    if (p.speed === 3) why.push(`VN ≈ ${fmtPct(p.c.VN)} : correction rapide, adaptée au redressement.`);
    else why.push(`VN ≈ ${fmtPct(p.c.VN)} : action progressive, adaptée à l'entretien.`);
  }

  const pref = stage ? stage.prefer : (crop ? crop.prefer : null);
  if (pref && pref[p.id]) {
    const [b, r, condEl] = pref[p.id];
    const ok = !condEl || needs.some(n => n.el === condEl && n.lvl >= 2) || ctx.needs.has(condEl);
    if (ok) { s += b; (b > 0 ? why : warn).push(r); }
  }

  if (p.id === 'nna') { s -= 6; warn.push('Devenu marginal en Europe : disponibilité limitée.'); }
  const owned = p.own && ctx.own.has(p.own);
  if (owned) { s += 18; why.push('Disponible sur votre exploitation.'); }
  const cost = owned ? 0 : p.cost;
  if (ctx.prio === 'cout') {
    s -= (cost - 1) * 9;
    if (cost <= 1) why.push('Coût par unité parmi les plus bas.');
    if (cost === 3) warn.push('Coût par unité élevé.');
  } else if (ctx.prio === 'rapidite') {
    s += (p.speed - 2) * 8;
  } else if (ctx.prio === 'sol') {
    if (p.prov.MO) { s += 15; why.push('Entretient la matière organique du sol.'); }
    else if (p.organic) s += 6;
  } else {
    s -= (cost - 1) * 5;
  }
  if (ctx.ab && p.ab === 'cond') warn.push('AB : ' + p.abTxt.replace(/^Oui\s*/, 'oui ').replace(/^oui \(/, 'oui, ').replace(/\)$/, '') + '.');

  s = Math.max(0, Math.min(100, Math.round(s)));
  return { p, score: s, why, warn, excl };
}

/* ---------- Dose de produit pour atteindre un objectif ---------- */
function doseFor(p, T, tv) {
  const order = T.slice().sort((a, b) => b.w - a.w);
  for (const t of order) {
    const v = tv[t.el];
    if (v == null || v === '' || isNaN(v) || v <= 0) continue;
    const key = EL[t.el].key; if (!key) continue;
    const c = p.c[key]; if (!c) continue;
    const qty = v / c * 100;
    const also = ['N', 'P2O5', 'K2O', 'SO3', 'MgO'].filter(k => k !== key && p.c[k])
      .map(k => [k, qty * p.c[k] / 100]).filter(x => x[1] >= 1);
    return { el: t.el, v, qty, also };
  }
  return null;
}
function fmtNum(x) {
  if (x == null) return '';
  const r = x >= 100 ? Math.round(x) : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  return String(r).replace('.', ',');
}
function fmtPct(x) {
  if (x == null) return '';
  const r = Number.isInteger(x) ? x : x < 1 ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10;
  return String(r).replace('.', ',');
}
function fmtQty(p, qty) {
  if (p.id === 'sol39') return `${fmtNum(qty)} kg/ha (≈ ${fmtNum(qty / 1.3)} L/ha)`;
  if (qty >= 1000) return `${fmtNum(qty / 1000)} ${p.liquid ? 't/ha (≈ m³/ha)' : 't/ha'}`;
  return `${fmtNum(qty)} kg/ha`;
}

/* ---------- Classement complet ---------- */
const PSEUDO_VEG = { id: '_veg', name: 'Culture en place', phase: 'veg', tags: [], needs: [] };
function rankAll(ctx) {
  const crop = ctx.crop ? CBYID[ctx.crop] : null;
  let stage = crop && ctx.stage ? crop.stages.find(s => s.id === ctx.stage) : null;
  const implicitVeg = !stage && ctx.symptoms.size > 0;
  if (implicitVeg) stage = PSEUDO_VEG;
  const needs = crop && stage ? stageNeeds(crop, stage, ctx) : [];
  const { list: T, warns } = computeTargets(crop, stage, ctx, needs);
  const tv = {};
  T.forEach(t => { tv[t.el] = ctx.tv[t.el] !== undefined ? ctx.tv[t.el] : (t.w === 1 ? t.target : null); });
  const res = [];
  if (T.length) for (const p of PRODUCTS) { const r = evaluate(p, T, ctx, crop, stage, needs); if (r) { r.dose = doseFor(p, T, tv); res.push(r); } }
  const ok = res.filter(r => !r.excl.length).sort((a, b) => b.score - a.score);
  const out = res.filter(r => r.excl.length).sort((a, b) => b.score - a.score);
  const byEl = {};
  if (T.length > 1) for (const t of T) {
    const T1 = [Object.assign({}, t, { w: 1 })];
    byEl[t.el] = PRODUCTS.map(p => { const r = evaluate(p, T1, ctx, crop, stage, needs); if (r) r.dose = doseFor(p, T1, tv); return r; })
      .filter(r => r && !r.excl.length && (r.p.prov[t.el] || 0) > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  }
  return { crop, stage: implicitVeg ? null : stage, implicitVeg, needs, T, warns, tv, ok, out, byEl };
}

/* ---------- Équivalents d'un produit ---------- */
function equivalents(p0, ctx) {
  const mains = EL_ORDER.filter(e => p0.prov[e] === 2);
  const first = mains[0] || EL_ORDER.find(e => p0.prov[e]);
  return PRODUCTS.filter(q => q.id !== p0.id && q.prov[first] && (!ctx.ab || q.ab !== 'non') && q.equip.some(e => ctx.equip.has(e)))
    .map(q => {
      let inter = 0, uni = 0;
      new Set([...Object.keys(p0.prov), ...Object.keys(q.prov)]).forEach(e => { const a = p0.prov[e] || 0, b = q.prov[e] || 0; inter += Math.min(a, b); uni += Math.max(a, b); });
      const sim = inter / uni - Math.abs(q.speed - p0.speed) * 0.08;
      const notes = [];
      if (q.speed < p0.speed) notes.push('action plus lente');
      if (q.speed > p0.speed) notes.push('action plus rapide');
      if (p0.cl && !q.cl) notes.push('sans chlore');
      if (!p0.cl && q.cl) notes.push('contient du chlore');
      if (q.ab !== 'non' && p0.ab === 'non') notes.push(q.ab === 'oui' ? 'utilisable en AB' : 'utilisable en AB sous conditions');
      if ((q.volat || 0) + 0.5 < (p0.volat || 0)) notes.push('moins sensible à la volatilisation');
      if ((q.volat || 0) > (p0.volat || 0) + 0.5) notes.push('plus sensible à la volatilisation');
      const missing = mains.filter(e => !q.prov[e]).map(e => EL[e].label.toLowerCase());
      if (missing.length) notes.push('sans ' + listFr(missing));
      const extra = EL_ORDER.filter(e => q.prov[e] === 2 && !p0.prov[e]).map(e => EL[e].label.toLowerCase());
      if (extra.length) notes.push('apporte aussi ' + listFr(extra));
      return { q, sim, notes };
    }).sort((a, b) => b.sim - a.sim).slice(0, 6);
}

/* ---------- Contextes où un produit se classe bien ---------- */
function goodFits(p, ctx) {
  const base = Object.assign(defaultCtx(), { ab: ctx.ab, equip: new Set(Object.keys(EQUIP)), needs: new Set(), symptoms: new Set() });
  const res = [];
  for (const c of CROPS) for (const st of c.stages) {
    const needs = stageNeeds(c, st, base);
    const T = computeTargets(c, st, base, needs).list;
    if (!T.length) continue;
    const ranked = PRODUCTS.map(q => evaluate(q, T, base, c, st, needs)).filter(r => r && !r.excl.length).sort((a, b) => b.score - a.score);
    const i = ranked.findIndex(r => r.p.id === p.id);
    if (i >= 0 && i < 3) res.push({ c, st, rank: i + 1 });
  }
  return res.sort((a, b) => a.rank - b.rank).slice(0, 8);
}

/* ---------- Compréhension de la requête ---------- */
function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'«»]/g, ' ').replace(/[^a-z0-9,.\- +]/g, ' ').replace(/\s+/g, ' ').trim();
}
const PATTERNS = (() => {
  const map = new Map();
  const add = (ph, act, weak) => { ph = norm(ph); if (!ph) return; if (!map.has(ph)) map.set(ph, { ph, acts: [], weak: !!weak }); map.get(ph).acts.push(act); };
  CROPS.forEach(c => c.syn.forEach(s => add(s, { t: 'crop', v: c.id }, c.weak && c.weak.includes(s))));
  const tags = new Set(); CROPS.forEach(c => c.stages.forEach(st => st.tags.forEach(t => tags.add(t))));
  tags.forEach(t => add(t, { t: 'stage', v: t }));
  const needs = {
    N: ['azote', 'azotee', 'fertilisation azotee', 'unites d azote'],
    P: ['phosphore', 'phosphate', 'phosphates', 'p2o5', 'phosphatee', 'phosphatage'],
    K: ['potasse', 'potassium', 'k2o', 'potassique'],
    S: ['soufre', 'souffre', 'so3', 'soufree', 'sulfate', 'sulfates'],
    Mg: ['magnesie', 'magnesium', 'mgo', 'tetanie'],
    pH: ['chaulage', 'chauler', 'chaux', 'amendement calcique', 'amendement basique', 'redresser le ph', 'remonter le ph', 'ph'],
    MO: ['matiere organique', 'humus', 'fertilite du sol', 'amendement organique'],
    B: ['bore'], Mn: ['manganese'], Zn: ['zinc'],
  };
  Object.entries(needs).forEach(([el, a]) => a.forEach(ph => add(ph, { t: 'need', v: el })));
  ['oligo', 'oligo-elements', 'oligoelements', 'oligo elements'].forEach(ph => ['B', 'Mn', 'Zn'].forEach(el => add(ph, { t: 'need', v: el })));
  add('proteines', { t: 'need', v: 'N' }); add('proteine', { t: 'need', v: 'N' });
  const ctxp = [
    [['bio', 'ab', 'biologique', 'agriculture biologique', 'en bio'], { k: 'ab', v: true }],
    [['sec', 'secheresse', 'temps sec', 'chaud', 'sans pluie', 'canicule', 'seche'], { k: 'meteo', v: 'sec' }],
    [['pluie', 'pluie annoncee', 'avant la pluie', 'avant pluie', 'il va pleuvoir'], { k: 'meteo', v: 'pluie' }],
    [['hiver pluvieux', 'pluvieux', 'lessivage', 'hiver humide'], { k: 'pluvieux', v: true }],
    [['calcaire', 'sol calcaire', 'craie', 'crayeux', 'argilo calcaire', 'argilo-calcaire', 'ph eleve', 'basique'], { k: 'pH', v: 'calcaire' }],
    [['acide', 'sol acide', 'ph bas', 'ph acide', 'acidite'], { k: 'pH', v: 'acide' }],
    [['superficiel', 'superficiels', 'filtrant', 'filtrants', 'sableux', 'sable', 'caillouteux', 'sol leger', 'sols legers', 'peu profond'], { k: 'superficiel', v: true }],
    [['pas cher', 'moins cher', 'cout', 'economique', 'prix', 'bon marche'], { k: 'prio', v: 'cout' }],
    [['rapide', 'vite', 'urgent', 'rattrapage', 'rattraper'], { k: 'prio', v: 'rapidite' }],
    [['long terme', 'fertilite'], { k: 'prio', v: 'sol' }],
  ];
  ctxp.forEach(([phs, a]) => phs.forEach(ph => add(ph, { t: 'ctx', k: a.k, v: a.v })));
  const own = [
    [['lisier', 'lisiers'], ['lisier_bovin', 'lisier_porc']], [['lisier de porc', 'lisier porc', 'lisier porcin'], ['lisier_porc']],
    [['lisier de bovin', 'lisier bovin', 'lisier de vache'], ['lisier_bovin']], [['fumier', 'fumiers'], ['fumier_bovin']],
    [['fientes', 'volailles', 'fumier de volaille', 'fumier de volailles'], ['volailles']], [['digestat', 'methanisation'], ['digestat']],
    [['compost'], ['compost']],
  ];
  own.forEach(([phs, v]) => phs.forEach(ph => add(ph, { t: 'own', v })));
  const sym = {
    jaune: ['jaunissement', 'jaunit', 'jaunissent', 'jaune', 'jaunes', 'pale', 'pales', 'chlorose', 'decoloration'],
    internerv: ['entre les nervures', 'internervaire', 'nervures', 'marbrure', 'marbrures', 'entre nervures'],
    violet: ['violet', 'violette', 'violettes', 'violace', 'violacee', 'violacees', 'rougeatre', 'pourpre'],
    bords: ['bord des feuilles', 'bords des feuilles', 'brulure des bords', 'dessechement des bords', 'bords secs'],
    bore: ['coeur noir', 'pourriture du coeur', 'tige creuse', 'cisaillement', 'capitule casse'],
    cuillere: ['cuillere', 'en cuillere'],
  };
  Object.entries(sym).forEach(([k, a]) => a.forEach(ph => add(ph, { t: 'sym', v: k })));
  ['equivalent', 'equivalents', 'remplacer', 'remplace', 'alternative', 'alternatives', 'a la place', 'au lieu', 'substitut', 'a la place de'].forEach(ph => add(ph, { t: 'equiv' }));
  PRODUCTS.forEach(p => { add(norm(p.name), { t: 'product', v: p.id }); p.aliases.forEach(a => { if (!map.has(a)) add(a, { t: 'product', v: p.id }); }); });
  return [...map.values()].sort((a, b) => b.ph.length - a.ph.length);
})();

function parse(q) {
  let s = ' ' + norm(q) + ' ';
  const f = { crop: null, stageTags: [], needs: new Set(), ctx: {}, products: [], symptoms: new Set(), own: new Set(), equiv: false, weakCrop: null };
  const apply = (pat) => pat.acts.forEach(a => {
    if (a.t === 'crop') { if (pat.weak) f.weakCrop = f.weakCrop || a.v; else f.crop = f.crop || a.v; }
    else if (a.t === 'stage') f.stageTags.push(a.v);
    else if (a.t === 'need') f.needs.add(a.v);
    else if (a.t === 'ctx') f.ctx[a.k] = a.v;
    else if (a.t === 'own') a.v.forEach(x => f.own.add(x));
    else if (a.t === 'sym') f.symptoms.add(a.v);
    else if (a.t === 'equiv') f.equiv = true;
    else if (a.t === 'product') { if (!f.products.includes(a.v)) f.products.push(a.v); }
  });
  for (const pat of PATTERNS) {
    const key = ' ' + pat.ph + ' ';
    if (s.includes(key)) { s = s.split(key).join(' ' + ' '.repeat(pat.ph.length) + ' '); apply(pat); }
  }
  if (!f.crop && f.weakCrop) f.crop = f.weakCrop;
  return f;
}
function resolveStage(cropId, tags) {
  const c = CBYID[cropId]; if (!c) return null;
  for (const t of tags) { const st = c.stages.find(x => x.tags.includes(t)); if (st) return st.id; }
  return null;
}

/* ---------- Requête -> contexte ---------- */
function ctxFromParse(f, prev) {
  const ctx = defaultCtx();
  ctx.equip = new Set(prev.equip);
  ctx.own = new Set([...prev.own, ...f.own]);
  ctx.ab = f.ctx.ab != null ? f.ctx.ab : prev.ab;
  ctx.pH = f.ctx.pH || prev.pH;
  ctx.superficiel = f.ctx.superficiel != null ? f.ctx.superficiel : prev.superficiel;
  ctx.pluvieux = f.ctx.pluvieux != null ? f.ctx.pluvieux : prev.pluvieux;
  ctx.pro = prev.pro;
  ctx.meteo = f.ctx.meteo || prev.meteo;
  ctx.prio = f.ctx.prio || prev.prio;
  const follows = (f.stageTags.length || f.needs.size || f.symptoms.size) && !f.products.length;
  ctx.crop = f.crop || (follows ? prev.crop : null);
  ctx.stage = null;
  ctx.stageMiss = false;
  if (ctx.crop) {
    ctx.stage = resolveStage(ctx.crop, f.stageTags);
    if (!ctx.stage && !f.stageTags.length && ctx.crop === prev.crop) ctx.stage = prev.stage;
    if (!ctx.stage && f.stageTags.length) ctx.stageMiss = true;
  }
  ctx.needs = new Set(f.needs);
  ctx.symptoms = new Set(f.symptoms);
  ctx.product = f.products[0] || null;
  ctx.equiv = f.equiv;
  ctx.stageTags = f.stageTags;
  return ctx;
}
