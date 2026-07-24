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

    function closeMenu() {
      menu.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    function openMenu() {
      menu.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-open");
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

  /* ---------- Hero carousel: autoplay, prev/next, dots ---------- */
  function initHeroCarousel() {
    var track = document.querySelector(".hero-track");
    var slides = document.querySelectorAll(".hero-slide");
    var dotsWrap = document.querySelector(".hero-dots");
    var prevBtn = document.querySelector(".hero-arrow.prev");
    var nextBtn = document.querySelector(".hero-arrow.next");
    if (!track || !slides.length) return;

    var current = 0;
    var timer = null;
    var dots = [];

    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.className = "hero-dot" + (i === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Go to slide " + (i + 1));
      dot.addEventListener("click", function () { goTo(i, true); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    function goTo(index, userInitiated) {
      current = (index + slides.length) % slides.length;
      track.scrollTo({ left: slides[current].offsetLeft, behavior: prefersReducedMotion ? "auto" : "smooth" });
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
      if (userInitiated) restartAutoplay();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    if (nextBtn) nextBtn.addEventListener("click", function () { next(); restartAutoplay(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); restartAutoplay(); });

    function startAutoplay() {
      if (prefersReducedMotion) return;
      timer = window.setInterval(next, 6000);
    }
    function restartAutoplay() {
      if (timer) window.clearInterval(timer);
      startAutoplay();
    }

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
            return { el: el, depth: parseFloat(el.getAttribute("data-depth") || 0) * scale };
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
            "translate3d(0," + (p * layer.depth).toFixed(2) + "px,0)";
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
    initHeroCarousel();
    var reveal = initScrollReveal();
    initPortfolioFilter(reveal);
    initLightbox();
    initBackToTop();
    initDecoParallax();
  });
})();
