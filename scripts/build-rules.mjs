// Compile les règles publicodes de regles/*.publicodes vers public/data/regles.json
// et copie le moteur publicodes pour le navigateur dans public/assets/vendor/.
// Lancer : npm run build:rules
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import Engine from 'publicodes';

const root = new URL('../', import.meta.url);

/* Lit les fichiers dans l'ordre alphabétique, qui est aussi celui des cultures dans l'interface. */
export function loadRules(dir = new URL('regles/', root)) {
  const rules = {};
  for (const f of readdirSync(dir)
    .filter(f => f.endsWith('.publicodes'))
    .sort()) {
    const doc = parse(readFileSync(new URL(f, dir), 'utf8'), { merge: true }) || {};
    for (const [name, rule] of Object.entries(doc)) {
      if (name in rules) throw new Error(`${f} : règle « ${name} » déjà définie`);
      rules[name] = rule;
    }
  }
  // Les ancres YAML partagent les objets : on les duplique pour que chaque règle soit indépendante.
  return JSON.parse(JSON.stringify(rules));
}

/* Vérifie que toutes les règles se compilent et s'évaluent dans le contexte par défaut. */
export function checkRules(rules) {
  const engine = new Engine(rules);
  for (const name of Object.keys(engine.getParsedRules())) engine.evaluate(name);
  return engine;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rules = loadRules();
  checkRules(rules);
  writeFileSync(new URL('public/data/regles.json', root), JSON.stringify(rules));
  mkdirSync(new URL('public/assets/vendor/', root), { recursive: true });
  // Sans le lien vers la source map, qui n'est pas publiée.
  const lib = readFileSync(new URL('node_modules/publicodes/dist/index.js', root), 'utf8');
  writeFileSync(
    new URL('public/assets/vendor/publicodes.js', root),
    lib.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'),
  );
  console.log(`${Object.keys(rules).length} règles écrites dans public/data/regles.json`);
}
