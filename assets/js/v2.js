/* MGM Enterprises · home V2 (test page /v2/).
   1) Header and menu anchors stay on this page (the shared partials point to /#…).
   2) Mobile (< 1024 px): "What we remodel" pins and the sheets slide sideways with the vertical scroll. */
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="/#"]'), function (a) {
    a.setAttribute('href', a.getAttribute('href').slice(1));
  });

  document.addEventListener('DOMContentLoaded', function () {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var sec = document.querySelector('[data-section="services"]');
    var row = sec && sec.querySelector('[data-sheets]');
    if (!gsap || !ST || !row) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ST);

    var sheets = row.children.length;
    var prog = document.createElement('div');
    prog.className = 'svc__progress';
    prog.setAttribute('aria-hidden', 'true');
    prog.innerHTML = '<span data-svc-count>1 / ' + sheets + '</span><span class="svc__bar"><i></i></span>';
    row.insertAdjacentElement('afterend', prog);
    var bar = prog.querySelector('i');
    var count = prog.querySelector('[data-svc-count]');

    gsap.matchMedia().add('(max-width: 1023px)', function () {
        sec.classList.add('is-pinned');
        var distance = function () {
          var wrap = row.parentElement;
          var cs = getComputedStyle(wrap);
          var inner = wrap.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
          return Math.max(0, row.scrollWidth - inner);
        };
        var tween = gsap.to(row, {
          x: function () { return -distance(); },
          ease: 'none',
          scrollTrigger: {
            trigger: sec,
            start: 'top top',
            end: function () { return '+=' + Math.round(distance() * 1.15); },
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            refreshPriority: 1,
            onUpdate: function (self) {
              bar.style.transform = 'scaleX(' + self.progress.toFixed(3) + ')';
              count.textContent = Math.min(sheets, 1 + Math.round(self.progress * (sheets - 1))) + ' / ' + sheets;
            }
          }
        });
        return function () {
          sec.classList.remove('is-pinned');
          tween.scrollTrigger && tween.scrollTrigger.kill();
          tween.kill();
          gsap.set(row, { clearProps: 'transform' });
        };
    });
    ST.sort();
    ST.refresh();
  });
})();
