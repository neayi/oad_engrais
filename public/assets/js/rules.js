/* =====================================================================
   RÈGLES AGRONOMIQUES
   Éléments, matériel, effluents, cultures × stades et symptômes.
   C'est ici qu'on ajoute une culture, un stade ou qu'on ajuste un repère.
   Niveaux de besoin : 2 = prioritaire, 1 = selon situation, 0 = inutile.
   Options d'un besoin : src (source), up (conditions qui le rendent
   prioritaire : 'acide', 'calcaire', 'superficiel', 'pluvieux'),
   target / targetPro (repère de dose, sans / avec apports organiques
   réguliers), orgOnly (seuls les produits organiques comptent).
   prefer : { idProduit: [bonus, raison affichée, élément conditionnel] }
   ===================================================================== */

const EL = {
  N:  { label: 'Azote',             short: 'N',    unit: 'kg N',    key: 'N' },
  P:  { label: 'Phosphore',         short: 'P2O5', unit: 'kg P2O5', key: 'P2O5' },
  K:  { label: 'Potasse',           short: 'K2O',  unit: 'kg K2O',  key: 'K2O' },
  S:  { label: 'Soufre',            short: 'SO3',  unit: 'kg SO3',  key: 'SO3' },
  Mg: { label: 'Magnésium',         short: 'MgO',  unit: 'kg MgO',  key: 'MgO' },
  pH: { label: 'Chaulage (pH)',     short: 'VN',   unit: 'kg éq. CaO', key: 'VN' },
  MO: { label: 'Matière organique', short: 'MO',   unit: null,      key: null },
  B:  { label: 'Bore',              short: 'B',    unit: 'kg B',    key: 'B' },
  Mn: { label: 'Manganèse',         short: 'Mn',   unit: 'kg Mn',   key: 'Mn' },
  Zn: { label: 'Zinc',              short: 'Zn',   unit: 'kg Zn',   key: 'Zn' },
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

/* ---------- Cultures et stades ---------- */
function nd(el, lvl, note, o) { return Object.assign({ el, lvl, note }, o || {}); }
const NO_PK_VEG = 'Phosphore et potasse en végétation : sans effet sur la production des grandes cultures.';

function winterCereal(o) {
  return [
    { id: 'fond', name: 'Avant semis (fumure de fond)', phase: 'fond',
      tags: ['avant semis', 'fond', 'fumure de fond', 'semis', 'au semis', 'automne', 'interculture', 'septembre', 'octobre', 'novembre'],
      needs: [
        nd('P', 1, `Exigence ${o.exP} (COMIFER). Dose selon l'analyse de terre et le passé de fertilisation ; impasse possible en sol bien pourvu.` + (o.bsb ? ' Blé sur blé : exigence moyenne.' : ''), { src: 'COMIFER' }),
        nd('K', 1, `Exigence ${o.exK} (COMIFER).`, { src: 'COMIFER' }),
        nd('pH', 1, o.barley
          ? "L'orge est sensible à l'acidité : à éviter si le pH eau est inférieur à 5,8. Chauler de préférence avant le précédent."
          : "Chauler si le pH eau descend sous 5,8 (5,5 en sol sableux). En chaulage d'entretien, éviter l'apport d'automne juste avant une céréale d'hiver (piétin-échaudage).",
          { src: 'Arvalis', up: ['acide'] }),
        nd('MO', 1, "Fumier ou compost avant le travail du sol : entretien de la matière organique, effet azote faible sur la céréale."),
        nd('N', 0, "Pas d'azote minéral à l'automne sur céréale d'hiver : efficience faible, et apport généralement interdit en zone vulnérable."),
        nd('S', 0, "Inutile avant l'hiver : le sulfate serait lessivé avant la montaison.", { src: 'Arvalis' }),
      ] },
    { id: 'tallage', name: "Tallage – sortie d'hiver (BBCH 21-29)", phase: 'veg',
      tags: ['tallage', 'sortie hiver', 'sortie d hiver', 'fin hiver', 'fin d hiver', 'fevrier', '1er apport', 'premier apport', 'reprise'],
      needs: [
        nd('N', 2, "Premier apport, modéré, ajusté au reliquat sortie d'hiver et à l'état du peuplement ; il peut être supprimé si le reliquat est élevé. Il faut 15 à 20 mm de pluie dans les 15 jours pour le valoriser.", { src: 'Arvalis' }),
        nd('S', 1, "Si sol superficiel ou filtrant, hiver pluvieux et pas d'apports organiques réguliers : 20 à 50 kg SO3/ha entre tallage et épi 1 cm (grille Arvalis). Inutile en sol profond après un hiver normal.", { src: 'Arvalis', up: ['superficiel', 'pluvieux'], target: 40, targetPro: 20 }),
        nd('Mn', 1, (o.barley ? "L'orge est très sensible à la carence en manganèse. " : '') + "Carences fréquentes en sols calcaires, soufflés ou riches en matière organique : correction foliaire dès les premiers symptômes.", { up: ['calcaire'] }),
      ] },
    { id: 'epi1cm', name: 'Épi 1 cm (BBCH 30)', phase: 'veg',
      tags: ['epi 1 cm', 'epi 1cm', 'epi1cm', 'debut montaison', 'montaison', '2e apport', 'deuxieme apport', 'mars'],
      needs: [
        nd('N', 2, "Apport principal de la dose calculée par la méthode du bilan. L'ammonitrate est la forme la plus sûre par temps sec ; urée et solution azotée sont plus sensibles à la volatilisation." + (o.barley ? ' Orge brassicole : dose totale limitée pour respecter la teneur en protéines.' : ''), { src: 'Arvalis' }),
        nd('S', 1, "En situation à risque, le meilleur compromis est un engrais azoté soufré (rapport N/SO3 entre 2 et 3) apporté à épi 1 cm.", { src: 'Arvalis', up: ['superficiel', 'pluvieux'], target: 40, targetPro: 20 }),
        nd('Mn', 1, 'Correction foliaire si symptômes (sols calcaires ou soufflés).', { up: ['calcaire'] }),
      ],
      prefer: { asn: [10, 'Engrais azoté soufré au bon rapport N/SO3 pour épi 1 cm (Arvalis).', 'S'] } },
    { id: 'noeuds', name: '1 à 2 nœuds (BBCH 31-32)', phase: 'veg',
      tags: ['1 noeud', '2 noeuds', '1-2 noeuds', '1 2 noeuds', 'noeud', 'noeuds', '3e apport', 'troisieme apport', 'avril'],
      needs: [
        nd('N', 1, 'Fin du plan de fumure, ou dose réservée et pilotée avec un outil (capteur, imagerie).'),
        nd('S', 1, 'Rattrapage encore possible en cas de symptômes, avec une efficacité partielle.', { up: ['superficiel'], target: 30 }),
      ] },
    { id: 'dfe', name: 'Dernière feuille – épiaison (BBCH 37-55)', phase: 'tardif',
      tags: ['derniere feuille', 'dfe', 'gonflement', 'epiaison', 'apport tardif', 'proteines', 'proteine', 'mai'],
      needs: [
        o.barley
          ? nd('N', 0, "Orge : pas d'apport tardif, qui augmenterait la teneur en protéines (pénalisant en brassicole).")
          : nd('N', o.durum ? 2 : 1, o.durum
              ? 'Blé dur : apport tardif quasi indispensable pour la teneur en protéines et contre le mitadinage ; dose pilotée par outil.'
              : "Apport « protéines » piloté par outil, surtout pour les blés améliorants ou à objectif protéique. Son efficacité dépend de la pluie qui suit.", { src: 'Arvalis' }),
        nd('P', 0, NO_PK_VEG, { src: 'Arvalis' }),
        nd('K', 0, NO_PK_VEG, { src: 'Arvalis' }),
      ] },
  ];
}

function legume(o) {
  return [
    { id: 'fond', name: 'Avant semis – semis', phase: 'fond',
      tags: ['avant semis', 'fond', 'fumure de fond', 'semis', 'au semis', 'implantation', 'mars', 'avril', 'automne'],
      needs: [
        nd('P', 1, `Exigence ${o.exP} (COMIFER).`, { src: 'COMIFER' }),
        nd('K', 1, `Exigence ${o.exK} (COMIFER).`, { src: 'COMIFER' }),
        nd('pH', 1, "La nodulation est pénalisée en sol acide : viser un pH eau d'au moins 6.", { up: ['acide'] }),
        nd('N', 0, "Légumineuse : aucun apport d'azote. La fixation symbiotique couvre les besoins, et l'azote apporté réduit la nodulation." + (o.soja ? " Inoculer les semences en l'absence d'historique de soja." : '')),
      ] },
    { id: 'veg', name: 'En végétation', phase: 'veg',
      tags: ['vegetation', 'levee', 'floraison', 'mai', 'juin'],
      needs: [
        nd('N', 0, "Légumineuse : aucun apport d'azote."),
        nd('Mn', 1, 'Manganèse foliaire si carence en sol calcaire.', { up: ['calcaire'] }),
        nd('P', 0, NO_PK_VEG, { src: 'Arvalis' }),
      ] },
  ];
}

const CROPS = [
  { id: 'ble_tendre', name: 'Blé tendre', syn: ['ble', 'ble tendre', 'bth', 'ble tendre d hiver', 'froment', 'ble panifiable', 'ble d hiver', 'bles'],
    exP: 'faible', exK: 'faible', acid: 'moyenne', pHTarget: 6, stages: winterCereal({ exP: 'faible', exK: 'faible', bsb: true }) },
  { id: 'ble_dur', name: 'Blé dur', syn: ['ble dur', 'btd', 'ble dur d hiver'],
    exP: 'moyenne', exK: 'faible', acid: 'moyenne', pHTarget: 6, stages: winterCereal({ exP: 'moyenne', exK: 'faible', durum: true }) },
  { id: 'orge_h', name: "Orge d'hiver", syn: ['orge', 'orges', 'orge d hiver', 'orge hiver', 'escourgeon'],
    exP: 'moyenne', exK: 'faible', acid: 'forte', pHTarget: 6, stages: winterCereal({ exP: 'moyenne', exK: 'faible', barley: true }) },
  { id: 'orge_p', name: 'Orge de printemps', syn: ['orge de printemps', 'orge printemps', 'orge brassicole'],
    exP: 'moyenne', exK: 'faible', acid: 'forte', pHTarget: 6, stages: [
      { id: 'semis', name: 'Avant semis – semis', phase: 'semis',
        tags: ['avant semis', 'semis', 'au semis', 'fond', 'fumure de fond', 'fevrier', 'mars'],
        needs: [
          nd('P', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
          nd('K', 1, 'Exigence faible (COMIFER).', { src: 'COMIFER' }),
          nd('pH', 1, "L'orge est sensible à l'acidité : à éviter si le pH eau est inférieur à 5,8.", { src: 'Arvalis', up: ['acide'] }),
          nd('N', 1, 'Une partie de la dose peut être apportée au semis (fractionnement semis – tallage).'),
        ] },
      { id: 'tallage', name: 'Levée – tallage', phase: 'veg',
        tags: ['tallage', 'levee', '2 feuilles', '3 feuilles', 'avril'],
        needs: [
          nd('N', 2, 'Apport principal de la dose calculée par la méthode du bilan ; en brassicole, dose limitée pour la teneur en protéines.', { src: 'Arvalis' }),
          nd('S', 1, "Céréale de printemps : dose réduite de 20 kg SO3/ha par rapport aux céréales d'hiver, en situation à risque.", { src: 'Arvalis', up: ['superficiel', 'pluvieux'], target: 20 }),
          nd('Mn', 1, "L'orge est très sensible à la carence en manganèse : correction foliaire.", { up: ['calcaire'] }),
        ] },
      { id: 'epi1cm', name: 'Épi 1 cm – montaison', phase: 'veg',
        tags: ['epi 1 cm', 'epi 1cm', 'montaison', 'debut montaison', 'mai'],
        needs: [
          nd('N', 1, 'Complément éventuel, piloté ; à éviter en orge brassicole.'),
          nd('Mn', 1, 'Correction foliaire si symptômes.', { up: ['calcaire'] }),
        ] },
    ] },
  { id: 'colza', name: 'Colza', syn: ['colza', 'colzas'], exP: 'forte', exK: 'moyenne', acid: 'moyenne', pHTarget: 6, stages: [
    { id: 'fond', name: 'Avant semis – semis (août-septembre)', phase: 'fond',
      tags: ['avant semis', 'fond', 'fumure de fond', 'semis', 'au semis', 'implantation', 'aout', 'septembre', 'automne'],
      needs: [
        nd('P', 2, "Exigence forte en phosphore (COMIFER) : apport avant ou au semis, dose selon l'analyse de terre.", { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('N', 1, "Les effluents épandus avant semis (fumier de volailles, lisier, digestat) sont bien valorisés par le colza à l'automne. L'azote minéral au semis reste limité et encadré en zone vulnérable.", { orgOnly: true }),
        nd('MO', 1, 'Fumier ou compost avant semis.'),
        nd('pH', 1, 'Chauler en interculture si le pH eau descend sous 5,8.', { src: 'Arvalis', up: ['acide'] }),
        nd('S', 0, "Inutile à l'automne : la minéralisation couvre les besoins des premiers stades.", { src: 'Terres Inovia' }),
        nd('B', 0, 'Bore : apport foliaire à privilégier au printemps, à la reprise.', { src: 'Terres Inovia' }),
      ],
      prefer: { fumiervol: [6, "Azote organique bien valorisé par le colza à l'automne."], lisierporc: [4, "Azote organique bien valorisé par le colza à l'automne."], digestat: [4, "Azote organique bien valorisé par le colza à l'automne."] } },
    { id: 'reprise', name: 'Reprise de végétation (C1-C2)', phase: 'veg',
      tags: ['reprise', 'reprise de vegetation', 'sortie hiver', 'sortie d hiver', 'c1', 'c2', 'fevrier', '1er apport', 'premier apport'],
      needs: [
        nd('N', 2, "Premier apport à la reprise. Dose totale établie avec la Réglette azote colza (pesées de biomasse entrée et sortie d'hiver) ; premier passage limité à 100 kg N/ha.", { src: 'Terres Inovia' }),
        nd('S', 2, "75 kg SO3/ha sous forme sulfate, avec le 1er ou le 2e apport d'azote (C2 à D1) ; 50 kg SO3/ha si la parcelle reçoit des apports organiques réguliers. Aucun intérêt à fractionner.", { src: 'Terres Inovia', target: 75, targetPro: 50 }),
        nd('B', 1, 'En sol sableux ou à risque : bore en foliaire au printemps.', { src: 'Terres Inovia', up: ['superficiel'] }),
      ],
      prefer: { sa: [6, 'Forme sulfate recommandée pour le colza (Terres Inovia).'], asn: [8, 'Azote et soufre sulfate en un seul passage, comme le recommande Terres Inovia.'], soufre: [-30, 'Soufre élémentaire trop lent : Terres Inovia recommande la forme sulfate au printemps.'] } },
    { id: 'montaison', name: 'Début montaison – boutons accolés (C2-D2)', phase: 'veg',
      tags: ['montaison', 'debut montaison', 'd1', 'd2', 'boutons accoles', '2e apport', 'deuxieme apport', 'mars'],
      needs: [
        nd('N', 2, 'Deuxième apport ; fractionnement selon la dose totale (Réglette azote colza).', { src: 'Terres Inovia' }),
        nd('S', 2, "Si le soufre n'a pas encore été apporté : 75 kg SO3/ha sous forme sulfate (50 avec apports organiques réguliers).", { src: 'Terres Inovia', target: 75, targetPro: 50 }),
        nd('B', 1, 'Bore foliaire encore possible en sol à risque.', { up: ['superficiel'] }),
      ],
      prefer: { sa: [6, 'Forme sulfate recommandée pour le colza (Terres Inovia).'], asn: [8, 'Azote et soufre sulfate en un seul passage, comme le recommande Terres Inovia.'], soufre: [-30, 'Soufre élémentaire trop lent : Terres Inovia recommande la forme sulfate au printemps.'] } },
    { id: 'floraison', name: 'Boutons séparés – floraison (E-F)', phase: 'tardif',
      tags: ['boutons separes', 'floraison', 'f1', 'fleur', 'avril'],
      needs: [
        nd('N', 1, "Dernier apport possible jusqu'aux boutons séparés pour les fortes doses ; au-delà, plus d'intérêt.", { src: 'Terres Inovia' }),
        nd('S', 1, "Rattrapage possible jusqu'à la floraison en cas de carence : sulfate d'ammonium dissous (environ 100 kg/ha) pour limiter les brûlures."),
      ],
      prefer: { sa: [10, "Rattrapage de carence : sulfate d'ammonium dissous, environ 100 kg/ha."] } },
  ] },
  { id: 'mais', name: 'Maïs', syn: ['mais grain', 'mais ensilage', 'mais fourrage', 'mais semence', 'mais'], weak: ['mais'],
    exP: 'faible (grain) à moyenne (ensilage)', exK: 'moyenne', acid: 'faible', pHTarget: 6, stages: [
    { id: 'fond', name: 'Avant semis (fumure de fond, effluents)', phase: 'fond',
      tags: ['avant semis', 'fond', 'fumure de fond', 'printemps', 'preparation', 'labour', 'effluents'],
      needs: [
        nd('P', 1, 'Exigence faible pour le maïs grain, moyenne pour le maïs ensilage (COMIFER).', { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('N', 1, 'Les effluents (lisier, fumier, digestat) sont bien valorisés par le maïs : épandre peu avant le semis et enfouir rapidement.', { orgOnly: true }),
        nd('MO', 1, 'Fumier ou compost avant le travail du sol.'),
        nd('pH', 1, "Le maïs est peu sensible à l'acidité ; chaulage d'entretien si le pH eau descend sous 5,8.", { src: 'Arvalis', up: ['acide'] }),
      ] },
    { id: 'semis', name: 'Semis (localisation)', phase: 'semis',
      tags: ['semis', 'au semis', 'starter', 'localise', 'localisation', 'engrais starter', 'avril'],
      needs: [
        nd('P', 2, 'Starter phosphaté localisé au semis : efficace en sol froid, pauvre ou calcaire.'),
        nd('Zn', 1, 'Le maïs est sensible à la carence en zinc (sols calcaires, riches en phosphore) : zinc localisé au semis.', { up: ['calcaire'] }),
        nd('N', 1, 'En situation fragile (sol filtrant, semis précoce en zone pluvieuse), environ 30 kg N/ha vers 2-3 feuilles.', { src: 'Arvalis' }),
      ],
      prefer: { map: [10, 'Starter localisé de référence, mieux toléré par la semence que le DAP.'], app: [6, 'Starter liquide localisé.'], dap: [3, 'Utilisable en localisé, sans contact direct avec la graine.'] } },
    { id: 'f68', name: 'Avant 6-8 feuilles (apport principal)', phase: 'veg',
      tags: ['6 feuilles', '8 feuilles', '6-8 feuilles', '6 8 feuilles', 'binage', 'juin', 'apport principal'],
      needs: [
        nd('N', 2, "Apport principal juste avant 6-8 feuilles. Urée et solution 39 sont les formes les plus sensibles à la volatilisation : enfouir (binage) ou attendre une pluie de 20 à 30 mm.", { src: 'Arvalis' }),
      ] },
    { id: 'f10', name: '10 feuilles et plus', phase: 'tardif',
      tags: ['10 feuilles', '12 feuilles', 'fertirrigation', 'irrigation', 'floraison', 'panicule'],
      needs: [
        nd('N', 1, 'Complément possible par fertirrigation ou piloté par outil ; le passage du tracteur devient limitant.'),
      ] },
  ] },
  { id: 'tournesol', name: 'Tournesol', syn: ['tournesol', 'tournesols'], exP: 'faible', exK: 'moyenne', acid: 'moyenne', pHTarget: 6, stages: [
    { id: 'fond', name: 'Avant semis – semis', phase: 'fond',
      tags: ['avant semis', 'fond', 'fumure de fond', 'semis', 'au semis', 'avril', 'preparation'],
      needs: [
        nd('P', 1, 'Exigence faible (COMIFER).', { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('N', 1, "Besoins modérés, excès néfastes. L'apport en végétation est souvent mieux valorisé qu'au semis.", { src: 'Terres Inovia' }),
        nd('B', 1, 'En sol à risque (calcaire, superficiel, retour fréquent du tournesol) : environ 1,2 kg B/ha avant semis, incorporé ou non ; le foliaire en végétation reste mieux valorisé.', { src: 'Terres Inovia', up: ['calcaire', 'superficiel'], target: 1.2 }),
        nd('pH', 1, 'En sol acide, carences en molybdène (feuilles en cuillère) : vérifier le pH et chauler si besoin.', { src: 'Terres Inovia', up: ['acide'] }),
      ] },
    { id: 'veg', name: '6 à 14 feuilles', phase: 'veg',
      tags: ['6 feuilles', '8 feuilles', '10 feuilles', '12 feuilles', '14 feuilles', 'vegetation', 'mai', 'juin', 'limite passage tracteur'],
      needs: [
        nd('N', 1, "Apport en végétation mieux synchronisé avec les besoins : forme solide (ammonitrate ou urée), avant 14 feuilles ; dose par la méthode du bilan ou Héliotest.", { src: 'Terres Inovia' }),
        nd('B', 1, 'Préventif uniquement : 300 à 500 g B/ha en foliaire entre 10 feuilles et la limite de passage du tracteur (55-60 cm). Inutile une fois les symptômes visibles.', { src: 'Terres Inovia', up: ['calcaire', 'superficiel'], target: 0.4 }),
      ],
      prefer: { amm33: [6, 'Forme solide recommandée en végétation (Terres Inovia).'], can27: [6, 'Forme solide recommandée en végétation (Terres Inovia).'], uree: [4, 'Forme solide recommandée en végétation (Terres Inovia).'], sol39: [-10, 'Forme liquide déconseillée en végétation sur tournesol : préférer une forme solide (Terres Inovia).'] } },
    { id: 'bouton', name: 'Bouton floral – floraison', phase: 'tardif',
      tags: ['bouton', 'bouton floral', 'floraison', 'juillet'],
      needs: [
        nd('N', 0, "Trop tard pour l'azote."),
        nd('B', 0, "Trop tard pour le bore : la carence s'est déjà exprimée.", { src: 'Terres Inovia' }),
      ] },
  ] },
  { id: 'betterave', name: 'Betterave sucrière', syn: ['betterave', 'betteraves', 'betterave sucriere', 'betteraves sucrieres'], exP: 'forte', exK: 'forte', acid: 'forte', pHTarget: 7, stages: [
    { id: 'fond', name: 'Interculture – avant semis', phase: 'fond',
      tags: ['interculture', 'avant semis', 'fond', 'fumure de fond', 'automne', 'hiver', 'labour', 'chaulage'],
      needs: [
        nd('pH', 1, "Culture très sensible à l'acidité : pH optimal entre 7 et 7,5. Chaulage d'entretien régulier, souvent avec des écumes de sucrerie.", { src: 'ITB', up: ['acide'] }),
        nd('P', 2, 'Exigence forte (COMIFER).', { src: 'COMIFER' }),
        nd('K', 2, 'Exigence forte (COMIFER). Le sodium (kaïnite) est bien valorisé.', { src: 'COMIFER' }),
        nd('MO', 1, 'Effluents ou compost avant le travail du sol.'),
        nd('Mg', 1, 'Surveiller le magnésium en sols sableux ou très riches en potasse.'),
      ],
      prefer: { ecumes: [12, 'Amendement de référence en zone betteravière.'], kainite: [8, 'Apporte du sodium, valorisé par la betterave.'] } },
    { id: 'semis', name: 'Semis', phase: 'semis',
      tags: ['semis', 'au semis', 'mars', 'avril'],
      needs: [
        nd('N', 2, 'Apport au semis ou fractionné semis-levée, dose selon la méthode du bilan ; éviter les fortes doses au contact des graines.'),
      ] },
    { id: 'veg', name: '4 feuilles – couverture du sol', phase: 'veg',
      tags: ['4 feuilles', '6 feuilles', '8 feuilles', 'couverture', 'vegetation', 'mai', 'juin'],
      needs: [
        nd('N', 0, "Plus d'azote : il pénaliserait la richesse en sucre."),
        nd('B', 1, 'Bore foliaire en prévention de la pourriture du cœur (sols calcaires, années sèches).', { up: ['calcaire'] }),
        nd('Mn', 1, 'Manganèse foliaire si carence (sols calcaires ou soufflés).', { up: ['calcaire'] }),
        nd('Mg', 1, 'Magnésium foliaire possible en sol sableux ou très riche en potasse.'),
      ] },
  ] },
  { id: 'pdt', name: 'Pomme de terre', syn: ['pomme de terre', 'pommes de terre', 'pdt', 'patate', 'patates'], exP: 'forte', exK: 'forte', acid: 'faible', pHTarget: 6, clSensitive: true,
    prefer: { sop: [10, 'Sans chlore : qualité des tubercules préservée.'], patentkali: [8, 'Sans chlore, apporte aussi magnésium et soufre.'] }, stages: [
    { id: 'fond', name: 'Avant plantation', phase: 'fond',
      tags: ['avant plantation', 'fond', 'fumure de fond', 'automne', 'hiver', 'preparation', 'labour'],
      needs: [
        nd('K', 2, 'Exigence forte (COMIFER). Culture sensible au chlore (matière sèche, qualité) : sulfate de potassium, ou chlorure apporté tôt (automne-hiver) pour que le chlore soit lessivé.', { src: 'COMIFER' }),
        nd('P', 2, 'Exigence forte (COMIFER).', { src: 'COMIFER' }),
        nd('Mg', 1, 'Magnésium à surveiller en sols sableux.'),
        nd('MO', 1, 'Fumier ou compost avant le travail du sol.'),
        nd('pH', 0, 'Éviter de chauler juste avant : la gale commune augmente quand le pH eau approche 7. Ne pas dépasser 6,5 ; chauler sur une autre culture de la rotation.', { src: 'Arvalis' }),
      ],
      prefer: { sop: [10, 'Sans chlore : qualité des tubercules préservée.'], patentkali: [8, 'Sans chlore, apporte aussi magnésium et soufre.'] } },
    { id: 'plantation', name: 'Plantation', phase: 'semis',
      tags: ['plantation', 'planter', 'plante', 'avril', 'mars'],
      needs: [
        nd('N', 2, 'Apport principal à la plantation (dose par la méthode du bilan), complément éventuel piloté.'),
        nd('K', 1, "Si la potasse n'a pas été apportée : forme sulfate de préférence."),
        nd('P', 1, "Si le phosphore n'a pas été apporté en fond."),
      ],
      prefer: { sop: [10, 'Sans chlore : qualité des tubercules préservée.'], patentkali: [8, 'Sans chlore, apporte aussi magnésium et soufre.'] } },
    { id: 'veg', name: 'Levée – tubérisation', phase: 'veg',
      tags: ['levee', 'tuberisation', 'initiation', 'buttage', 'vegetation', 'mai', 'juin'],
      needs: [
        nd('N', 1, 'Complément piloté par outil si nécessaire, avant la fermeture des rangs.'),
        nd('Mg', 1, 'Foliaire si carence (sols sableux).'),
        nd('Mn', 1, 'Foliaire si carence.', { up: ['calcaire'] }),
      ] },
  ] },
  { id: 'pois', name: 'Pois protéagineux', syn: ['pois', 'pois proteagineux', 'pois de printemps', 'pois d hiver'], legume: true, exP: 'moyenne', exK: 'moyenne', acid: 'moyenne', pHTarget: 6,
    stages: legume({ exP: 'moyenne', exK: 'moyenne' }) },
  { id: 'feverole', name: 'Féverole', syn: ['feverole', 'feveroles', 'feve', 'feves'], legume: true, exP: 'moyenne (classe par défaut)', exK: 'moyenne (classe par défaut)', acid: 'moyenne', pHTarget: 6,
    stages: legume({ exP: 'moyenne (classe par défaut, culture non classée par le COMIFER)', exK: 'moyenne (classe par défaut)' }) },
  { id: 'soja', name: 'Soja', syn: ['soja'], legume: true, exP: 'faible', exK: 'moyenne', acid: 'moyenne', pHTarget: 6,
    stages: legume({ exP: 'faible', exK: 'moyenne', soja: true }) },
  { id: 'luzerne', name: 'Luzerne', syn: ['luzerne', 'luzernes'], legume: true, exP: 'forte', exK: 'moyenne', acid: 'très forte', pHTarget: 6.5, stages: [
    { id: 'fond', name: 'Avant implantation', phase: 'fond',
      tags: ['avant semis', 'implantation', 'semis', 'fond', 'fumure de fond', 'aout', 'printemps'],
      needs: [
        nd('pH', 1, "Le pH eau doit dépasser 6 pour l'installation du rhizobium. Chauler idéalement l'année précédant l'implantation : la correction est progressive.", { src: 'Arvalis', up: ['acide'] }),
        nd('P', 2, 'Exigence forte (COMIFER).', { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER) ; les exportations par les coupes sont élevées.', { src: 'COMIFER' }),
        nd('S', 1, 'Besoins en soufre importants pour une légumineuse fourragère.'),
        nd('B', 1, 'Sensible au bore en sol sableux ou calcaire.', { up: ['calcaire'] }),
        nd('N', 0, "Légumineuse : pas d'azote."),
      ] },
    { id: 'enplace', name: "Luzerne en place (sortie d'hiver, entre coupes)", phase: 'veg',
      tags: ['sortie hiver', 'sortie d hiver', 'entre coupes', 'apres coupe', 'apres fauche', 'coupe', 'en place', 'entretien'],
      needs: [
        nd('K', 1, 'Entretien des exportations, fortes en potasse, sur luzerne en place.'),
        nd('P', 1, "Entretien selon l'analyse de terre."),
        nd('S', 1, 'Soufre utile en sol filtrant.', { up: ['superficiel'] }),
        nd('B', 1, 'Bore si sol calcaire ou sableux.', { up: ['calcaire'] }),
        nd('N', 0, "Légumineuse : pas d'azote."),
      ] },
  ] },
  { id: 'prairie', name: 'Prairie (graminées)', syn: ['prairie', 'prairies', 'herbe', 'ray-grass', 'ray grass', 'raygrass', 'paturage', 'pature', 'paturages', 'prairie temporaire', 'prairie permanente'],
    perennial: true, exP: 'moyenne', exK: 'moyenne', acid: 'faible', pHTarget: 6, stages: [
    { id: 'sortie', name: "Sortie d'hiver (T200)", phase: 'veg',
      tags: ['sortie hiver', 'sortie d hiver', 't200', 'fevrier', 'mars', 'printemps', '1er apport', 'premier apport', 'reprise'],
      needs: [
        nd('N', 2, 'Premier apport quand la somme des températures depuis le 1er janvier atteint 200 °C·jours (repère T200).'),
        nd('P', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER), exportations élevées en fauche.', { src: 'COMIFER' }),
        nd('Mg', 1, "Pâtures : prévention de la tétanie d'herbage avec du magnésium (et du sodium)."),
        nd('S', 1, 'Prairies fauchées intensives en sol filtrant : le soufre peut devenir limitant.', { up: ['superficiel'] }),
      ],
      prefer: { kainite: [6, "Magnésium et sodium : prévention de la tétanie d'herbage."], lisierbov: [5, "Lisier aux pendillards en sortie d'hiver, bien valorisé par l'herbe."] } },
    { id: 'cycles', name: 'Entre deux cycles (après fauche ou pâture)', phase: 'veg',
      tags: ['apres fauche', 'apres coupe', 'apres paturage', 'entre cycles', 'entre deux cycles', 'repousse', 'ensilage', 'foin', 'juin'],
      needs: [
        nd('N', 2, 'Apport après chaque exploitation, selon le rythme de fauche ou de pâture.'),
        nd('K', 1, 'Fauches répétées : exportations de potasse élevées.'),
      ],
      prefer: { lisierbov: [6, 'Après fauche, aux pendillards : bonne valorisation.'], digestat: [5, 'Après fauche, aux pendillards : bonne valorisation.'] } },
    { id: 'automne', name: 'Automne – entretien', phase: 'fond',
      tags: ['automne', 'hiver', 'entretien', 'octobre', 'novembre'],
      needs: [
        nd('MO', 1, "Fumier ou compost à l'automne ou en fin d'hiver."),
        nd('pH', 1, "Chaulage d'entretien des prairies, possible en surface.", { up: ['acide'] }),
        nd('P', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('K', 1, 'Exigence moyenne (COMIFER).', { src: 'COMIFER' }),
        nd('N', 0, "Pas d'azote minéral à l'automne : risque de lessivage."),
      ] },
  ] },
];
const CBYID = Object.fromEntries(CROPS.map(c => [c.id, c]));

/* ---------- Symptômes et pistes de carence ---------- */
const SYMPTOMS = {
  jaune: { els: ['N', 'S'], text: 'Jaunissement général : piste azote si les vieilles feuilles jaunissent en premier, piste soufre si ce sont les jeunes feuilles.' },
  internerv: { els: ['Mg', 'Mn'], text: 'Jaunissement entre les nervures : sur vieilles feuilles, piste magnésium ; sur jeunes feuilles, piste manganèse (fréquent en sol calcaire ou soufflé).' },
  violet: { els: ['P'], text: 'Teinte violacée sur jeunes plantes, souvent en sol froid : piste phosphore, parfois passagère au printemps.' },
  bords: { els: ['K'], text: 'Dessèchement du bord des vieilles feuilles : piste potassium.' },
  bore: { els: ['B'], text: "Pourriture du cœur, tige creuse ou cassée sous le capitule : piste bore. Sur tournesol, il n'existe pas de correction une fois les symptômes visibles." },
  cuillere: { els: ['pH'], text: 'Feuilles en cuillère (tournesol) : piste molybdène, liée à un sol acide ; vérifier le pH.' },
};
