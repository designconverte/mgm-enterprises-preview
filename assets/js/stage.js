/* Hero stage: the drawing becomes the room.
   1 the plan draws itself (lines traced from the photo, in the photo's own pixel space)
   2 the selections land (samples cut from the same photo)
   3 each trade puts its part of the room in, in install order, the way that trade works:
     tile is set piece by piece (walls bottom-up, floors from the far wall), paint goes on in roller passes,
     cabinets are lifted into place, counters are lowered on, balusters go in one at a time, deck boards run out.
   Canvas 2D only. Animated pieces are drawn over a settled layer; a finished step is committed to it and leaves the
   loop, and requestAnimationFrame runs only while something moves. The final frame stays in the canvas (a canvas is
   never an LCP candidate). Public API: window.MGMStage.create(el) -> { play(key, opts), redraw() }. */
(function () {
  'use strict';

  var ROOMS = window.MGM_ROOMS || null;
  var script = document.currentScript;
  var BASE = script && script.src ? new URL('../img/rooms/', script.src).href : '/assets/img/rooms/';
  var VARIANTS = [800, 1280, 1920];
  var SETS = { bathroom: ['bathroom'], kitchen: ['kitchen'], both: ['bathroom', 'kitchen'], deck: ['deck'] };
  var KEY_OF = {
    'bathroom-remodel': 'bathroom', 'kitchen-remodel': 'kitchen', 'bathroom-kitchen-remodel': 'both', 'deck': 'deck',
    bathroom: 'bathroom', kitchen: 'kitchen', both: 'both'
  };
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ── easing ── */
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function outCubic(t) { t = clamp01(t); return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { t = clamp01(t); var c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function inOut(t) { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ── images: smallest variant that covers the pane at the current pixel ratio ── */
  var imgCache = {};
  function loadRoomImage(room, needW) {
    var w = VARIANTS[VARIANTS.length - 1];
    for (var i = 0; i < VARIANTS.length; i++) { if (VARIANTS[i] >= needW) { w = VARIANTS[i]; break; } }
    var best = null;
    VARIANTS.forEach(function (v) { if (v >= w && imgCache[room.img + v] && imgCache[room.img + v].ok) best = best || imgCache[room.img + v]; });
    if (best) return best.p;
    var key = room.img + w;
    if (!imgCache[key]) {
      var entry = { ok: false };
      entry.p = new Promise(function (resolve, reject) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          var done = function () { entry.ok = true; resolve(im); };
          if (im.decode) im.decode().then(done, done); else done();
        };
        im.onerror = function () { delete imgCache[key]; reject(new Error('room image failed: ' + key)); };
        im.src = BASE + room.img + '-' + w + '.webp';
      });
      imgCache[key] = entry;
    }
    return imgCache[key].p;
  }

  function polyPath(ctx, poly, g) {
    ctx.moveTo(g.ox + poly[0][0] * g.s, g.oy + poly[0][1] * g.s);
    for (var i = 1; i < poly.length; i++) ctx.lineTo(g.ox + poly[i][0] * g.s, g.oy + poly[i][1] * g.s);
    ctx.closePath();
  }

  function inside(x, y, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) c = !c;
    }
    return c;
  }
  function insideAny(x, y, polys) { for (var i = 0; i < polys.length; i++) if (inside(x, y, polys[i])) return true; return false; }
  function bbox(polys) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    polys.forEach(function (p) { p.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); });
    return b;
  }

  function create(el, options) {
    if (!ROOMS || !el) return null;
    options = options || {};
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canvas = el.querySelector('[data-stage-canvas]');
    var svg = el.querySelector('[data-stage-plan]');
    var picks = el.querySelector('[data-stage-picks]');
    var rail = el.querySelector('[data-stage-rail]');
    var nameEl = el.querySelector('[data-stage-name]');
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d');
    var settled = document.createElement('canvas');
    var sctx = settled.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var panes = [];
    var token = 0;
    var currentKey = null;
    var built = false;
    var raf = 0;
    var actors = [];

    function measure() {
      var r = el.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = settled.width = Math.round(W * dpr);
      canvas.height = settled.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      if (svg) svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    }

    /* pane geometry (css px) + cover transform for the photo */
    function layout(key) {
      var ids = SETS[key] || SETS.bathroom;
      var gap = ids.length > 1 ? 3 : 0;
      var pw = (W - gap * (ids.length - 1)) / ids.length;
      return ids.map(function (id, i) {
        var room = ROOMS[id];
        var x = i * (pw + gap);
        var s = Math.max(pw / room.w, H / room.h);
        var fx = room.focus ? room.focus[0] : 0.5, fy = room.focus ? room.focus[1] : 0.5;
        return { id: id, room: room, x: x, y: 0, w: pw, h: H, s: s, ox: x + (pw - room.w * s) * fx, oy: (H - room.h * s) * fy, img: null };
      });
    }

    /* the plan: one group per pane, one sub-group per step */
    function buildPlan() {
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var defs = document.createElementNS(SVGNS, 'defs');
      svg.appendChild(defs);
      var n = 0;
      panes.forEach(function (p, pi) {
        var clipId = 'stage-clip-' + pi;
        var cp = document.createElementNS(SVGNS, 'clipPath');
        cp.setAttribute('id', clipId);
        var cr = document.createElementNS(SVGNS, 'rect');
        cr.setAttribute('x', p.x); cr.setAttribute('y', 0); cr.setAttribute('width', p.w); cr.setAttribute('height', p.h);
        cp.appendChild(cr); defs.appendChild(cp);
        var outer = document.createElementNS(SVGNS, 'g');
        outer.setAttribute('clip-path', 'url(#' + clipId + ')');
        var g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('transform', 'translate(' + p.ox.toFixed(2) + ' ' + p.oy.toFixed(2) + ') scale(' + p.s.toFixed(5) + ')');
        p.room.steps.forEach(function (st, si) {
          var sg = document.createElementNS(SVGNS, 'g');
          sg.setAttribute('data-trade-step', si);
          var add = function (d) {
            var path = document.createElementNS(SVGNS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('pathLength', '1');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.style.setProperty('--d', (Math.min(n, 140) * 7) + 'ms');
            n++;
            sg.appendChild(path);
          };
          if (st.polys !== 'rest' && !st.merge) st.polys.forEach(function (poly) {
            add('M' + poly.map(function (q) { return q[0] + ' ' + q[1]; }).join('L') + 'Z');
          });
          (st.paths || []).forEach(add);
          (st.lines || []).forEach(function (l) { add('M' + l[0] + ' ' + l[1] + 'L' + l[2] + ' ' + l[3]); });
          g.appendChild(sg);
        });
        outer.appendChild(g);
        svg.appendChild(outer);
      });
    }

    function buildRail() {
      if (!rail) return;
      var steps = panes[0].room.steps;
      var names = [];
      steps.forEach(function (s) { if (names[names.length - 1] !== s.trade) names.push(s.trade); });
      rail.innerHTML = '';
      names.forEach(function (n) {
        var li = document.createElement('li');
        li.textContent = n;
        li.setAttribute('data-trade', n);
        rail.appendChild(li);
      });
    }
    function railAt(trade, done) {
      if (!rail) return;
      var reached = false;
      Array.prototype.forEach.call(rail.children, function (li) {
        var t = li.getAttribute('data-trade');
        if (done) { li.className = 'is-done'; return; }
        if (t === trade) { li.className = 'is-on'; reached = true; }
        else li.className = reached ? '' : 'is-done';
      });
    }

    function buildPicks() {
      if (!picks) return;
      picks.innerHTML = '';
      var per = panes.length > 1 ? 2 : 4;
      panes.forEach(function (p) {
        (p.room.samples || []).slice(0, per).forEach(function (r) {
          var c = document.createElement('canvas');
          c.className = 'stage__pick';
          c.width = c.height = 112;
          if (p.img) {
            var k = p.img.naturalWidth / p.room.w;
            var side = Math.min(r[2], r[3]);
            c.getContext('2d').drawImage(p.img, (r[0] + (r[2] - side) / 2) * k, (r[1] + (r[3] - side) / 2) * k, side * k, side * k, 0, 0, 112, 112);
          }
          picks.appendChild(c);
        });
      });
    }

    /* layer of one step: the photo where this trade puts something, nothing anywhere else */
    function layerFor(p, si) {
      var L = document.createElement('canvas');
      L.width = canvas.width; L.height = canvas.height;
      var c = L.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var steps = p.room.steps, st = steps[si];
      c.save();
      c.beginPath(); c.rect(p.x, p.y, p.w, p.h); c.clip();
      c.fillStyle = '#000';
      if (st.polys === 'rest') { c.fillRect(p.x, p.y, p.w, p.h); }
      else { c.beginPath(); st.polys.forEach(function (poly) { polyPath(c, poly, p); }); c.fill(); }
      c.globalCompositeOperation = 'destination-out';
      steps.forEach(function (o, oi) {
        if (oi === si || o.polys === 'rest') return;
        if (st.polys !== 'rest' && oi < si) return;
        c.beginPath(); o.polys.forEach(function (poly) { polyPath(c, poly, p); }); c.fill();
      });
      c.globalCompositeOperation = 'source-in';
      c.drawImage(p.img, p.ox, p.oy, p.room.w * p.s, p.room.h * p.s);
      c.restore();
      return L;
    }

    /* ── the loop ── */
    function frame(now) {
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(settled, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var live = false;
      actors = actors.filter(function (a) {
        var keep = a.draw(now);
        if (keep) live = true;
        return keep;
      });
      if (live) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function commit(L) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.drawImage(L, 0, 0);
    }
    function wait(ms, my) { return new Promise(function (res) { setTimeout(function () { res(my === token); }, ms); }); }

    /* one step = one actor; resolves when committed */
    function runStep(p, si, my) {
      var st = p.room.steps[si];
      var L = layerFor(p, si);
      var t0 = performance.now();
      var g = p;
      return new Promise(function (resolve) {
        var finish = function () { commit(L); resolve(); };
        var draw;
        var mode = st.mode;
        if (mode === 'tiles') {
          var b = bbox(st.polys);
          var th = st.tile, tw = st.tile * (st.ratio || 1);
          var cells = [];
          var rows = Math.ceil((b[3] - b[1]) / th);
          for (var r = 0; r < rows; r++) {
            var y = b[3] - (r + 1) * th;
            var off = st.bond && r % 2 ? -tw / 2 : 0;
            for (var x = b[0] + off; x < b[2]; x += tw) {
              var cx = x + tw / 2, cy = y + th / 2;
              if (!insideAny(cx, cy, st.polys) && !insideAny(x + 2, y + 2, st.polys) && !insideAny(x + tw - 2, y + th - 2, st.polys) &&
                  !insideAny(x + 2, y + th - 2, st.polys) && !insideAny(x + tw - 2, y + 2, st.polys)) continue;
              cells.push({ x: x, y: y, row: st.order === 'down' ? rows - 1 - r : r, col: (x - b[0]) / tw });
            }
          }
          var maxRow = 0; cells.forEach(function (c) { maxRow = Math.max(maxRow, c.row); });
          var D = 900, cd = 340;
          cells.forEach(function (c) { c.t = (c.row / Math.max(1, maxRow)) * (D - cd) * 0.82 + c.col * 9; });
          var gap = 1.2;
          draw = function (now) {
            var e = now - t0;
            var allDone = true;
            for (var i = 0; i < cells.length; i++) {
              var c = cells[i];
              var k = (e - c.t) / cd;
              if (k <= 0) { allDone = false; continue; }
              if (k < 1) allDone = false;
              var dx = g.ox + c.x * g.s, dy = g.oy + c.y * g.s, dw = tw * g.s, dh = th * g.s;
              var lift = (1 - outBack(k)) * -12;
              ctx.globalAlpha = clamp01(k * 2.5);
              ctx.drawImage(L, (dx + gap) * dpr, (dy + gap) * dpr, (dw - gap * 2) * dpr, (dh - gap * 2) * dpr, dx + gap, dy + gap + lift, dw - gap * 2, dh - gap * 2);
            }
            ctx.globalAlpha = 1;
            if (allDone && e > D) { finish(); return false; }
            return my === token;
          };
        } else if (mode === 'roller') {
          var passes = 6, D2 = 820, pd = 320;
          draw = function (now) {
            var e = now - t0;
            for (var i = 0; i < passes; i++) {
              var k = (e - i * (D2 - pd) / passes) / pd;
              if (k <= 0) continue;
              var x0 = g.x + (g.w / passes) * i, w0 = g.w / passes + 1;
              var reach = g.h * inOut(k) * 1.12;
              ctx.save();
              ctx.beginPath(); ctx.rect(x0, g.y, w0, Math.min(g.h, reach)); ctx.clip();
              ctx.drawImage(L, x0 * dpr, g.y * dpr, w0 * dpr, g.h * dpr, x0, g.y, w0, g.h);
              ctx.restore();
            }
            if (e > D2 + 40) { finish(); return false; }
            return my === token;
          };
        } else if (mode === 'set' || mode === 'lower' || mode === 'glow') {
          var n = st.polys.length, pdur = mode === 'glow' ? 480 : 420;
          var D3 = Math.max(pdur + 80, Math.min(820, n * 150 + pdur));
          var gapT = n > 1 ? (D3 - pdur) / (n - 1) : 0;
          draw = function (now) {
            var e = now - t0;
            for (var i = 0; i < n; i++) {
              var k = (e - i * gapT) / pdur;
              if (k <= 0) continue;
              var dy = mode === 'glow' ? 0 : (1 - outBack(k)) * (mode === 'lower' ? -14 : 16);
              ctx.save();
              ctx.translate(0, dy);
              ctx.beginPath(); polyPath(ctx, st.polys[i], g); ctx.clip();
              ctx.globalAlpha = clamp01(k * (mode === 'glow' ? 1.6 : 2.2));
              ctx.drawImage(L, 0, 0, L.width, L.height, 0, 0, L.width / dpr, L.height / dpr);
              if (mode === 'glow' && k < 1.4) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.55 * (1 - clamp01((k - 0.25) / 1.1));
                ctx.drawImage(L, 0, 0, L.width, L.height, 0, 0, L.width / dpr, L.height / dpr);
              }
              ctx.restore();
            }
            if (e > D3 + (mode === 'glow' ? 220 : 30)) { finish(); return false; }
            return my === token;
          };
        } else if (mode === 'boards') {
          var vp = st.vp, polys = st.polys, nb = st.boards || 20;
          var angs = [];
          polys.forEach(function (poly) { poly.forEach(function (q) { angs.push(Math.atan2(q[1] - vp[1], q[0] - vp[0])); }); });
          var a0 = Math.min.apply(null, angs), a1 = Math.max.apply(null, angs);
          var R = 4000, D4 = 950, bd = 380;
          var rmax = 0; polys.forEach(function (poly) { poly.forEach(function (q) { rmax = Math.max(rmax, Math.hypot(q[0] - vp[0], q[1] - vp[1])); }); });
          draw = function (now) {
            var e = now - t0;
            for (var i = 0; i < nb; i++) {
              var j = nb - 1 - i; /* from the house wall outward */
              var k = (e - i * (D4 - bd) / nb) / bd;
              if (k <= 0) continue;
              var aa = a0 + (a1 - a0) * j / nb, ab = a0 + (a1 - a0) * (j + 1) / nb;
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(g.ox + vp[0] * g.s, g.oy + vp[1] * g.s);
              ctx.lineTo(g.ox + (vp[0] + Math.cos(aa) * R) * g.s, g.oy + (vp[1] + Math.sin(aa) * R) * g.s);
              ctx.lineTo(g.ox + (vp[0] + Math.cos(ab) * R) * g.s, g.oy + (vp[1] + Math.sin(ab) * R) * g.s);
              ctx.closePath(); ctx.clip();
              ctx.beginPath(); ctx.arc(g.ox + vp[0] * g.s, g.oy + vp[1] * g.s, rmax * g.s * outCubic(k) + 2, 0, Math.PI * 2); ctx.clip();
              ctx.drawImage(L, 0, 0, L.width, L.height, 0, 0, L.width / dpr, L.height / dpr);
              ctx.restore();
            }
            if (e > D4 + 40) { finish(); return false; }
            return my === token;
          };
        } else if (mode === 'balusters') {
          var bb = bbox(st.polys), sw = st.step || 30;
          var strips = Math.ceil((bb[2] - bb[0]) / sw), D5 = 860, sd = 320;
          draw = function (now) {
            var e = now - t0;
            for (var i = 0; i < strips; i++) {
              var k = (e - i * (D5 - sd) / strips) / sd;
              if (k <= 0) continue;
              var x0 = g.ox + (bb[0] + i * sw) * g.s, w0 = sw * g.s + 0.6;
              ctx.save();
              ctx.beginPath(); ctx.rect(x0, g.y, w0, g.h); ctx.clip();
              ctx.globalAlpha = clamp01(k * 2.4);
              ctx.drawImage(L, 0, 0, L.width, L.height, 0, (1 - outBack(k)) * -18, L.width / dpr, L.height / dpr);
              ctx.restore();
            }
            ctx.globalAlpha = 1;
            if (e > D5 + 40) { finish(); return false; }
            return my === token;
          };
        } else { /* fade */
          draw = function (now) {
            var k = (now - t0) / 520;
            ctx.globalAlpha = clamp01(outCubic(k));
            ctx.drawImage(L, 0, 0, L.width, L.height, 0, 0, L.width / dpr, L.height / dpr);
            ctx.globalAlpha = 1;
            if (k >= 1) { finish(); return false; }
            return my === token;
          };
        }
        actors.push({ draw: function (now) { if (my !== token) { resolve(); return false; } return draw(now); } });
        kick();
      });
    }

    function stepGroup(pi, si) { return svg ? svg.querySelector('g[clip-path="url(#stage-clip-' + pi + ')"] g[data-trade-step="' + si + '"]') : null; }

    function drawInstant() {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, settled.width, settled.height);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      panes.forEach(function (p) {
        if (!p.img) return;
        sctx.save(); sctx.beginPath(); sctx.rect(p.x, p.y, p.w, p.h); sctx.clip();
        sctx.drawImage(p.img, p.ox, p.oy, p.room.w * p.s, p.room.h * p.s);
        sctx.restore();
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(settled, 0, 0);
    }

    function setState(s) {
      el.setAttribute('data-state', s);
    }

    function play(value, opts) {
      opts = opts || {};
      var key = KEY_OF[value] || value;
      if (!SETS[key]) return Promise.resolve();
      if (key === currentKey && !opts.force) return Promise.resolve();
      currentKey = key;
      var my = ++token;
      actors = [];
      built = false;
      el.classList.remove('is-built');
      measure();
      panes = layout(key);
      if (nameEl) nameEl.textContent = key === 'both' ? 'Bathroom + kitchen' : ROOMS[key].label;
      el.setAttribute('data-room', key);
      var instant = reduce || opts.instant;
      var loads = Promise.all(panes.map(function (p) {
        return loadRoomImage(p.room, Math.max(p.room.w * p.s * dpr, 1)).then(function (im) { p.img = im; });
      }));
      buildRail();
      if (instant) {
        return loads.then(function () {
          if (my !== token) return;
          buildPlan(); buildPicks();
          drawInstant();
          railAt(null, true);
          setState('built'); built = true; el.classList.add('is-built');
        }).catch(function () { setState('error'); });
      }
      /* clear: the old room fades back into the sheet, then the new plan draws */
      setState('clearing');
      return wait(opts.first ? 0 : 260, my).then(function (ok) {
        if (!ok) return;
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, settled.width, settled.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        buildPlan();
        if (picks) picks.innerHTML = '';
        railAt('', false);
        void el.offsetWidth;
        setState('plan');
        return Promise.all([loads, wait(950, my)]);
      }).then(function (r) {
        if (!r || !r[1] || my !== token) return;
        buildPicks();
        setState('selections');
        return wait(460, my);
      }).then(function (ok) {
        if (!ok || my !== token) return;
        setState('building');
        /* consecutive steps of the same trade run together (wall and floor tile go in as one trade) */
        var phasesOf = function (p) {
          var out = [];
          p.room.steps.forEach(function (st, si) {
            var last = out[out.length - 1];
            if (last && last.trade === st.trade) last.idx.push(si); else out.push({ trade: st.trade, idx: [si] });
          });
          return out;
        };
        var phases = panes.map(phasesOf);
        var maxPh = 0;
        phases.forEach(function (ph) { maxPh = Math.max(maxPh, ph.length); });
        var chain = Promise.resolve();
        for (var hi = 0; hi < maxPh; hi++) {
          (function (hi) {
            chain = chain.then(function () {
              if (my !== token) return;
              var ph0 = phases[0][Math.min(hi, phases[0].length - 1)];
              railAt(ph0.trade);
              var jobs = [];
              panes.forEach(function (p, pi) {
                var ph = phases[pi][hi];
                if (!ph) return;
                ph.idx.forEach(function (si) {
                  jobs.push(runStep(p, si, my).then(function () {
                    var sg = stepGroup(pi, si);
                    if (sg) sg.classList.add('is-in');
                  }));
                });
              });
              return Promise.all(jobs);
            });
          })(hi);
        }
        return chain;
      }).then(function () {
        if (my !== token) return;
        railAt(null, true);
        drawInstant(); /* the whole photo in one pass: no seams where two trades meet */
        setState('built'); built = true; el.classList.add('is-built');
        if (options.onBuilt) options.onBuilt(key);
      }).catch(function () {
        if (my !== token) return;
        setState('error');
      });
    }

    function redraw() {
      if (!currentKey) return;
      var key = currentKey;
      currentKey = null;
      return play(key, { instant: built || reduce, force: true });
    }

    /* the plan under the finished room, seen through a lens that follows a fine pointer */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
      el.addEventListener('pointermove', function (e) {
        if (!built) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px');
        el.classList.add('is-lens');
      });
      el.addEventListener('pointerleave', function () { el.classList.remove('is-lens'); });
    }

    return { play: play, redraw: redraw, key: function () { return currentKey; } };
  }

  window.MGMStage = { create: create, keyOf: function (v) { return KEY_OF[v] || null; } };
})();
