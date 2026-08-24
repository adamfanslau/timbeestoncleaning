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

    if (sections.length && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var match = sections.find(function (s) { return s.el === entry.target; });
            if (!match) return;
            if (entry.isIntersecting) {
              navLinks.forEach(function (l) { l.classList.remove("active"); });
              match.link.classList.add("active");
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
   * Returns a small API so the gallery filter can replay the effect.
   */
  var MAX_STAGGER = 8;

  function initScrollReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    var noop = { replay: function () {} };
    if (!targets.length) return noop;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return noop;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        var arrived = entries.filter(function (e) { return e.isIntersecting; });
        if (!arrived.length) return;

        // Sort using the rect already on the entry — no layout reads.
        arrived.sort(function (a, b) {
          var dy = a.boundingClientRect.top - b.boundingClientRect.top;
          return dy !== 0 ? dy : a.boundingClientRect.left - b.boundingClientRect.left;
        });

        arrived.forEach(function (entry, i) {
          entry.target.style.setProperty("--reveal-i", Math.min(i, MAX_STAGGER));
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach(function (el) { observer.observe(el); });

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

  /* ---------- Portfolio filter ---------- */
  function initPortfolioFilter(reveal) {
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

    btn.addEventListener("click", function () {
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
    });

    sync();
  }

  /* ---------- Back to top ---------- */
  function initBackToTop() {
    var btn = document.querySelector(".back-to-top");
    var hero = document.getElementById("hero");
    if (!btn || !hero) return;

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          btn.classList.toggle("is-visible", !entry.isIntersecting);
        });
      });
      observer.observe(hero);
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
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

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initNav();
    initStickyHeader();
    initScrollProgress();
    initHeroCarousel();
    var reveal = initScrollReveal();
    initPortfolioFilter(reveal);
    initCardSpotlight();
    initLightbox();
    initBackToTop();
    initDecoParallax();
  });
})();
