// Tests du moteur : intégrité des données et comportements agronomiques attendus.
// Lancer : npm test (Node 20 ou plus, aucune dépendance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const context = vm.createContext({ PRODUCTS: JSON.parse(read('data/products.json')) });
const api = vm.runInContext(
  read('assets/js/rules.js') + '\n' + read('assets/js/engine.js') +
  '\n;({ parse, ctxFromParse, defaultCtx, rankAll, equivalents, PBYID, CROPS, EL, EQUIP, OWN, PRODUCTS })',
  context,
);

const search = (q, base) => {
  const ctx = api.ctxFromParse(api.parse(q), Object.assign(api.defaultCtx(), base || {}));
  return { ctx, r: api.rankAll(ctx) };
};
const ids = (list) => list.map((x) => x.p.id);

/* ---------- Intégrité des données ---------- */

test('chaque produit a un identifiant unique et des champs complets', () => {
  const seen = new Set();
  for (const p of api.PRODUCTS) {
    assert.ok(p.id && !seen.has(p.id), `identifiant en double ou vide : ${p.id}`);
    seen.add(p.id);
    assert.ok(p.name, `${p.id} : nom manquant`);
    assert.ok(Array.isArray(p.aliases) && p.aliases.length, `${p.id} : aucun synonyme de recherche`);
    assert.ok(Object.keys(p.prov).length, `${p.id} : prov vide`);
    for (const el of Object.keys(p.prov)) assert.ok(api.EL[el], `${p.id} : élément inconnu ${el}`);
    for (const e of p.equip) assert.ok(api.EQUIP[e], `${p.id} : matériel inconnu ${e}`);
    if (p.own) assert.ok(api.OWN[p.own], `${p.id} : effluent inconnu ${p.own}`);
    assert.ok([1, 2, 3].includes(p.speed), `${p.id} : vitesse hors 1-3`);
    assert.ok(['oui', 'non', 'cond'].includes(p.ab), `${p.id} : statut AB invalide`);
  }
});

test('les règles ne citent que des éléments et produits existants', () => {
  for (const c of api.CROPS) {
    const stageIds = new Set();
    for (const st of c.stages) {
      assert.ok(!stageIds.has(st.id), `${c.id} : stade en double ${st.id}`);
      stageIds.add(st.id);
      assert.ok(['fond', 'semis', 'veg', 'tardif'].includes(st.phase), `${c.id}/${st.id} : phase invalide`);
      for (const n of st.needs) assert.ok(api.EL[n.el], `${c.id}/${st.id} : élément inconnu ${n.el}`);
      for (const pid of Object.keys(st.prefer || {})) assert.ok(api.PBYID[pid], `${c.id}/${st.id} : produit inconnu ${pid}`);
    }
  }
});

/* ---------- Compréhension de la requête ---------- */

test('les synonymes de terrain retrouvent le bon produit', () => {
  const cases = { 'super 18': 'ssp', 'ammo': 'amm33', 'perlurée': 'uree', 'patentkali': 'patentkali', 'solution 39': 'sol39', 'chlorure de potasse': 'kcl' };
  for (const [q, id] of Object.entries(cases)) assert.equal(api.parse(q).products[0], id, q);
});

test('culture, stade, besoin et contexte sont reconnus dans une phrase', () => {
  const { ctx } = search('soufre colza reprise sol calcaire en bio');
  assert.equal(ctx.crop, 'colza');
  assert.equal(ctx.stage, 'reprise');
  assert.ok(ctx.needs.has('S'));
  assert.equal(ctx.pH, 'calcaire');
  assert.equal(ctx.ab, true);
});

/* ---------- Comportements agronomiques ---------- */

test('colza à la reprise : un engrais soufré sous forme sulfate arrive en tête', () => {
  const { r } = search('soufre colza reprise');
  assert.ok(['asn', 'sa'].includes(r.ok[0].p.id), `en tête : ${r.ok[0].p.id}`);
  const sa = r.ok.find((x) => x.p.id === 'sa');
  assert.equal(Math.round(sa.dose.qty), 125, '75 kg SO3/ha avec du sulfate d’ammoniaque à 60 %');
});

test('légumineuse : pas d’azote, avec un avertissement', () => {
  const { r } = search('azote pois');
  assert.ok(r.warns.some((w) => w.kind === 'stop'));
  assert.ok(!r.T.some((t) => t.el === 'N'));
});

test('agriculture biologique : les engrais de synthèse sont écartés', () => {
  const { r } = search('blé tallage bio');
  assert.ok(!ids(r.ok).includes('amm33'));
  assert.ok(r.out.find((x) => x.p.id === 'amm33').excl.some((e) => /biologique/.test(e)));
});

test('sol calcaire : le phosphate naturel est écarté pour le phosphore', () => {
  const { r } = search('maïs starter sol calcaire');
  assert.ok(!ids(r.ok).includes('pnt'));
  assert.equal(r.ok[0].p.id, 'map');
});

test('pomme de terre : la potasse sans chlore passe devant le chlorure', () => {
  const { r } = search('potasse pomme de terre');
  const rank = ids(r.ok);
  assert.ok(rank.indexOf('sop') < rank.indexOf('kcl'));
});

test('culture en place : pas d’amendement basique proposé', () => {
  const { r } = search('blé épi 1 cm');
  assert.ok(!r.ok.some((x) => x.p.prov.pH && x.p.id !== 'cyan'));
});

test('équivalents en bio d’un engrais azoté minéral : uniquement des produits autorisés', () => {
  const ctx = Object.assign(api.defaultCtx(), { ab: true });
  const eq = api.equivalents(api.PBYID.amm33, ctx);
  assert.ok(eq.length > 0);
  assert.ok(eq.every((e) => e.q.ab !== 'non'));
});
