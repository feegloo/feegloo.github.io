/* Wspólne komponenty wszystkich trzech tutoriali. */
(() => {
  'use strict';

  // Aktywna sekcja i aktualizacja URL podczas przewijania.
  const fragmentId = hash => {
    try {
      return decodeURIComponent(hash.slice(1));
    } catch {
      return '';
    }
  };

  const sections = [...document.querySelectorAll('aside nav a[href^="#"]')]
    .map(link => ({
      link,
      target: document.getElementById(
        fragmentId(link.getAttribute('href'))
      )
    }))
    .filter(item => item.target);

  function markActive(active) {
    sections.forEach(item => {
      if (item === active) {
        item.link.setAttribute('aria-current', 'location');
      } else {
        item.link.removeAttribute('aria-current');
      }
    });
  }

  function markFromAddress() {
    const id = fragmentId(window.location.hash);

    markActive(
      sections.find(item => item.target.id === id) ||
      (!id ? sections[0] : null)
    );
  }

  function updateFromScroll() {
    const visible = sections.filter(
      item => item.target.getClientRects().length
    );

    if (!visible.length) return;

    const readingLine = Math.max(100, window.innerHeight * 0.3);
    let active = visible[0];

    for (const item of visible) {
      if (item.target.getBoundingClientRect().top <= readingLine) {
        active = item;
      }
    }

    const page = document.scrollingElement || document.documentElement;

    if (
      page.scrollHeight > window.innerHeight &&
      window.scrollY + window.innerHeight >= page.scrollHeight - 2
    ) {
      active = visible[visible.length - 1];
    }

    markActive(active);

    if (fragmentId(window.location.hash) !== active.target.id) {
      const url = new URL(window.location.href);
      url.hash = active.target.id;

      try {
        window.history.replaceState(
          window.history.state,
          '',
          url.href
        );
      } catch {
        // Niektóre przeglądarki ograniczają history dla file://.
      }
    }
  }

  let scrollFrame = null;

  function scheduleUpdate() {
    if (scrollFrame !== null) return;

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      updateFromScroll();
    });
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', markFromAddress);
  window.addEventListener('pageshow', scheduleUpdate);

  markFromAddress();

  // Kopiowanie promptów.
  document.querySelectorAll('[data-copy-target]').forEach(button => {
    const source = document.getElementById(button.dataset.copyTarget);
    const status = document.getElementById(button.dataset.copyStatus);

    if (!source || !status) return;

    button.addEventListener('click', async () => {
      const text = source.textContent;
      let copied = false;

      try {
        if (window.isSecureContext && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        // Przeglądarka może odmówić dostępu do schowka.
      }

      if (!copied) {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText =
          'position:fixed;opacity:0;pointer-events:none';

        document.body.appendChild(field);
        field.select();

        try {
          copied = document.execCommand('copy');
        } catch {
          // Poniżej pozostaje ręczne kopiowanie.
        }

        field.remove();
        button.focus();
      }

      if (copied) {
        status.textContent = 'Skopiowano.';
        return;
      }

      const details = source.closest('details');
      if (details) details.open = true;

      const selection = window.getSelection();

      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(source);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      status.textContent =
        'Zaznaczono prompt. Naciśnij Ctrl+C lub ⌘C albo pobierz plik .txt.';
    });
  });

  // Zakładki systemów operacyjnych.
  document.querySelectorAll('[data-tabs]').forEach(root => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    if (!tabs.length) return;

    const panels = tabs.map(tab =>
      document.getElementById(tab.getAttribute('aria-controls'))
    );

    if (panels.some(panel => !panel)) return;

    function activate(selectedTab) {
      tabs.forEach((tab, index) => {
        const selected = tab === selectedTab;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[index].hidden = !selected;
      });
    }

    activate(
      tabs.find(tab => tab.getAttribute('aria-selected') === 'true') ||
      tabs[0]
    );

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));

      tab.addEventListener('keydown', event => {
        const positions = {
          ArrowRight: (index + 1) % tabs.length,
          ArrowLeft: (index + tabs.length - 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1
        };

        if (!(event.key in positions)) return;

        event.preventDefault();

        const next = tabs[positions[event.key]];
        activate(next);
        next.focus();
      });
    });
  });
})();
