/*
 * Tim Beeston Cleaning — site behaviour (vanilla JS, no dependencies)
 * One small init function per feature, called once on DOMContentLoaded.
 */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav: mobile toggle, active-link highlight, smooth close ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.querySelector(".nav-menu");
    var backdrop = document.querySelector(".nav-backdrop");
    if (!toggle || !menu) return;

    // .nav-open on <body> drives the scroll lock and lifts #header above the
    // drawer — the drawer lives inside the header's stacking context, so it
    // cannot outrank the rest of the page chrome on its own.
    function closeMenu() {
      menu.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    function openMenu() {
      menu.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-open");
      document.body.classList.add("nav-open");
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.contains("is-open");
      if (isOpen) closeMenu(); else openMenu();
    });
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    // Widening past the breakpoint turns the drawer back into the desktop
    // bar; without this the body would stay scroll-locked.
    var desktop = window.matchMedia("(min-width: 901px)");
    var onBreakpoint = function (e) { if (e.matches) closeMenu(); };
    if (desktop.addEventListener) desktop.addEventListener("change", onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);

    var navLinks = document.querySelectorAll(".nav-menu a[href^='#']");
    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) sections.push({ id: id, el: el, link: link });
    });

    // --- Sliding active indicator ---
    // One shared bar (see layout.css) that glides between links as the
    // active section changes. Created here rather than in the markup so a
    // no-script load never shows a stray bar. The geometry mirrors the old
    // per-link underline: inset by the link's --space-xs (12px) padding.
    var navList = menu.querySelector("ul");
    var indicator = null;
    if (navList) {
      indicator = document.createElement("span");
      indicator.className = "nav-indicator";
      indicator.setAttribute("aria-hidden", "true");
      navList.appendChild(indicator);
      menu.classList.add("has-indicator");
    }

    var IND_BASE = 80; // px — the bar's authored width; moves are scaleX of this

    function placeIndicator(link) {
      if (!indicator || !link) return;
      var w = link.offsetWidth - 24;
      // Zero width means the desktop bar is hidden (drawer breakpoint) — a
      // stale position is invisible there, so skip rather than mis-place.
      if (w <= 0) return;
      indicator.style.setProperty("--ind-x", (link.offsetLeft + 12) + "px");
      indicator.style.setProperty("--ind-s", (w / IND_BASE).toFixed(4));
      // The transition is armed one frame after the first placement, so the
      // bar starts life in position instead of gliding in from x=0.
      requestAnimationFrame(function () { menu.classList.add("is-settled"); });
    }

    function replaceIndicator() {
      placeIndicator(menu.querySelector("a.active"));
    }

    // Archivo swaps in late and changes the links' metrics, and every resize
    // moves them — re-anchor on both.
    var indTimer;
    window.addEventListener("resize", function () {
      clearTimeout(indTimer);
      indTimer = setTimeout(replaceIndicator, 150);
    });
    window.addEventListener("load", replaceIndicator);
    replaceIndicator();

    if (sections.length && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var match = sections.find(function (s) { return s.el === entry.target; });
            if (!match) return;
            if (entry.isIntersecting) {
              navLinks.forEach(function (l) { l.classList.remove("active"); });
              match.link.classList.add("active");
              placeIndicator(match.link);
            }
          });
        },
        { rootMargin: "-45% 0px -50% 0px" }
      );
      sections.forEach(function (s) { observer.observe(s.el); });
    }
  }

  /* ---------- Sticky header: frosted background once past the hero ---------- */
  function initStickyHeader() {
    var header = document.getElementById("header");
    var hero = document.getElementById("hero");
    if (!header || !hero || !("IntersectionObserver" in window)) return;

    var sentinel = document.createElement("div");
    sentinel.style.position = "absolute";
    sentinel.style.top = "0";
    sentinel.style.height = "1px";
    sentinel.style.width = "1px";
    hero.style.position = hero.style.position || "relative";
    hero.appendChild(sentinel);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        header.classList.toggle("is-scrolled", !entry.isIntersecting);
      });
    });
    observer.observe(sentinel);

    // The top bar is not sticky, so it scrolls away 76px before the hero
    // sentinel above does. Its Instagram link is re-homed next to the
    // hamburger (.header-ig, drawer widths only) for exactly that moment,
    // so it gets its own observer rather than piggybacking on .is-scrolled.
    var topbar = document.getElementById("topbar");
    if (topbar) {
      var topbarObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          header.classList.toggle("topbar-out", !entry.isIntersecting);
        });
      });
      topbarObserver.observe(topbar);
    }
  }

  /* ---------- Reading progress ----------
   * One custom property on <html>, consumed by the header rule and the ring
   * around the back-to-top button. Both read it through transform / conic
   * stops, so the per-frame cost is a single style write.
   */
  function initScrollProgress() {
    var root = document.documentElement;
    var ticking = false;

    function write() {
      ticking = false;
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.pageYOffset / max : 0;
      root.style.setProperty("--scroll-progress", Math.min(1, Math.max(0, p)).toFixed(4));
    }
    function request() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(write);
    }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    write();
  }

  /* ---------- Hero headline word split ----------
   * Wraps each headline's words in .w spans so the entrance can stagger
   * word-by-word (see components.css). Whitespace decides the breaks;
   * anything glued together without a space — like <em>Stuff</em>! — stays
   * one unit, so no line-break opportunity is introduced where the source
   * had none. Must run BEFORE initHeroCarousel so the spans exist when
   * .hero-ready arms the entrance styles. The CSS engages only when both
   * .hero-ready and .hero-split are present, so any failure here simply
   * leaves the block-level entrance in charge.
   */
  function initHeroHeadlineSplit() {
    if (prefersReducedMotion) return;
    var hero = document.getElementById("hero");
    if (!hero) return;
    var headlines = hero.querySelectorAll(".hero-slide h2");
    if (!headlines.length) return;

    try {
      headlines.forEach(function (h2) {
        var nodes = Array.prototype.slice.call(h2.childNodes);
        var units = [];       // each unit: nodes glued together without spaces
        var current = null;

        nodes.forEach(function (node) {
          if (node.nodeType === 3) {
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { current = null; return; }
              if (!current) { current = []; units.push(current); }
              current.push(document.createTextNode(part));
            });
          } else {
            if (!current) { current = []; units.push(current); }
            current.push(node);
          }
        });

        var frag = document.createDocumentFragment();
        units.forEach(function (unit, i) {
          if (i > 0) frag.appendChild(document.createTextNode(" "));
          var w = document.createElement("span");
          w.className = "w";
          w.style.setProperty("--w-i", String(i));
          unit.forEach(function (n) { w.appendChild(n); });
          frag.appendChild(w);
        });
        h2.textContent = "";
        h2.appendChild(frag);
      });
      hero.classList.add("hero-split");
    } catch (e) { /* block-level entrance keeps working */ }
  }

  /* ---------- Hero scroll-out ----------
   * As the page scrolls past the hero, the copy rises away and fades a beat
   * faster than the photographs, which lag behind at 0.3x — the same depth
   * trick as the deco parallax. Writes the independent `translate` property
   * (plus opacity), so it composes with — never clobbers — the
   * transform-based Ken Burns keyframes and the entrance animations, which
   * animate other elements or `transform`. The `parked` latch makes every
   * frame past the hero a single no-op check.
   */
  function initHeroScrollOut() {
    if (prefersReducedMotion) return;
    var hero = document.getElementById("hero");
    if (!hero) return;
    var track = hero.querySelector(".hero-track");
    if (!track) return;
    var contents = Array.prototype.slice.call(hero.querySelectorAll(".hero-content"));
    var fades = Array.prototype.slice.call(hero.querySelectorAll(".hero-controls, .hero-cue"));

    var heroH = hero.offsetHeight || 1;
    var ticking = false;
    var parked = false;

    function frame() {
      ticking = false;
      var p = window.pageYOffset / heroH;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      if (p >= 1 && parked) return;
      parked = p >= 1;

      track.style.translate = "0 " + (p * heroH * 0.3).toFixed(1) + "px";

      var copyO = 1 - p * 1.2;
      if (copyO < 0) copyO = 0;
      for (var i = 0; i < contents.length; i++) {
        contents[i].style.translate = "0 " + (p * -54).toFixed(1) + "px";
        contents[i].style.opacity = copyO.toFixed(3);
        // Faded-out buttons must not stay clickable under the pointer
        contents[i].style.pointerEvents = copyO <= 0 ? "none" : "";
      }

      var chromeO = 1 - p * 1.6;
      if (chromeO < 0) chromeO = 0;
      for (var j = 0; j < fades.length; j++) {
        fades[j].style.opacity = chromeO.toFixed(3);
        fades[j].style.pointerEvents = chromeO <= 0 ? "none" : "";
      }
    }

    function request() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }

    window.addEventListener("scroll", request, { passive: true });
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        heroH = hero.offsetHeight || 1;
        parked = false;
        request();
      }, 150);
    });
    frame();
  }

  /* ---------- Hero carousel: autoplay, prev/next, dots ----------
   * .is-active on the current slide drives the slide's entrance animation and
   * its slow push-in, so the CSS owns the motion and this only owns the state.
   * Autoplay holds while a pointer is over the hero, while focus is inside it,
   * and while the tab is hidden — a carousel that advances behind your back is
   * the fastest way to lose someone mid-sentence.
   */
  var SLIDE_MS = 6000;

  function initHeroCarousel() {
    var hero = document.getElementById("hero");
    var track = document.querySelector(".hero-track");
    var slides = Array.prototype.slice.call(document.querySelectorAll(".hero-slide"));
    var dotsWrap = document.querySelector(".hero-dots");
    var prevBtn = document.querySelector(".hero-arrow.prev");
    var nextBtn = document.querySelector(".hero-arrow.next");
    if (!track || !slides.length) return;

    var current = 0;
    var timer = null;
    var held = 0;          // reasons autoplay is currently held
    var dots = [];

    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "hero-dot" + (i === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Go to slide " + (i + 1));
      dot.addEventListener("click", function () { goTo(i, true); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    function markActive() {
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
    }

    function goTo(index, userInitiated) {
      current = (index + slides.length) % slides.length;
      track.scrollTo({ left: slides[current].offsetLeft, behavior: prefersReducedMotion ? "auto" : "smooth" });
      markActive();
      if (userInitiated) restartAutoplay();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(current + 1, true); });
    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(current - 1, true); });

    function startAutoplay() {
      if (prefersReducedMotion || held > 0) return;
      timer = window.setInterval(next, SLIDE_MS);
    }
    function stopAutoplay() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }
    function restartAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    // The dot's fill animation is CSS, so it has to be parked alongside the
    // timer or it would keep promising a slide change that isn't coming.
    function hold() {
      held++;
      stopAutoplay();
      if (hero) hero.classList.add("hero-paused");
    }
    function release() {
      held = Math.max(0, held - 1);
      if (held === 0) {
        if (hero) hero.classList.remove("hero-paused");
        restartAutoplay();
      }
    }

    if (hero) {
      hero.addEventListener("pointerenter", hold);
      hero.addEventListener("pointerleave", release);
      hero.addEventListener("focusin", hold);
      hero.addEventListener("focusout", release);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) hold(); else release();
    });

    // Re-anchor on resize: slide offsets are in px, so a width change would
    // otherwise leave the track parked between two slides.
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        track.scrollTo({ left: slides[current].offsetLeft, behavior: "auto" });
      }, 150);
    });

    // Arms the slide-entrance styles. Deliberately the last thing before the
    // first markActive(): the CSS hides slide copy only once this is set, so
    // a failure earlier in this function can never leave the hero blank.
    if (hero) hero.classList.add("hero-ready");
    markActive();
    startAutoplay();
  }

  /* ---------- Scroll reveal ----------
   * Elements that cross the threshold in the SAME observer callback are
   * indexed 0..n by visual position and staggered off that index, so a
   * section scrolled past quickly cascades while an element arriving alone
   * animates immediately instead of inheriting a stale delay.
   *
   * Reveals replay. Nothing is unobserved — the precedent is initCountUps(),
   * which re-rolls its numbers on every re-entry. A second observer with no
   * bottom margin drops .is-visible once an element has left through the
   * TOP or BOTTOM of the viewport entirely: never on a horizontal exit
   * (paging the portfolio strip must not flicker its cards) and never while
   * any part is still on screen (the reveal observer's -8% margin would
   * otherwise reset a card parked in the bottom strip — and its exit notice
   * fires once, at 92%, so it could never see a later fully-off-screen
   * state). The top margin covers --reveal-y: a reset drops the box 40px,
   * and without the allowance that drop could land it back in view and
   * re-reveal in a loop. The reset itself is instant — see components.css.
   * data-reveal-once opts an element out of replaying.
   * Returns a small API so the gallery filter can replay the effect.
   */
  var MAX_STAGGER = 8;
  var RESET_TOP = 56; // px — must exceed the largest --reveal-y (40px)

  function initScrollReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    var noop = { replay: function () {} };
    if (!targets.length) return noop;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return noop;
    }

    // A fast scroll can queue several notices for one target in a batch;
    // only the latest state of each matters.
    function latest(entries) {
      var map = new Map();
      entries.forEach(function (e) { map.set(e.target, e); });
      return Array.from(map.values());
    }

    var revealObserver = new IntersectionObserver(
      function (entries) {
        var arrived = latest(entries).filter(function (e) { return e.isIntersecting; });
        if (!arrived.length) return;

        // Sort using the rect already on the entry — no layout reads.
        arrived.sort(function (a, b) {
          var dy = a.boundingClientRect.top - b.boundingClientRect.top;
          return dy !== 0 ? dy : a.boundingClientRect.left - b.boundingClientRect.left;
        });

        arrived.forEach(function (entry, i) {
          entry.target.style.setProperty("--reveal-i", Math.min(i, MAX_STAGGER));
          entry.target.classList.add("is-visible");
        });
      },
      // threshold 0, not 0.05: the clip-reveal variant's start state clips
      // the card to a thin strip, and Chrome folds the target's own
      // clip-path into the intersection geometry — a fractional threshold
      // might never be crossed. First-touch delivery keeps every variant on
      // the same clock; the -8% rootMargin still keeps reveals off the fold.
      { threshold: 0, rootMargin: "0px 0px -8% 0px" }
    );

    var resetObserver = new IntersectionObserver(
      function (entries) {
        latest(entries).forEach(function (entry) {
          if (entry.isIntersecting) return;
          var el = entry.target;
          if (el.hasAttribute("data-reveal-once")) { resetObserver.unobserve(el); return; }
          var r = entry.boundingClientRect;
          // rootBounds is the viewport grown by RESET_TOP; it is null inside
          // a cross-origin iframe, hence the fallbacks.
          var rb = entry.rootBounds;
          var top = rb ? rb.top : -RESET_TOP;
          var bottom = rb ? rb.bottom : (window.innerHeight || document.documentElement.clientHeight);
          var leftVertically = r.bottom <= top || r.top >= bottom;
          if (!leftVertically) return; // horizontal exit inside a scroller — stays revealed
          el.classList.remove("is-visible");
        });
      },
      { threshold: 0, rootMargin: RESET_TOP + "px 0px 0px 0px" }
    );

    targets.forEach(function (el) {
      revealObserver.observe(el);
      resetObserver.observe(el);
    });

    return {
      // Re-run the reveal on elements that are already visible (used after
      // filtering, where the whole grid is on screen at once).
      replay: function (elements) {
        if (prefersReducedMotion || !elements.length) return;
        elements.forEach(function (el, i) {
          el.style.setProperty("--reveal-i", Math.min(i, MAX_STAGGER));
          el.classList.remove("is-visible");
        });
        // Must land in a later frame — removing and re-adding the class in one
        // task gets coalesced by style recalc and no transition fires.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            elements.forEach(function (el) { el.classList.add("is-visible"); });
          });
        });
      },
    };
  }

  /* ---------- Card spotlight ----------
   * Writes the pointer position into the card as a percentage so the CSS can
   * put a soft highlight under the cursor. Coalesced into one rAF per frame,
   * and the rect is read once per enter rather than per move.
   */
  function initCardSpotlight() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var cards = document.querySelectorAll(".service-card");
    cards.forEach(function (card) {
      var rect = null;
      var pending = null;

      function paint() {
        pending = null;
        if (!rect) return;
        card.style.setProperty("--mx", (((lastX - rect.left) / rect.width) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (((lastY - rect.top) / rect.height) * 100).toFixed(1) + "%");
      }

      var lastX = 0;
      var lastY = 0;

      card.addEventListener("pointerenter", function (e) {
        rect = card.getBoundingClientRect();
        lastX = e.clientX;
        lastY = e.clientY;
        paint();
      });

      card.addEventListener("pointermove", function (e) {
        lastX = e.clientX;
        lastY = e.clientY;
        if (pending === null) pending = requestAnimationFrame(paint);
      });

      card.addEventListener("pointerleave", function () {
        rect = null;
        if (pending !== null) { cancelAnimationFrame(pending); pending = null; }
      });
    });
  }

  /* ---------- Count-ups ----------
   * Every [data-count] number — the badge's "30+", each "since 1996" — rolls
   * up whenever it enters the viewport, and again every time it re-enters:
   * the observer is never disconnected, and elements carried by the marquee
   * or the hero track re-enter on their own, so each ticker pass and slide
   * change replays the roll. Leaving the viewport cancels a mid-flight roll
   * and snaps the text to its final value, so a partial number never sits
   * on a parked element. data-count-from sets the start (years roll from
   * 1900 so they hold four digits); digits and suffix come from the markup,
   * which is also the fallback for reduced motion / no JS / no IO.
   */
  function initCountUps() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length || prefersReducedMotion || !("IntersectionObserver" in window)) return;

    var states = new Map();

    els.forEach(function (el) {
      var text = el.textContent.trim();
      var match = /^(\d+)(.*)$/.exec(text);
      if (!match) return;
      var target = parseInt(match[1], 10);
      // data-count-from="now" starts the roll at the current year, so the
      // "since 1996" spans rewind from today back to the founding year —
      // the interpolation below runs down just as happily as up.
      var raw = el.getAttribute("data-count-from") || "0";
      var from = raw === "now" ? new Date().getFullYear() : parseInt(raw, 10);
      // Rolls whose digit count changes ("30+" passes through one digit)
      // get the final width reserved so the pill doesn't breathe. Rolls
      // that hold their digit count (1900 → 1996) need nothing — and must
      // not become inline-block, which would make them flex items inside
      // the gap-spaced hero badge and eyebrow chips.
      if (String(from).length !== String(target).length) {
        el.style.display = "inline-block";
        el.style.minWidth = text.length + "ch";
      }
      states.set(el, {
        target: target,
        from: from,
        suffix: match[2],
        raf: 0,
      });
    });
    if (!states.size) return;

    function start(el, s) {
      if (s.raf) cancelAnimationFrame(s.raf);
      var t0 = null;
      function tick(now) {
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / 1400);
        k = 1 - Math.pow(1 - k, 3); // ease-out cubic — fast start, soft landing
        el.textContent = Math.round(s.from + (s.target - s.from) * k) + s.suffix;
        s.raf = k < 1 ? requestAnimationFrame(tick) : 0;
      }
      s.raf = requestAnimationFrame(tick);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var s = states.get(entry.target);
        if (!s) return;
        if (entry.isIntersecting) {
          start(entry.target, s);
        } else {
          if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
          entry.target.textContent = s.target + s.suffix;
        }
      });
    }, { threshold: 0.6 });

    states.forEach(function (_, el) { io.observe(el); });
  }

  /* ---------- Portfolio strip: progress rail + paging arrows ----------
   * The strip is a native horizontal scroller; this only reports where it is
   * (--strip-p drives the rail's scaleX) and pages it by one card per arrow
   * press. Hidden entirely when nothing overflows. Returns update() so the
   * filter below can re-sync after it changes the strip's scrollWidth.
   */
  function initPortfolioStrip() {
    var noop = { update: function () {} };
    var strip = document.querySelector(".portfolio-grid");
    var nav = document.querySelector(".strip-nav");
    if (!strip || !nav) return noop;
    var bar = nav.querySelector(".strip-progress-bar");
    var prev = nav.querySelector(".strip-arrow.prev");
    var next = nav.querySelector(".strip-arrow.next");
    if (!bar || !prev || !next) return noop;

    var ticking = false;

    function update() {
      ticking = false;
      var max = strip.scrollWidth - strip.clientWidth;
      nav.hidden = max <= 1;
      bar.style.setProperty("--strip-p", max > 0 ? (strip.scrollLeft / max).toFixed(4) : "0");
      prev.disabled = strip.scrollLeft < 8;
      next.disabled = strip.scrollLeft > max - 8;
    }

    function request() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    function step(dir) {
      var item = strip.querySelector(".portfolio-item:not([hidden])");
      // 16px = the strip's --space-sm gap
      var by = item ? item.offsetWidth + 16 : strip.clientWidth * 0.8;
      strip.scrollBy({ left: dir * by, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }

    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    strip.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();

    return { update: update };
  }

  /* ---------- Portfolio filter ---------- */
  function initPortfolioFilter(reveal, strip) {
    var buttons = document.querySelectorAll(".portfolio-filters button");
    var items = document.querySelectorAll(".portfolio-item");
    if (!buttons.length || !items.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var filter = btn.getAttribute("data-filter");
        var shown = [];
        items.forEach(function (item) {
          var show = filter === "*" || item.getAttribute("data-category") === filter;
          item.hidden = !show;
          if (show) shown.push(item);
        });
        // Without this, already-revealed items snap back in with no motion
        // alongside freshly-revealed siblings.
        reveal.replay(shown);
        // Filtering changes the strip's scrollWidth, so the rail and the
        // arrows' end-state need re-deriving.
        strip.update();
      });
    });
  }

  /* ---------- Lightbox (native <dialog>) ---------- */
  function initLightbox() {
    var dialog = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    var caption = document.getElementById("lightbox-caption");
    var closeBtn = document.querySelector(".lightbox-close");
    var prevBtn = document.querySelector(".lightbox-nav.prev");
    var nextBtn = document.querySelector(".lightbox-nav.next");
    var allItems = Array.prototype.slice.call(document.querySelectorAll(".portfolio-item"));
    if (!dialog || !img || !allItems.length) return;

    // Only the items passing the current filter are navigable, so arrowing
    // through a filtered gallery can never surface a hidden category.
    var items = allItems;
    var current = 0;

    function render() {
      var item = items[current];
      var full = item.getAttribute("data-full");
      var title = item.getAttribute("data-title") || "";
      img.src = full;
      img.alt = title;
      caption.textContent = title;
    }

    function openFor(item) {
      items = allItems.filter(function (i) { return !i.hidden; });
      current = Math.max(0, items.indexOf(item));
      render();
      if (document.startViewTransition && !prefersReducedMotion) {
        document.startViewTransition(function () { dialog.showModal(); });
      } else {
        dialog.showModal();
      }
    }

    allItems.forEach(function (item) {
      item.addEventListener("click", function () { openFor(item); });
    });

    function step(delta) {
      current = (current + delta + items.length) % items.length;
      render();
    }

    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });
    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (closeBtn) closeBtn.addEventListener("click", function () { dialog.close(); });

    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
  }

  /* ---------- Theme switch ----------
   * Dark is the default (no attribute); light is opt-in via data-theme.
   * The initial attribute is set by the inline head script to avoid a flash,
   * so this only has to keep the button state and storage in sync.
   *
   * Where the View Transitions API exists, the switch plays as a circular
   * wipe expanding from the toggle itself (CSS in components.css, scoped
   * under .theme-wipe so the lightbox's own view transition is untouched).
   * Everywhere else — and under reduced motion — it stays an instant flip.
   */
  function initThemeToggle() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    var root = document.documentElement;

    function sync() {
      var isDark = root.getAttribute("data-theme") !== "light";
      btn.setAttribute("aria-pressed", String(isDark));
      btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    }

    function apply() {
      var toLight = root.getAttribute("data-theme") !== "light";
      if (toLight) {
        root.setAttribute("data-theme", "light");
      } else {
        root.removeAttribute("data-theme");
      }
      try {
        localStorage.setItem("theme", toLight ? "light" : "dark");
      } catch (e) { /* storage unavailable — theme still applies for this visit */ }
      sync();
    }

    btn.addEventListener("click", function () {
      if (prefersReducedMotion || !document.startViewTransition) {
        apply();
        return;
      }
      // Circle centred on the toggle, sized to the farthest viewport corner
      // so the wipe always finishes the frame.
      var rect = btn.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;
      var radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // .theme-wipe scopes the snapshot CSS (default animations off, ambient
      // loops parked) and is removed once the transition settles either way.
      root.classList.add("theme-wipe");
      var transition = document.startViewTransition(apply);

      // The wipe starts only after transition.ready — by then the full-page
      // restyle and the snapshots are already paid for, so the circle's
      // first frames don't land on top of that work and stutter.
      transition.ready.then(function () {
        root.animate(
          {
            clipPath: [
              "circle(0px at " + x + "px " + y + "px)",
              "circle(" + radius + "px at " + x + "px " + y + "px)",
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",   /* --ease-out */
            pseudoElement: "::view-transition-new(root)",
          }
        );
      }).catch(function () {
        // No pseudo-element WAAPI support — drop back to the default
        // cross-fade by un-scoping the animation:none rules.
        root.classList.remove("theme-wipe");
      });

      transition.finished.finally(function () {
        root.classList.remove("theme-wipe");
      });
    });

    sync();
  }

  /* ---------- Floating buttons: back to top + WhatsApp ----------
   * Both corner buttons appear together once the hero has scrolled away;
   * only the arrow has behaviour of its own (the WhatsApp disc is a plain
   * link to wa.me).
   */
  function initBackToTop() {
    var btn = document.querySelector(".back-to-top");
    var hero = document.getElementById("hero");
    if (!btn || !hero) return;
    var floaters = document.querySelectorAll(".back-to-top, .float-whatsapp");

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          floaters.forEach(function (el) {
            el.classList.toggle("is-visible", !entry.isIntersecting);
          });
        });
      });
      observer.observe(hero);
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- Instagram links: hand off to the app ----------
   * The markup already does most of the work: instagram.com URLs are
   * Universal Links on iOS and verified App Links on Android, so a tap opens
   * the installed app on its own, target="_blank" included.
   *
   * This closes the gaps that leaves — in-app webviews (Instagram, Facebook,
   * Gmail, LinkedIn) and Android Chrome where App Link verification never
   * fired. Touch devices only; on desktop the anchors are left completely
   * alone, so they keep opening a plain new tab.
   */
  function initInstagramLinks() {
    var links = document.querySelectorAll("a[data-ig-user]");
    if (!links.length || !window.matchMedia) return;

    var coarse = window.matchMedia("(hover: none) and (pointer: coarse)");

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (!coarse.matches) return;   // desktop — let target="_blank" do its thing

        var url = link.href;
        var user = link.getAttribute("data-ig-user");
        if (!url || !user) return;

        e.preventDefault();

        // The app taking over backgrounds the page. Not every browser fires
        // all three of these, so listen for whichever arrives first and check
        // document.hidden again when the timer runs.
        var settled = false;
        function settle() { settled = true; }
        ["visibilitychange", "pagehide", "blur"].forEach(function (type) {
          window.addEventListener(type, settle, { once: true });
        });

        try {
          window.location.href = "instagram://user?username=" + encodeURIComponent(user);
        } catch (err) {
          window.location.href = url;
          return;
        }

        window.setTimeout(function () {
          ["visibilitychange", "pagehide", "blur"].forEach(function (type) {
            window.removeEventListener(type, settle);
          });
          if (settled || document.hidden) return;   // app opened — nothing to do

          // No app. Fall back to the web profile. window.open can be blocked
          // here because a timer is not a user gesture, so check the handle it
          // returns and navigate this tab instead if it was refused.
          var win = window.open(url, "_blank", "noopener");
          if (!win) window.location.href = url;
        }, 700);
      });
    });
  }

  /* ---------- Decorative parallax ----------
   * Deliberately not using CSS scroll-driven animations: animation-timeline
   * needs Safari 26+, and on iOS the Safari version is tied to the OS, so a
   * large share of this audience's phones would get no effect at all.
   *
   * Performance rules this loop must keep: geometry is measured only at
   * init/resize (never inside the frame callback), only `transform` is
   * written, and compositing is granted per section via IntersectionObserver.
   */
  function initDecoParallax() {
    if (prefersReducedMotion) return;
    var blocks = Array.prototype.slice.call(document.querySelectorAll(".deco"));
    if (!blocks.length || !("IntersectionObserver" in window)) return;

    // Tells the stylesheet that .is-active is being maintained, so it is safe
    // to park the ambient animations on sections that are off screen.
    document.documentElement.classList.add("deco-live");

    var cache = [];
    var needsUpdate = true;
    var ticking = false;

    function depthScale() {
      return window.matchMedia("(max-width: 900px)").matches ? 0.5 : 1;
    }

    function buildCache() {
      var scale = depthScale();
      var scrollY = window.pageYOffset;
      cache = blocks.map(function (deco) {
        var section = deco.parentElement;
        var rect = section.getBoundingClientRect();
        var layers = Array.prototype.slice
          .call(deco.querySelectorAll(".deco-layer"))
          // A layer hidden by the mobile media query has no offsetParent —
          // check once here rather than every frame.
          // getClientRects() is empty for display:none. offsetParent is not
          // usable here — these layers are <svg>, and it is an HTMLElement
          // property, so it reads undefined on every one of them.
          .filter(function (el) { return el.getClientRects().length > 0; })
          .map(function (el) {
            return {
              el: el,
              depth: parseFloat(el.getAttribute("data-depth") || 0) * scale,
              // Optional lateral component. Layers that also drift sideways
              // read as further off-axis, which deepens the effect without
              // any extra per-frame work.
              depthX: parseFloat(el.getAttribute("data-depth-x") || 0) * scale,
            };
          });
        return {
          deco: deco,
          top: rect.top + scrollY,
          height: rect.height,
          layers: layers,
          active: deco.classList.contains("is-active"),
        };
      });
      needsUpdate = true;
    }

    function apply() {
      ticking = false;
      if (!needsUpdate) return;
      needsUpdate = false;

      var scrollY = window.pageYOffset;
      var vh = window.innerHeight;
      var viewCentre = scrollY + vh / 2;

      for (var i = 0; i < cache.length; i++) {
        var c = cache[i];
        if (!c.active) continue;
        var centre = c.top + c.height / 2;
        var span = vh / 2 + c.height / 2;
        var p = (viewCentre - centre) / span;
        if (p < -1) p = -1; else if (p > 1) p = 1;
        for (var j = 0; j < c.layers.length; j++) {
          var layer = c.layers[j];
          layer.el.style.transform =
            "translate3d(" + (p * layer.depthX).toFixed(2) + "px," +
            (p * layer.depth).toFixed(2) + "px,0)";
        }
      }
    }

    function requestTick() {
      needsUpdate = true;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    }

    var activeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var isActive = entry.isIntersecting;
          entry.target.classList.toggle("is-active", isActive);
          for (var i = 0; i < cache.length; i++) {
            if (cache[i].deco === entry.target) cache[i].active = isActive;
          }
        });
        requestTick();
      },
      { rootMargin: "200px 0px" }
    );
    blocks.forEach(function (b) { activeObserver.observe(b); });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        buildCache();
        requestTick();
      }, 150);
    }

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", function () { buildCache(); requestTick(); });
    if ("ResizeObserver" in window) {
      new ResizeObserver(onResize).observe(document.body);
    }

    buildCache();
    apply();
  }

  /* ---------- Rain on the glass ----------
   * Fixed droplets over the viewport (styles in components.css). Placement
   * is measured, not guessed: the centred container leaves a content-free
   * gutter either side whose width swings from ~170px on a wide desktop to
   * ~20px on a phone, so each drop's anchor is a fraction of the LIVE
   * gutter, remeasured on resize. Drops shrink to fit narrow gutters, and
   * only the largest few keep their backdrop-filter — that sample is the
   * expensive part, so the cap is enforced by count, not by luck.
   * Zero per-frame JS: fixed positioning means the browser's own backdrop
   * sampling produces the refraction as content scrolls beneath.
   */
  function initDroplets() {
    // The rain is now a one-shot load intro (condense in, sit, run off) —
    // pure motion, so reduced-motion visitors get none rather than a
    // permanent overlay that never leaves.
    if (prefersReducedMotion) return;
    var container = document.querySelector("#topbar .container");
    if (!container) return;

    // side, y in vh%, gx = fraction of the gutter, s = nominal size px,
    // v = silhouette variant. Right side stops at 82vh so no drop can sit
    // on the floating buttons parked in that corner (which are hidden while
    // the hero is in view anyway — the rain has run off before they show).
    var LAYOUT = [
      { side: "l", y: 16, gx: 0.35, s: 44, v: "a" },
      { side: "l", y: 30, gx: 0.7,  s: 20, v: "b" },
      { side: "l", y: 45, gx: 0.25, s: 13, v: "c" },
      { side: "l", y: 63, gx: 0.6,  s: 30, v: "a" },
      { side: "l", y: 78, gx: 0.3,  s: 16, v: "b" },
      { side: "l", y: 92, gx: 0.55, s: 12, v: "c" },
      { side: "l", y: 5,  gx: 0.75, s: 17, v: "c" },
      { side: "r", y: 10, gx: 0.4,  s: 26, v: "c" },
      { side: "r", y: 24, gx: 0.65, s: 52, v: "b" },
      { side: "r", y: 40, gx: 0.3,  s: 14, v: "a" },
      { side: "r", y: 55, gx: 0.6,  s: 34, v: "c" },
      { side: "r", y: 70, gx: 0.35, s: 22, v: "a" },
      { side: "r", y: 82, gx: 0.7,  s: 12, v: "b" },
      { side: "r", y: 4,  gx: 0.2,  s: 15, v: "a" },
    ];

    // Phones have no gutters, so the stay-out-of-content rule above would
    // queue every drop into a 20px strip along each edge. Instead: a
    // handful of very small, shading-only drops scattered across the whole
    // screen — translucent and click-through, so drifting over content
    // while the page scrolls obscures nothing. x in vw%, y in vh%.
    var PHONE_LAYOUT = [
      { x: 8,  y: 10, s: 13, v: "a" },
      { x: 30, y: 26, s: 10, v: "b" },
      { x: 88, y: 18, s: 15, v: "c" },
      { x: 62, y: 44, s: 11, v: "a" },
      { x: 14, y: 60, s: 16, v: "c" },
      { x: 84, y: 72, s: 12, v: "b" },
      { x: 42, y: 88, s: 14, v: "a" },
    ];

    // The rotated silhouettes' bounding boxes run ~25% past their width, so
    // a drop "fits" the gutter only when cx ± size × FIT/2 stays inside it.
    var FIT = 1.25;

    function build() {
      var rect = container.getBoundingClientRect();
      var style = window.getComputedStyle(container);
      // Content-free strip: viewport edge up to the container's first glyph
      // (box edge + its own padding).
      var gutter = rect.left + parseFloat(style.paddingLeft);
      if (gutter < 14) return;   // nowhere safe to put even a tiny drop

      var next = document.createElement("div");
      next.className = "droplets";
      next.setAttribute("aria-hidden", "true");

      var narrow = gutter < 26;
      // Compute final geometry first so the backdrop budget can go to the
      // largest drops: 9 live backdrop-filters on desktop, none on phones
      // (their drops are all tiny). Everything outside the budget renders
      // as a shading-only "tiny" drop.
      var budget = narrow ? 0 : 9;
      var drops;

      if (narrow) {
        drops = PHONE_LAYOUT.map(function (d) {
          var half = (d.s * FIT) / 2;
          var cx = window.innerWidth * (d.x + (Math.random() - 0.5) * 8) / 100;
          cx = Math.min(window.innerWidth - half - 1, Math.max(half + 1, cx));
          return {
            x: cx,
            y: Math.min(97, Math.max(2, d.y + (Math.random() - 0.5) * 6)),
            size: d.s,
            v: d.v,
          };
        });
      } else {
        drops = LAYOUT.map(function (d) {
          // Cap the size so the drop can sit fully inside the gutter even
          // with its rotated bounding box, then keep its centre far enough
          // from both gutter edges that no part crosses into content.
          var size = Math.min(d.s, (gutter - 4) / FIT);
          if (size < 8) return null;
          var half = (size * FIT) / 2;
          var jx = (Math.random() - 0.5) * 0.12;           // gutter-fraction jitter
          var jy = (Math.random() - 0.5) * 3;              // vh jitter
          var cx = gutter * (d.gx + jx);
          cx = Math.min(gutter - half - 1, Math.max(half + 1, cx));
          return {
            x: d.side === "l" ? cx : window.innerWidth - cx,
            y: Math.min(97, Math.max(2, d.y + jy)),
            size: size,
            v: d.v,
          };
        }).filter(Boolean);
      }

      drops
        .slice()
        .sort(function (a, b) { return b.size - a.size; })
        .forEach(function (d, rank) { d.tiny = rank >= budget || d.size < 18; });

      var lastGone = 0;   // seconds until the final drop has run off

      drops.forEach(function (d) {
        var el = document.createElement("span");
        el.className = "droplet droplet--" + d.v + (d.tiny ? " droplet--tiny" : "");
        // Centre offsets are baked into left/top — the `translate` property
        // belongs to the run-off animation (see drop-slide, components.css).
        el.style.left = (d.x - d.size / 2).toFixed(1) + "px";
        el.style.top = "calc(" + d.y.toFixed(1) + "vh - " + (d.size * 0.53).toFixed(1) + "px)";
        el.style.width = d.size.toFixed(1) + "px";
        // A resting drop sags a little — never a perfect circle.
        el.style.height = (d.size * 1.06).toFixed(1) + "px";
        el.style.setProperty("--glint-dur", (5 + Math.random() * 4).toFixed(1) + "s");
        // Negative delay starts each glint mid-cycle instead of in unison.
        el.style.setProperty("--glint-delay", (-Math.random() * 9).toFixed(1) + "s");

        // Lifecycle: staggered condense-in, then a run down the glass at
        // its own moment. Bigger drops run farther before drying up.
        var slideDelay = 2.2 + Math.random() * 2.3;
        var slideDur = 1.2 + Math.random();
        el.style.setProperty("--in-delay", (Math.random() * 0.9).toFixed(2) + "s");
        el.style.setProperty("--slide-delay", slideDelay.toFixed(2) + "s");
        el.style.setProperty("--slide-dur", slideDur.toFixed(2) + "s");
        el.style.setProperty("--run-x", (Math.random() * 20 - 10).toFixed(0) + "px");
        el.style.setProperty("--run-y", (30 + d.size * (2 + Math.random() * 1.5)).toFixed(0) + "px");
        if (slideDelay + slideDur > lastGone) lastGone = slideDelay + slideDur;

        next.appendChild(el);
      });

      document.body.appendChild(next);

      // Every drop holds opacity 0 (animation-fill forwards) once it has run
      // off — drop the whole overlay when the show is over, and the last of
      // the backdrop-filter cost goes with it.
      window.setTimeout(function () { next.remove(); }, (lastGone + 0.5) * 1000);
    }

    build();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initNav();
    initStickyHeader();
    initScrollProgress();
    initHeroHeadlineSplit();   // before the carousel — the spans must exist
    initHeroCarousel();        // when .hero-ready arms the entrance styles
    initHeroScrollOut();
    var reveal = initScrollReveal();
    var strip = initPortfolioStrip();
    initPortfolioFilter(reveal, strip);
    initCountUps();
    initCardSpotlight();
    initLightbox();
    initBackToTop();
    initInstagramLinks();
    initDecoParallax();
    initDroplets();
  });
})();
