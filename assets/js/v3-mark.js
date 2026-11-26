/* V3 (teste em /v3/), rodada 3: a câmera entra pela janela do logo (seção 7, "The company behind your project").
   A rolagem (0→1) dirige a cena presa na tela:
     0–.14   o símbolo do logo GRANDE + o título da seção
     .14–.64 a câmera avança para a janela; cada vidro acende com um papel (01–04) e mostra um pedaço do cômodo (vídeo)
     .64–.88 a câmera atravessa a janela: o vídeo vira a tela inteira
     .80–1   "Planned on paper. Built one trade at a time."
   Movimento reduzido ou sem GSAP: nada aqui (fica o layout estático do CSS). Economia de dados: a cena roda com o pôster, sem vídeo.
   Também troca o rótulo do menu compartilhado ("Our family" → "The company") só nesta página de teste. */
(function () {
  'use strict';
  var me = document.currentScript;
  /* a prévia mora numa subpasta (…github.io/<repo>/): o caminho vem do próprio script, nunca da raiz */
  var VIDEO = me && me.src ? new URL('../video/', me.src).href : '/assets/video/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var noVideo = reduce || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
  var ROLES = [0.14, 0.27, 0.40, 0.53];
  var PUSH = [0.10, 0.64], DIVE = [0.64, 0.88], END = 0.80;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(p, r) { return clamp((p - r[0]) / (r[1] - r[0])); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href="/#family"], a[href$="/#family"]').forEach(function (a) {
      var num = a.querySelector('span');
      a.textContent = 'The company';
      if (num) a.prepend(num);
    });

    var sec = document.querySelector('[data-mk]');
    if (!sec || reduce || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    sec.classList.add('mk--anim');

    var track = sec.querySelector('[data-mk-track]');
    var pin = track.firstElementChild;
    var art = sec.querySelector('[data-mk-art]');
    var win = sec.querySelector('[data-mk-win]');
    var video = sec.querySelector('[data-mk-video]');
    var panes = Array.prototype.slice.call(sec.querySelectorAll('[data-mk-pane]'));
    var steps = Array.prototype.slice.call(sec.querySelectorAll('[data-mk-step]'));
    var base = null, last = -1, lastStep = -1;

    /* vídeo: carrega quando a cena chega perto e toca só enquanto ela está na tela */
    if (!noVideo && video && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) {
          if (!video.getAttribute('src')) video.src = VIDEO + video.getAttribute('data-src');
          var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
        } else if (!video.paused) video.pause();
      }, { rootMargin: '200px 0px' }).observe(track);
    }

    function measure() {
      art.style.transform = 'none';
      var pr = pin.getBoundingClientRect(), ar = art.getBoundingClientRect(), r = win.getBoundingClientRect();
      var W = pr.width, H = pr.height, desk = W >= 1024;
      base = {
        W: W, H: H, w: r.width, desk: desk,
        cx: r.left + r.width / 2 - pr.left, cy: r.top + r.height / 2 - pr.top,
        /* para onde a janela vai enquanto os papéis passam */
        tx: desk ? r.left + r.width / 2 - pr.left : W / 2,
        ty: desk ? H * 0.5 : H * 0.3,
        tw: desk ? Math.min(H * 0.56, W * 0.36) : Math.min(W * 0.78, H * 0.4)
      };
      art.style.transformOrigin = (r.left + r.width / 2 - ar.left) + 'px ' + (r.top + r.height / 2 - ar.top) + 'px';
    }

    function update(p) {
      if (!base) return;
      var e1 = ease(seg(p, PUSH)), e2 = ease(seg(p, DIVE));
      var k = Math.pow(base.tw / base.w, e1) * (1 + 2.4 * e2);
      var cx = base.cx + (base.tx - base.cx) * e1, cy = base.cy + (base.ty - base.cy) * e1;
      art.style.transform = 'translate(' + (cx - base.cx).toFixed(2) + 'px,' + (cy - base.cy).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
      art.style.opacity = (1 - clamp(e2 * 3.5)).toFixed(3);
      art.style.setProperty('--roof', (1 - 0.86 * e1).toFixed(3));
      /* celular em pé: durante os papéis os vidros mostram o lado dos azulejos; na travessia a câmera volta para a janela da cozinha */
      if (!base.desk) video.style.objectPosition = (24 + 26 * e2).toFixed(1) + '% 50%';
      sec.style.setProperty('--e', clamp((p - 0.76) / 0.12).toFixed(3));

      var lit = 0;
      ROLES.forEach(function (t) { if (p >= t + 0.02) lit++; });
      /* o vídeo aparece só pelos vidros: recorte = a janela (e, na travessia, a tela inteira) */
      if (lit === 0) video.style.clipPath = 'inset(50%)';
      else {
        var s = base.w * k / 2, f = 1 - e2;
        video.style.clipPath = 'inset(' + [cy - s, base.W - cx - s, base.H - cy - s, cx - s].map(function (v) { return Math.max(0, v * f).toFixed(1) + 'px'; }).join(' ') + ')';
      }
      if (lit !== last) {
        panes.forEach(function (el, i) { el.classList.toggle('is-lit', i < lit); });
        last = lit;
      }

      var step = p >= END ? 5 : p >= DIVE[0] + 0.05 ? -1 : 0;
      if (step === 0) ROLES.forEach(function (t, i) { if (p >= t) step = i + 1; });
      if (step !== lastStep) {
        steps.forEach(function (el) { el.classList.toggle('is-on', +el.getAttribute('data-mk-step') === step); });
        lastStep = step;
      }
    }

    measure();
    var st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      onUpdate: function (self) { update(self.progress); },
      onRefresh: function (self) { measure(); update(self.progress); }
    });
    update(st.progress);
  });
})();
