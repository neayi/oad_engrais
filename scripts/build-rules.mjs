// Compile les règles publicodes : regles/*.publicodes vers public/data/regles.json,
// regles/produits/*.publicodes vers public/data/products.json, et copie le moteur
// publicodes pour le navigateur dans public/assets/vendor/.
// Lancer : npm run build:rules
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import Engine from 'publicodes';

const root = new URL('../', import.meta.url);

/* Lit les fichiers dans l'ordre alphabétique, qui est aussi celui des cultures et des produits dans l'interface. */
export function loadRules(dir = new URL('regles/', root)) {
  const rules = {};
  for (const f of readdirSync(dir)
    .filter(f => f.endsWith('.publicodes'))
    .sort()) {
    const doc = parse(readFileSync(new URL(f, dir), 'utf8')) || {};
    for (const [name, rule] of Object.entries(doc)) {
      if (name in rules) throw new Error(`${f} : règle « ${name} » déjà définie`);
      rules[name] = rule;
    }
  }
  return rules;
}

/* Attribut publicodes d'un produit -> champ de products.json, lu par le moteur et l'interface.
   text : texte, vide par défaut ; flag : oui / non -> booléen ; sinon valeur telle quelle. */
export const PRODUCT_FIELDS = [
  ['titre', 'name'],
  ['catégorie', 'cat'],
  ['autres noms', 'syn', 'text'],
  ['noms étrangers', 'etr', 'text'],
  ['formule chimique', 'formule', 'text'],
  ['teneurs', 'c'],
  ['autres éléments', 'autres', 'text'],
  ['forme', 'forme', 'text'],
  ['effet sur le pH', 'ph', 'text'],
  ['agriculture biologique', 'abTxt', 'text'],
  ['statut AB', 'ab'],
  ['à savoir', 'rem', 'text'],
  ['termes de recherche', 'aliases'],
  ['vitesse', 'speed'],
  ['matériel', 'equip'],
  ['volatilisation', 'volat'],
  ['coût', 'cost'],
  ['apports', 'prov'],
  ['classe nitrates', 'ntype'],
  ['effet acidifiant', 'acid'],
  ['ammoniacal', 'nh4', 'flag'],
  ['liquide', 'liquid', 'flag'],
  ['densité', 'density'],
  ['foliaire', 'foliar', 'flag'],
  ['foliaire seulement', 'foliarOnly', 'flag'],
  ['phosphore', 'pav'],
  ['chlore', 'cl', 'flag'],
  ['sodium', 'na', 'flag'],
  ['effluent de ferme', 'own'],
  ['organique', 'organic', 'flag'],
  ['références', 'refs'],
];

/* Règles `produit . <id>` -> liste de produits au format de products.json. */
export function productsFromRules(rules) {
  return Object.entries(rules)
    .filter(([name]) => /^produit \. [^.]+$/.test(name))
    .map(([name, r]) => {
      const p = { id: name.slice('produit . '.length) };
      for (const [attr, key, kind] of PRODUCT_FIELDS) {
        const v = r[attr];
        if (kind === 'text') p[key] = v ?? '';
        else if (v === undefined) continue;
        else if (kind === 'flag') p[key] = v === 'oui';
        else p[key] = v;
      }
      return p;
    });
}

export function loadProducts() {
  return productsFromRules(loadRules(new URL('regles/produits/', root)));
}

/* Vérifie que toutes les règles se compilent et s'évaluent dans le contexte par défaut. */
export function checkRules(rules) {
  const engine = new Engine(rules);
  for (const name of Object.keys(engine.getParsedRules())) engine.evaluate(name);
  return engine;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rules = loadRules();
  const productRules = loadRules(new URL('regles/produits/', root));
  checkRules({ ...rules, ...productRules });
  mkdirSync(new URL('public/data/', root), { recursive: true });
  writeFileSync(new URL('public/data/regles.json', root), JSON.stringify(rules));
  const products = productsFromRules(productRules);
  writeFileSync(new URL('public/data/products.json', root), JSON.stringify(products));
  mkdirSync(new URL('public/assets/vendor/', root), { recursive: true });
  // Sans le lien vers la source map, qui n'est pas publiée.
  const lib = readFileSync(new URL('node_modules/publicodes/dist/index.js', root), 'utf8');
  writeFileSync(
    new URL('public/assets/vendor/publicodes.js', root),
    lib.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
  );
  console.log(
    `${Object.keys(rules).length} règles écrites dans public/data/regles.json, ` +
      `${products.length} produits dans public/data/products.json`,
  );
}
