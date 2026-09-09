/* Wspólne komponenty tutoriali. Zwykły skrypt działa także przez file://. */
(() => {
  'use strict';

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
      } catch { /* Przeglądarka może odmówić dostępu do schowka. */ }

      if (!copied) {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(field);
        field.select();
        try { copied = document.execCommand('copy'); } catch { /* Ręczne kopiowanie poniżej. */ }
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
      status.textContent = 'Zaznaczono prompt. Naciśnij Ctrl+C lub ⌘C albo pobierz plik .txt.';
    });
  });

  document.querySelectorAll('[data-tabs]').forEach(root => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    if (!tabs.length) return;
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (panels.some(panel => !panel)) return;

    function activate(selectedTab) {
      tabs.forEach((tab, index) => {
        const selected = tab === selectedTab;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[index].hidden = !selected;
      });
    }

    activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
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
