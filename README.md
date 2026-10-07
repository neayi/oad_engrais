# Moteur de choix des engrais et amendements

Aide au choix d'un engrais ou d'un amendement selon la culture, le stade, le sol, la météo et les contraintes de l'exploitation. Repères issus du COMIFER, d'Arvalis, de Terres Inovia et de l'ITB.

Le site est **entièrement statique** : HTML, CSS et JavaScript sans framework, sans serveur applicatif ni base de données. Tout le calcul se fait dans le navigateur. Le site pèse environ 300 Ko. Seule étape de build : la compilation de la feuille de style SCSS.

## Structure

```
public/                    ← dossier à publier, tel quel
  index.html
  favicon.svg
  _headers                 en-têtes HTTP pour Netlify et Cloudflare Pages
  data/products.json       les 59 produits : teneurs, synonymes, attributs agronomiques
  assets/js/boot.js        charge les données puis les scripts dans l'ordre
  assets/js/rules.js       règles agronomiques : cultures × stades, besoins, symptômes
  assets/js/engine.js      compréhension de la requête, filtrage, classement
  assets/js/ui.js          interface
  assets/css/              déclarations de polices et style.css (généré, non versionné)
  assets/fonts/            polices hébergées en local (licence OFL incluse)
scss/style.scss            source des styles, compilée vers public/assets/css/style.css
tests/engine.test.mjs      tests du moteur (Node, sans dépendance)
nginx/default.conf         configuration nginx (sécurité, cache, compression)
Dockerfile                 image nginx non root
netlify.toml               configuration Netlify
.github/workflows/         tests puis publication sur GitHub Pages
```

## En local

Le site doit être servi en HTTP (le chargement de `products.json` échoue en `file://`).

```bash
npm install                          # une fois : installe Sass
npm run dev                          # compile le CSS puis sert sur http://localhost:8080
npm run watch:css                    # dans un second terminal : recompile à chaque modification
```

Les styles se modifient dans `scss/style.scss`, jamais dans `public/assets/css/style.css` qui est régénéré par `npm run build:css`.

## Tests

```bash
npm test        # Node 20 ou plus
```

Ils vérifient l'intégrité des données (identifiants uniques, éléments et matériels connus, produits cités dans les règles existants) et des comportements agronomiques clés : soufre sous forme sulfate en tête sur colza à la reprise, pas d'azote sur légumineuse, exclusion des engrais de synthèse en bio, du phosphate naturel en sol calcaire, etc. À lancer après chaque modification de `products.json` ou de `rules.js`.

## Déployer

Toutes les options publient le dossier `public/`, après `npm ci && npm run build:css` pour générer la feuille de style.

### Netlify

- Lancer `npm run build:css`, puis glisser-déposer le dossier `public/` sur app.netlify.com/drop, ou
- `npx netlify-cli deploy --dir=public --prod`, ou
- connecter le dépôt Git : `netlify.toml` indique déjà la commande de build et le dossier à publier.

Les en-têtes de `public/_headers` sont appliqués automatiquement.

### Cloudflare Pages

```bash
npm run build:css
npx wrangler pages deploy public --project-name moteur-engrais
```

Ou connecter le dépôt dans le tableau de bord, commande de build `npm run build:css`, dossier de sortie `public`. `_headers` est pris en compte.

### GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` lance les tests, compile le CSS puis publie `public/` à chaque push sur `main`. Activer dans *Settings > Pages > Source : GitHub Actions*. GitHub Pages ne permet pas de définir d'en-têtes HTTP : pas de CSP sur cette option.

### Serveur ou VPS avec Docker

```bash
docker build -t moteur-engrais .
docker run -d --name moteur-engrais -p 8080:8080 --restart unless-stopped moteur-engrais
```

Placer ensuite un reverse proxy TLS devant (Caddy, Traefik, nginx). Le CSS est compilé dans une première étape de l'image. L'image finale écoute sur 8080 et tourne sans root.

### Serveur web existant

Lancer `npm run build:css`, puis copier le contenu de `public/` dans un dossier servi par nginx ou Apache. Le site fonctionne aussi dans un sous-dossier (`https://exemple.fr/moteur/`). Pour nginx, reprendre les directives de `nginx/default.conf` ; pour Apache, transposer les en-têtes de `public/_headers` dans un `.htaccess`.

### Intégrer à un site existant en iframe

```html
<iframe src="https://moteur.exemple.fr/" title="Moteur de choix des engrais" style="width:100%;height:1200px;border:0"></iframe>
```

Ajouter le domaine du site hôte à `frame-ancestors` dans `public/_headers` ou `nginx/default.conf`, sinon le navigateur bloque l'affichage.

## Faire évoluer les données et les règles

### Ajouter ou corriger un produit : `public/data/products.json`

| Champ | Rôle |
|---|---|
| `id` | identifiant unique, utilisé par les règles (`prefer`) |
| `name`, `cat`, `syn`, `etr`, `formule`, `forme`, `ph`, `rem`, `autres`, `abTxt` | textes affichés sur la fiche |
| `aliases` | termes reconnus dans la recherche, **en minuscules, sans accents, apostrophes remplacées par des espaces** (`sulfate d ammo`) |
| `c` | teneurs en % du produit brut : `N`, `P2O5`, `K2O`, `SO3`, `MgO`, `CaO`, `VN`, `B`, `Mn`, `Zn` |
| `prov` | besoins couverts : `1` en partie, `2` source principale. Clés : `N`, `P`, `K`, `S`, `Mg`, `pH`, `MO`, `B`, `Mn`, `Zn` |
| `speed` | vitesse d'action : 1 lente, 2 moyenne, 3 rapide |
| `equip` | matériels possibles (clés de `EQUIP` dans `rules.js`) |
| `volat` | sensibilité à la volatilisation ammoniacale, de 0 à 3 |
| `cost` | coût relatif par unité fertilisante : 1 bas, 2 moyen, 3 élevé |
| `ab` | `oui`, `non` ou `cond` (sous conditions) |
| `acid` | effet sur le pH, de -3 (très acidifiant) à +1 |
| `pav` | phosphore `soluble` (eau) ou `acide` (solubilisé seulement en sol acide) |
| `ntype` | classe directive nitrates : `I`, `II` ou `III` |
| `own` | effluent de ferme correspondant (clés de `OWN`), pour le bonus « disponible sur l'exploitation » |
| `organic`, `liquid`, `foliar`, `foliarOnly`, `cl`, `na`, `nh4` | drapeaux booléens utilisés par les règles d'exclusion et de classement |

### Ajouter une culture ou ajuster un repère : `public/assets/js/rules.js`

Chaque culture a ses stades ; chaque stade liste ses besoins avec un niveau (2 prioritaire, 1 selon situation, 0 inutile), une note affichée, la source, les conditions qui le rendent prioritaire et un repère de dose. L'en-tête du fichier détaille les options. Les synonymes de culture (`syn`) et les mots-clés de stade (`tags`) sont aussi des termes de recherche, au même format normalisé que les `aliases`.

## Confidentialité

- Aucune requête vers un tiers : pas de CDN, pas de Google Fonts, pas de mesure d'audience.
- Aucun cookie. Le profil de l'exploitation (sol, matériel, effluents, mode bio, priorité) est mémorisé dans le `localStorage` du navigateur, sous la clé `moteur-engrais-profil-v1`, et ne quitte jamais l'appareil. Il s'agit a priori d'une préférence d'interface exemptée de consentement au sens de la CNIL ; à confirmer avec le DPO si une mesure d'audience est ajoutée par la suite.

## Avant une diffusion publique

- Faire relire les règles par stade par un agronome : ce sont des synthèses nationales, à adapter aux références régionales.
- Ajouter des mentions légales (obligatoires pour un site public en France) et une date de mise à jour des références.
- Les compositions sont des valeurs typiques : l'étiquette ou l'analyse du lot font foi.
