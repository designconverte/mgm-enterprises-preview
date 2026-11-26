/* Vídeos de inspiração (fotos de banco animadas; nunca legendar como obra da MGM Enterprises).
   1 palco do hero: o palco marca o cômodo (data-room) logo no começo do desenho, então o vídeo já baixa enquanto o desenho acontece;
     quando o cômodo fica pronto (.is-built) ele "ganha vida" na hora, do primeiro quadro (que é a própria foto).
     Com a lupa da planta (desktop) ou num cômodo novo, o vídeo sai e a foto do canvas volta.
   2 cards de serviço: o vídeo toca só enquanto o card está na tela.
   (o vídeo da seção 7, a câmera que entra pela janela do logo, fica em mark.js)
   Movimento reduzido ou economia de dados: nada de vídeo (fica a foto).
   Loops em vai-e-volta (sem corte), H.264 sem áudio: 1280 em tela larga, 854 no resto. */
(function () {
  'use strict';
  /* a prévia mora numa subpasta (…github.io/<repo>/): o caminho vem do próprio script, nunca da raiz do domínio */
  var me = document.currentScript;
  var BASE = me && me.src ? new URL('../video/', me.src).href : '/assets/video/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var noVideo = reduce || conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');

  function srcFor(name, cssW) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    return BASE + name + '-' + (cssW * dpr > 1000 ? 1280 : 854) + '.mp4';
  }
  function makeVideo(cls) {
    var v = document.createElement('video');
    v.className = cls || '';
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'none';
    return v;
  }
  function tryPlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  /* toca enquanto visível; carrega só na primeira vez que chega perto da tela */
  function whileVisible(target, v, getSrc, threshold) {
    if (!('IntersectionObserver' in window)) { v.src = getSrc(); tryPlay(v); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) v.src = getSrc();
          tryPlay(v);
        } else if (!v.paused) v.pause();
      });
    }, { threshold: threshold || 0, rootMargin: '120px 0px' }).observe(target);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (noVideo) return;
    var ROOMS = window.MGM_ROOMS || {};

    /* ── 2 · cards de serviço ── */
    var ROOM_OF = { 'bathroom-remodel': 'bathroom', 'kitchen-remodel': 'kitchen', deck: 'deck' };
    document.querySelectorAll('.sheet[data-service]').forEach(function (card) {
      var id = ROOM_OF[card.getAttribute('data-service')];
      var media = card.querySelector('.sheet__media');
      if (!id || !media) return;
      var v = makeVideo('sheet__vid');
      v.addEventListener('playing', function () { v.classList.add('is-on'); }, { once: true });
      media.insertBefore(v, media.querySelector('.sheet__tag'));
      whileVisible(media, v, function () { return srcFor('room-' + id, media.clientWidth); }, 0.35);
    });

    /* ── 1 · o cômodo ganha vida no palco do hero ── */
    var stage = document.querySelector('[data-stage]');
    if (!stage) return;
    var box = document.createElement('div');
    box.className = 'stage__vid';
    box.setAttribute('aria-hidden', 'true');
    var canvas = stage.querySelector('[data-stage-canvas]');
    stage.insertBefore(box, canvas ? canvas.nextSibling : stage.firstChild);
    var SETS = { bathroom: ['bathroom'], kitchen: ['kitchen'], deck: ['deck'], both: ['bathroom', 'kitchen'] };
    var preparedKey = null, shownKey = null, timer = 0, inView = true;
    var loaded = document.readyState === 'complete';

    function hide() {
      clearTimeout(timer);
      box.classList.remove('is-on');
      each(box.querySelectorAll('video'), function (v) { v.pause(); });
      shownKey = null;
    }
    /* baixa o vídeo do cômodo enquanto o desenho acontece (sem mostrar) */
    function prepare(key) {
      var ids = SETS[key];
      if (!ids || key === preparedKey) return;
      hide();
      preparedKey = key;
      box.innerHTML = '';
      var w = stage.clientWidth / ids.length;
      ids.forEach(function (id) {
        var v = makeVideo();
        var f = (ROOMS[id] && ROOMS[id].focus) || [0.5, 0.5];
        v.style.objectPosition = (f[0] * 100) + '% ' + (f[1] * 100) + '%';
        v.preload = 'auto';
        v.src = srcFor('room-' + id, w);
        box.appendChild(v);
        v.load();
      });
    }
    function show(key) {
      shownKey = key;
      var vids = box.querySelectorAll('video'), ready = 0;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (shownKey !== key) return;
        each(vids, function (v) {
          v.addEventListener('playing', function () {
            if (++ready === vids.length && shownKey === key) box.classList.add('is-on');
          }, { once: true });
          try { v.currentTime = 0; } catch (e) { /* ainda sem metadados */ }
          if (inView) tryPlay(v);
        });
      }, 120);
    }
    function sync() {
      var key = stage.getAttribute('data-room');
      if (!key) return;
      var built = stage.classList.contains('is-built');
      /* a página termina de carregar primeiro (o vídeo não disputa banda com o LCP); se o cômodo já está pronto, carrega já */
      if (key !== preparedKey && (loaded || built)) prepare(key);
      if (!built) { if (shownKey) hide(); return; }
      if (shownKey !== key && key === preparedKey) show(key);
    }
    new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ['class', 'data-room', 'data-state'] });
    if (!loaded) window.addEventListener('load', function () { loaded = true; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        each(box.querySelectorAll('video'), function (v) { if (inView && shownKey) tryPlay(v); else v.pause(); });
      }).observe(stage);
    }
    sync();
  });
})();
