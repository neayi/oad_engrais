/* Charge les données produits, puis les règles, le moteur et l'interface, dans cet ordre. */
(function () {
  'use strict';
  var base = document.currentScript.src.replace(/assets\/js\/boot\.js(\?.*)?$/, '');
  var scripts = ['assets/js/rules.js', 'assets/js/engine.js', 'assets/js/ui.js'];

  function fail(msg) {
    var r = document.getElementById('results');
    if (r) r.innerHTML = '<div class="banner stop"><span>' + msg + '</span></div>';
  }

  fetch(base + 'data/products.json', { credentials: 'same-origin' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      window.PRODUCTS = data;
      scripts.forEach(function (src) {
        var s = document.createElement('script');
        s.src = base + src;
        s.async = false;
        s.onerror = function () { fail('Un fichier du site n’a pas pu être chargé (' + src + '). Rechargez la page.'); };
        document.body.appendChild(s);
      });
    })
    .catch(function (e) {
      fail(location.protocol === 'file:'
        ? 'Ce site doit être servi par un serveur web. Depuis le dossier du projet : <code>npm run dev</code> ou <code>python3 -m http.server -d public 8080</code>.'
        : 'Impossible de charger les données des produits (' + e.message + '). Rechargez la page.');
    });
})();
