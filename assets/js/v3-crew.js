/* V3 (teste em /v3/): acende os vidros da janela "Who's behind your project" um por vez.
   Cada vidro acende quando chega a 72% da tela; se vários chegam juntos (a linha de cima no desktop),
   entram em fila, um depois do outro ("um ofício por vez"). Voltando a rolagem, apagam.
   Sem GSAP/ScrollTrigger ou com movimento reduzido, não faz nada (os 4 ficam acesos pelo CSS). */
(function () {
  'use strict';
  var GAP_MS = 320;

  document.addEventListener('DOMContentLoaded', function () {
    // o menu compartilhado ainda diz "Our family"; na V3 a seção é "The company"
    document.querySelectorAll('a[href="/#family"]').forEach(function (a) {
      var num = a.querySelector('span');
      a.textContent = 'The company';
      if (num) a.prepend(num);
    });

    var win = document.querySelector('[data-crew]');
    var sec = win && win.closest('section');
    if (!win || !window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    sec.classList.add('crew--anim');

    var panes = Array.prototype.slice.call(win.children);
    var queue = [];
    var busy = false;
    var next = function () {
      var p = queue.shift();
      if (!p) { busy = false; return; }
      busy = true;
      p.classList.add('is-lit');
      setTimeout(next, GAP_MS);
    };
    var light = function (p) {
      if (p.classList.contains('is-lit') || queue.indexOf(p) > -1) return;
      queue.push(p);
      queue.sort(function (a, b) { return panes.indexOf(a) - panes.indexOf(b); });
      if (!busy) next();
    };
    var dim = function (p) {
      var i = queue.indexOf(p);
      if (i > -1) queue.splice(i, 1);
      p.classList.remove('is-lit');
    };

    panes.forEach(function (p) {
      ScrollTrigger.create({
        trigger: p,
        start: 'top 72%',
        onEnter: function () { light(p); },
        onLeaveBack: function () { dim(p); }
      });
    });
  });
})();
