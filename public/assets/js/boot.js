/* Charge le moteur publicodes, les données produits et les règles, puis les scripts du référentiel, du moteur et de l'interface, dans cet ordre. */
(function () {
  'use strict';
  var base = document.currentScript.src.replace(/assets\/js\/boot\.js(\?.*)?$/, '');
  var scripts = ['assets/js/rules.js', 'assets/js/engine.js', 'assets/js/ui.js'];

  function fail(msg) {
    var r = document.getElementById('results');
    if (r) r.innerHTML = '<div class="banner stop"><span>' + msg + '</span></div>';
  }
  function getJSON(path) {
    return fetch(base + path, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error(path + ' : HTTP ' + res.status);
      return res.json();
    });
  }

  Promise.all([
    getJSON('data/products.json'),
    getJSON('data/regles.json'),
    import(base + 'assets/vendor/publicodes.js'),
  ])
    .then(function (loaded) {
      window.PRODUCTS = loaded[0];
      window.RULES = loaded[1];
      window.PublicodesEngine = loaded[2].default;
      scripts.forEach(function (src) {
        var s = document.createElement('script');
        s.src = base + src;
        s.async = false;
        s.onerror = function () {
          fail('Un fichier du site n’a pas pu être chargé (' + src + '). Rechargez la page.');
        };
        document.body.appendChild(s);
      });
    })
    .catch(function (e) {
      fail(
        location.protocol === 'file:'
          ? 'Ce site doit être servi par un serveur web. Depuis le dossier du projet : <code>npm run dev</code> ou <code>python3 -m http.server -d public 8080</code>.'
          : 'Impossible de charger les données ou les règles (' + e.message + '). Rechargez la page.',
      );
    });
})();
