/* MGM Enterprises · home: page motion and UI.
   Everything is visible in the HTML first; motion starts from that final state (gsap.from with clearProps).
   GSAP, ScrollTrigger, Lenis and the stage are optional: without them the page still works and shows everything. */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = hasGsap && typeof window.ScrollTrigger !== 'undefined';
  var gsap = window.gsap;
  if (hasST) gsap.registerPlugin(window.ScrollTrigger);
  var script = document.currentScript;
  var assetUrl = function (rel) { return script && script.src ? new URL(rel, script.src).href : rel; };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var isDesktop = function () { return window.innerWidth >= 1024; };

  /* ── smooth scroll: fine pointer, desktop, no reduced motion; loaded after the page ── */
  var lenis = null;
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function scrollToEl(el, offset) {
    if (!el) return;
    scrollToY(Math.max(0, el.getBoundingClientRect().top + window.scrollY + (offset === undefined ? -90 : offset)));
  }
  window.addEventListener('load', function () {
    if (reduce || !finePointer || !isDesktop() || navigator.webdriver) return;
    var s = document.createElement('script');
    s.src = assetUrl('../vendor/lenis.min.js');
    s.onload = function () {
      if (typeof window.Lenis === 'undefined') return;
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
      doc.classList.add('has-lenis');
      if (hasST) {
        lenis.on('scroll', window.ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    };
    document.head.appendChild(s);
  });

  /* ── header: transparent over the dark hero, Polar after it; hides on fast scroll down ── */
  var hdr = $('[data-hdr]');
  var hero = $('[data-hero]');
  var lastY = window.scrollY;
  function onScrollHeader() {
    if (!hdr) return;
    var y = window.scrollY;
    var limit = hero ? Math.max(60, hero.offsetHeight - 80) : -1;
    if (hero && !isDesktop()) {
      var st = $('.hero__stage', hero);
      if (st) limit = Math.max(40, st.getBoundingClientRect().top + y - 64);
    }
    hdr.classList.toggle('is-solid', y > limit);
    hdr.classList.toggle('is-over', y > 24 && y <= limit);
    var menuOpen = doc.classList.contains('menu-open');
    if (!menuOpen && y > 900 && y > lastY + 4) hdr.classList.add('is-hidden');
    if (y < lastY - 4 || y < 900) hdr.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ── 1 · the stage: the step-1 answer plays its room ── */
  var heroForm = $('#quote-hero');
  var stageEl = $('[data-stage]');
  var stage = window.MGMStage && stageEl ? window.MGMStage.create(stageEl) : null;
  if (stage) {
    var startStage = function () {
      var picked = heroForm && heroForm.querySelector('[name="service"]:checked');
      stage.play(picked ? picked.value : 'bathroom', { first: true });
    };
    if (reduce) startStage(); else requestAnimationFrame(function () { requestAnimationFrame(startStage); });
    var lastW = window.innerWidth, rz;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 2) return; /* phone URL bar: height-only resizes */
      lastW = window.innerWidth;
      clearTimeout(rz);
      rz = setTimeout(function () { stage.redraw(); }, 180);
    });
  }

  /* ── reveals ── */
  if (hasST && !reduce) {
    $$('[data-reveal]').forEach(function (group) {
      gsap.from(group.children, { y: 28, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: group, start: 'top 86%', once: true } });
    });
  }

  function onceVisible(el, fn, margin, skipIfVisibleAtLoad) {
    if (!el) return;
    if (reduce || !('IntersectionObserver' in window)) { fn(true); return; }
    var first = true;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          io.disconnect();
          fn(first && skipIfVisibleAtLoad);
        }
      });
      first = false;
    }, { rootMargin: margin || '0px 0px -18% 0px' });
    io.observe(el);
  }

  /* ── 2 · the title block stamps its facts (only when it scrolls in, never as a blink at load) ── */
  var tb = $('[data-tblock]');
  onceVisible(tb, function (atLoad) { if (!atLoad && !reduce) tb.classList.add('is-stamp'); }, '0px 0px -10% 0px', true);

  /* ── 3 · the estimate opens in two layers: materials and labor ── */
  var est = $('[data-est]');
  if (est) {
    if (hasST && !reduce) {
      window.ScrollTrigger.create({ trigger: est, start: 'top 72%', end: 'bottom 20%', onEnter: function () { est.classList.remove('is-shut'); }, onLeaveBack: function () { est.classList.add('is-shut'); } });
    } else est.classList.remove('is-shut');
  }

  /* ── 4 · method: the scene builds while the steps scroll ── */
  var scene = $('[data-scene]');
  var steps = $$('[data-step]');
  var stepsBox = $('[data-steps]');
  if (scene && steps.length && hasST && !reduce) {
    var sn = $('[data-scene-n]'), stt = $('[data-scene-t]');
    stepsBox.classList.add('is-live');
    var setStep = function (n) {
      n = Math.max(1, n);
      scene.setAttribute('data-s', String(n));
      steps.forEach(function (s, i) { s.classList.toggle('is-on', i === n - 1); });
      if (sn) sn.textContent = '0' + n;
      if (stt) stt.textContent = steps[n - 1].getAttribute('data-t');
    };
    setStep(1);
    steps.forEach(function (s, i) {
      window.ScrollTrigger.create({ trigger: s, start: function () { return isDesktop() ? 'top 58%' : 'top 62%'; }, onEnter: function () { setStep(i + 1); }, onLeaveBack: function () { setStep(i); } });
    });
  }

  /* ── 6 · the schedule slides out from behind the postcard ── */
  if (hasST && !reduce) {
    var sched = $('.post__sched');
    if (sched) gsap.from(sched, { x: -60, y: -30, rotate: -4, opacity: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '[data-post]', start: 'top 70%', once: true } });
    var card = $('.post__card');
    if (card) gsap.from(card, { rotate: -7, y: 40, duration: 1.2, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: '[data-post]', start: 'top 85%', once: true } });
  }

  /* ── 8 · the map: coastline draws, towns land in a wave from Hyannis; the ZIP lights its town ── */
  var mapBox = $('[data-map]');
  var zipTable = null;
  function loadZips() {
    if (zipTable) return Promise.resolve(zipTable);
    return fetch(assetUrl('area-zips.json')).then(function (r) { return r.json(); }).then(function (j) { zipTable = j.zips || {}; return zipTable; });
  }
  if (mapBox) {
    var inlineMap = function () {
      var img = $('img', mapBox);
      if (!img || !window.fetch) return Promise.resolve();
      return fetch(img.currentSrc || img.src).then(function (r) { return r.text(); }).then(function (txt) {
        var tmp = document.createElement('div');
        tmp.innerHTML = txt;
        var svg = tmp.querySelector('svg');
        if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); mapBox.replaceChild(svg, img); }
      }).catch(function () {});
    };
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) {
          mio.disconnect();
          inlineMap().then(function () { onceVisible(mapBox, function () { mapBox.classList.add('is-on'); }, '0px 0px -20% 0px'); });
        }
      }, { rootMargin: '500px 0px' });
      mio.observe(mapBox);
    }
  }
  var zc = $('[data-zipcheck]');
  if (zc) {
    var zin = $('input', zc), zout = $('[data-zipcheck-out]', zc);
    var mark = function (zip) {
      var svg = mapBox && $('svg', mapBox);
      if (svg) {
        $$('.ping', svg).forEach(function (p) { p.remove(); });
        $$('.t.is-hit', svg).forEach(function (t) { t.classList.remove('is-hit'); });
      }
      if (!/^\d{5}$/.test(zip)) { zout.textContent = ''; zout.className = 'zipcheck__out'; return; }
      loadZips().then(function (tab) {
        var hit = tab[zip];
        if (hit) {
          zout.className = 'zipcheck__out';
          zout.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check"></use></svg>';
          zout.appendChild(document.createTextNode('Yes, ' + hit[0] + ' is in our area.'));
          if (svg) {
            var town = svg.querySelector('.t[data-town="' + hit[1] + '"]');
            if (town) town.classList.add('is-hit');
            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('class', 'ping'); c.setAttribute('cx', hit[2]); c.setAttribute('cy', hit[3]); c.setAttribute('r', 14);
            svg.appendChild(c);
          }
        } else {
          zout.className = 'zipcheck__out is-far';
          zout.textContent = zip + " looks outside the towns we usually cover. You can still send your request. If it's too far for us, we'll say so.";
        }
      }).catch(function () {});
    };
    zin.addEventListener('input', function () { zin.value = zin.value.replace(/\D/g, '').slice(0, 5); mark(zin.value); });
    zc.addEventListener('submit', function (e) {
      e.preventDefault();
      goEstimate(null, /^\d{5}$/.test(zin.value) ? zin.value : null);
    });
  }

  /* ── open now? (Hyannis time, Mon–Fri 8 AM–4 PM) ── */
  (function () {
    var els = $$('[data-open-status]');
    if (!els.length || typeof Intl === 'undefined') return;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; };
      var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var d = days.indexOf(get('weekday')), t = (parseInt(get('hour'), 10) % 24) + parseInt(get('minute'), 10) / 60;
      var workday = function (day) { return day >= 1 && day <= 5; };
      var open = workday(d) && t >= 8 && t < 16;
      var text;
      if (open) text = 'Open now · until 4 PM in Hyannis';
      else {
        var nd = d, label = '';
        for (var k = 0; k < 8; k++) {
          if (workday(nd) && (k > 0 || t < 8)) { label = k === 0 ? 'today' : k === 1 ? 'tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nd]; break; }
          nd = (nd + 1) % 7;
        }
        text = 'Closed now · opens ' + label + ' at 8 AM';
      }
      els.forEach(function (el) {
        el.classList.toggle('is-open', open);
        var tx = $('[data-open-text]', el); if (tx) tx.textContent = text;
      });
    } catch (_e) { /* keeps the static hours */ }
  })();

  /* ── forms: step titles, step-2 answers, the request ticket, "details" in a fixed format ── */
  var NAMES = { 'bathroom-remodel': 'Bathroom remodel', 'kitchen-remodel': 'Kitchen remodel', 'bathroom-kitchen-remodel': 'Bathroom + kitchen', 'deck': 'Deck' };
  var HOME = { 'We live here': 'we live here', 'Rental or vacation home': 'rental or vacation home' };
  var TITLES = {
    'quote-hero': { 1: "What's your project?", 2: 'About the home', 3: 'How can Gabriel reach you?' },
    'quote-final': { 1: 'Start with your project and ZIP', 2: 'How can Gabriel reach you?' }
  };
  $$('form[data-cs-form]').forEach(function (form) {
    var id = form.getAttribute('data-cs-form');
    var now = $('[data-step-now]', form);
    var title = $('[data-step-title]', form);
    var stepEls = $$('[data-cs-step]', form);
    var details = $('[data-details]', form);
    var sumBox = $('[data-request-summary]', form);
    var sumText = $('[data-request-summary-text]', form);
    var val = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      if (!el) return '';
      if (el.tagName === 'SELECT' || el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'hidden') return el.value.trim();
      var c = form.querySelector('[name="' + name + '"]:checked');
      return c ? c.value : '';
    };
    function compose() {
      var parts = [];
      if (val('home')) parts.push('Home: ' + val('home'));
      if (val('start')) parts.push('Start: ' + val('start'));
      if (val('notes')) parts.push('Notes: ' + val('notes').replace(/\s+/g, ' '));
      if (details) details.value = parts.join(' | ').slice(0, 1000);
      if (sumBox && sumText) {
        var zip = (form.querySelector('[name="zip"]') || {}).value || '';
        var bits = [NAMES[val('service')] || '', HOME[val('home')] || '', val('start'), /^\d{5}$/.test(zip) ? 'ZIP ' + zip : ''].filter(Boolean);
        sumText.textContent = bits.join(' · ');
        sumBox.hidden = bits.length === 0;
      }
    }
    /* step 2 answers are required, but they are not module fields: checked here before the module moves on */
    function need(show) {
      var miss = [];
      $$('[data-need]', form).forEach(function (fs) {
        if (fs.closest('[data-cs-step]').hidden) return;
        var name = fs.getAttribute('data-need');
        var ok = !!form.querySelector('[name="' + name + '"]:checked');
        var err = $('[data-need-error="' + name + '"]', form);
        if (err && (show || ok)) err.hidden = ok;
        $$('input', fs).forEach(function (i) { if (show || ok) i.setAttribute('aria-invalid', ok ? 'false' : 'true'); });
        if (!ok) miss.push(fs);
      });
      return miss;
    }
    form.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-cs-next]');
      if (!btn) return;
      var miss = need(true);
      if (miss.length) {
        e.preventDefault(); e.stopImmediatePropagation();
        var first = $('input', miss[0]); if (first) first.focus();
      }
    }, true);
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || (e.target && e.target.tagName === 'TEXTAREA')) return;
      if (need(false).length) { need(true); e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    form.addEventListener('change', function (e) {
      if (e.target && (e.target.name === 'home' || e.target.name === 'start')) need(false);
      if (e.target && e.target.name === 'service' && form === heroForm && stage) stage.play(e.target.value);
      if (form === heroForm) syncFinal();
      compose();
    });
    form.addEventListener('input', function (e) {
      if (e.target && e.target.name === 'zip') {
        var echo = $('[data-zip-echo]', form);
        if (echo) echo.textContent = /^\d{5}$/.test(e.target.value) ? e.target.value : 'That ZIP';
        if (form === heroForm) syncFinal();
      }
      compose();
    });
    form.addEventListener('submit', compose, true);
    var edit = $('[data-edit-request]', form);
    if (edit) edit.addEventListener('click', function () {
      var guard = 4;
      var back = function () {
        var vis = stepEls.filter(function (s) { return !s.hidden; })[0];
        if (!vis || vis.getAttribute('data-cs-step') === '1' || !guard--) return;
        var b = $('[data-cs-back]', vis); if (b) { b.click(); setTimeout(back, 30); }
      };
      back();
    });
    var sync = function () {
      var visible = stepEls.filter(function (s) { return !s.hidden; })[0];
      if (!visible) return;
      var k = visible.getAttribute('data-cs-step');
      if (now && /^\d$/.test(k)) now.textContent = k;
      if (title && TITLES[id] && TITLES[id][k]) title.textContent = TITLES[id][k];
      form.classList.toggle('is-done', k === 'done');
      compose();
    };
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(sync);
      stepEls.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); });
    }
    compose();
  });

  /* the final sentence starts from what the visitor already answered up top (until they touch it) */
  var finalForm = $('#quote-final');
  var finalTouched = false;
  if (finalForm) {
    ['input', 'change'].forEach(function (ev) { finalForm.addEventListener(ev, function (e) { if (e.isTrusted) finalTouched = true; }); });
  }
  function syncFinal() {
    if (!finalForm || !heroForm || finalTouched) return;
    var s = heroForm.querySelector('[name="service"]:checked');
    var h = heroForm.querySelector('[name="home"]:checked');
    var z = heroForm.querySelector('[name="zip"]');
    var fs = finalForm.querySelector('[name="service"]'), fh = finalForm.querySelector('[name="home"]'), fz = finalForm.querySelector('[name="zip"]');
    if (s && fs) fs.value = s.value;
    if (h && fh) fh.value = h.value;
    if (z && fz && /^\d{5}$/.test(z.value)) fz.value = z.value;
    fitAll();
  }

  /* the sentence's dropdowns are as wide as the words they show */
  var fitCanvas = document.createElement('canvas').getContext('2d');
  function fitSelect(sel) {
    if (!sel || !sel.options[sel.selectedIndex]) return;
    var cs = getComputedStyle(sel);
    fitCanvas.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var w = fitCanvas.measureText(sel.options[sel.selectedIndex].text).width;
    sel.style.width = Math.ceil(w + parseFloat(cs.fontSize) * 1.25 + 4) + 'px';
  }
  function fitAll() { $$('select.lib__field').forEach(fitSelect); }
  $$('select.lib__field').forEach(function (sel) { sel.addEventListener('change', function () { fitSelect(sel); }); });
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  window.addEventListener('resize', fitAll);

  /* any service card or estimate CTA → the hero form; a service picked elsewhere plays in the stage */
  function goEstimate(svc, zip) {
    if (!heroForm) {
      var home = $('.hdr__logo');
      window.location.href = (home ? home.getAttribute('href') : '/') + '#estimate';
      return;
    }
    var onStep1 = !$('[data-cs-step="1"]', heroForm).hidden;
    var anchor = isDesktop() ? null : $('.hero__stage');
    var target = anchor ? Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - 76) : 0;
    scrollToY(target);
    var wait = reduce ? 0 : Math.min(1300, 300 + Math.abs(window.scrollY - target) / 4);
    setTimeout(function () {
      if (onStep1 && svc) {
        var radio = heroForm.querySelector('input[name="service"][value="' + svc + '"]');
        if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      var zipEl = $('input[name="zip"]', heroForm);
      if (onStep1 && zipEl && zip) { zipEl.value = zip; zipEl.dispatchEvent(new Event('input', { bubbles: true })); }
      if (onStep1) {
        var focusEl = zip ? heroForm.querySelector('input[name="service"]:checked') || heroForm.querySelector('input[name="service"]') : zipEl;
        if (focusEl) focusEl.focus({ preventScroll: true });
      }
    }, wait);
  }
  $$('[data-service]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goEstimate(a.getAttribute('data-service')); });
  });
  $$('[data-go-estimate]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.hasAttribute('data-menu-link')) return;
      e.preventDefault(); goEstimate(null);
    });
  });

  /* ── mobile bar: after the hero form, hidden while the final form is on screen ── */
  var mbar = $('[data-mbar]');
  var heroFormBox = $('[data-hero-form]');
  var finalBox = $('[data-final-form]');
  if (mbar && heroFormBox && 'IntersectionObserver' in window) {
    var pastHero = false, finalOn = false;
    var paint = function () { mbar.classList.toggle('is-on', pastHero && !finalOn); };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; });
      paint();
    }).observe(heroFormBox);
    if (finalBox) new IntersectionObserver(function (es) {
      es.forEach(function (e) { finalOn = e.isIntersecting; });
      paint();
    }, { threshold: 0.15 }).observe(finalBox);
  }

  /* ── mobile menu: focus trapped, Esc closes, focus returns to the button ── */
  var menu = $('[data-menu]');
  var toggle = $('[data-menu-toggle]');
  if (menu && toggle) {
    var main = $('#main'), footer = $('.ftr');
    var focusables = function () { return $$('a[href], button:not([disabled])', menu); };
    var isOpen = function () { return !menu.hidden; };
    var open = function () {
      menu.hidden = false; doc.classList.add('menu-open'); toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Close menu');
      [main, footer].forEach(function (el) { if (el) el.inert = true; });
      if (lenis) lenis.stop();
      var f = focusables(); if (f[0]) f[0].focus();
    };
    var close = function (back) {
      doc.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
      [main, footer].forEach(function (el) { if (el) el.inert = false; });
      if (lenis) lenis.start();
      menu.hidden = true;
      if (back !== false) toggle.focus();
    };
    toggle.addEventListener('click', function () { if (isOpen()) close(); else open(); });
    $$('[data-menu-close]', menu).forEach(function (b) { b.addEventListener('click', function () { close(); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close(); });
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables().concat([toggle]), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey && isOpen()) { e.preventDefault(); var f = focusables(); if (f[0]) f[0].focus(); }
    });
    $$('[data-menu-link]', menu).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
        close(false);
        if (a.hasAttribute('data-go-estimate')) { e.preventDefault(); goEstimate(null); return; }
        if (hash && $(hash)) { e.preventDefault(); scrollToEl($(hash)); }
      });
    });
  }

  /* in-page anchors go through Lenis when it is on */
  document.addEventListener('click', function (e) {
    if (!lenis) return;
    var a = e.target.closest && e.target.closest('a[href^="/#"], a[href^="#"]');
    if (!a || a.hasAttribute('data-service') || a.hasAttribute('data-go-estimate') || a.hasAttribute('data-menu-link')) return;
    var href = a.getAttribute('href'); var hash = href.slice(href.indexOf('#'));
    var t = hash.length > 1 ? $(hash) : null;
    if (t) { e.preventDefault(); scrollToEl(t, hash === '#main' ? -200 : -90); }
  });

  if (hasST) window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
})();
