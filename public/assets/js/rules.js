/* =====================================================================
   RÉFÉRENTIELS ET RÈGLES AGRONOMIQUES
   Éléments, matériel, effluents et symptômes. Les cultures, leurs stades
   et leurs besoins sont des règles publicodes (dossier regles/, compilé
   dans data/regles.json) : c'est là qu'on ajoute une culture, un stade
   ou qu'on ajuste un repère. Dépend de RULES et de PublicodesEngine.
   EL[x].rule : nom de la règle de besoin sous un stade.
   ===================================================================== */

const EL = {
  N: { label: 'Azote', short: 'N', unit: 'kg N', key: 'N', rule: 'azote' },
  P: { label: 'Phosphore', short: 'P2O5', unit: 'kg P2O5', key: 'P2O5', rule: 'phosphore' },
  K: { label: 'Potasse', short: 'K2O', unit: 'kg K2O', key: 'K2O', rule: 'potasse' },
  S: { label: 'Soufre', short: 'SO3', unit: 'kg SO3', key: 'SO3', rule: 'soufre' },
  Mg: { label: 'Magnésium', short: 'MgO', unit: 'kg MgO', key: 'MgO', rule: 'magnésium' },
  pH: { label: 'Chaulage (pH)', short: 'VN', unit: 'kg éq. CaO', key: 'VN', rule: 'chaulage' },
  MO: { label: 'Matière organique', short: 'MO', unit: null, key: null, rule: 'matière organique' },
  B: { label: 'Bore', short: 'B', unit: 'kg B', key: 'B', rule: 'bore' },
  Mn: { label: 'Manganèse', short: 'Mn', unit: 'kg Mn', key: 'Mn', rule: 'manganèse' },
  Zn: { label: 'Zinc', short: 'Zn', unit: 'kg Zn', key: 'Zn', rule: 'zinc' },
};
const EL_ORDER = ['N', 'P', 'K', 'S', 'Mg', 'pH', 'MO', 'B', 'Mn', 'Zn'];

const EQUIP = {
  centrifuge: "Distributeur d'engrais (centrifuge)",
  pulve: 'Pulvérisateur ou rampe à engrais liquide',
  localisateur: 'Localisateur au semis',
  epandeur_fumier: 'Épandeur à fumier ou compost',
  tonne: 'Tonne à lisier (pendillards, enfouisseur)',
  epandeur_amendement: 'Épandeur à amendements (ou entreprise)',
  injecteur: "Injecteur d'ammoniac anhydre",
};
const OWN = {
  fumier_bovin: 'Fumier ou compost de fumier',
  lisier_bovin: 'Lisier de bovins',
  lisier_porc: 'Lisier de porcs',
  volailles: 'Fumier ou fientes de volailles',
  digestat: 'Digestat',
  compost: 'Compost de déchets verts',
};

/* ---------- Cultures et stades, lus dans les règles publicodes ---------- */
const RULES_ENGINE = new PublicodesEngine(RULES, { logger: { log() {}, warn() {}, error: console.error } });
const RULE_EL = Object.fromEntries(EL_ORDER.map(el => [EL[el].rule, el]));

function prefsFromRule(r) {
  return r['préférences']
    ? Object.fromEntries(
        Object.entries(r['préférences']).map(([id, x]) => [
          id,
          x['si besoin en'] ? [x.bonus, x.raison, x['si besoin en']] : [x.bonus, x.raison],
        ]),
      )
    : undefined;
}
const CROPS = (() => {
  const names = Object.keys(RULES);
  const children = parent =>
    names.filter(n => n.startsWith(parent + ' . ') && !n.slice(parent.length + 3).includes(' . '));
  return children('culture').map(cn => {
    const r = RULES[cn];
    return {
      id: r.id,
      name: r.titre,
      syn: r.synonymes,
      weak: r['synonymes ambigus'],
      exP: r['exigence phosphore'],
      exK: r['exigence potasse'],
      acid: r['sensibilité acidité'],
      legume: r['légumineuse'] === 'oui',
      perennial: r['pérenne'] === 'oui',
      clSensitive: r['sensible au chlore'] === 'oui',
      prefer: prefsFromRule(r),
      stages: children(cn).map(sn => {
        const st = RULES[sn];
        return {
          id: st.id,
          name: st.titre,
          phase: st.phase,
          tags: st['mots-clés'],
          prefer: prefsFromRule(st),
          needs: children(sn).map(n => {
            const nr = RULES[n];
            return {
              el: RULE_EL[n.slice(sn.length + 3)],
              rule: n,
              note: nr.description,
              src: nr.source,
              orgOnly: nr['organique seulement'] === 'oui',
              explication: nr.explication,
              repere: names.includes(n + ' . repère') ? n + ' . repère' : null,
            };
          }),
        };
      }),
    };
  });
})();
const CBYID = Object.fromEntries(CROPS.map(c => [c.id, c]));

/* ---------- Symptômes et pistes de carence ---------- */
const SYMPTOMS = {
  jaune: {
    els: ['N', 'S'],
    text: 'Jaunissement général : piste azote si les vieilles feuilles jaunissent en premier, piste soufre si ce sont les jeunes feuilles.',
  },
  internerv: {
    els: ['Mg', 'Mn'],
    text: 'Jaunissement entre les nervures : sur vieilles feuilles, piste magnésium ; sur jeunes feuilles, piste manganèse (fréquent en sol calcaire ou soufflé).',
  },
  violet: {
    els: ['P'],
    text: 'Teinte violacée sur jeunes plantes, souvent en sol froid : piste phosphore, parfois passagère au printemps.',
  },
  bords: { els: ['K'], text: 'Dessèchement du bord des vieilles feuilles : piste potassium.' },
  bore: {
    els: ['B'],
    text: "Pourriture du cœur, tige creuse ou cassée sous le capitule : piste bore. Sur tournesol, il n'existe pas de correction une fois les symptômes visibles.",
  },
  cuillere: {
    els: ['pH'],
    text: 'Feuilles en cuillère (tournesol) : piste molybdène, liée à un sol acide ; vérifier le pH.',
  },
};
