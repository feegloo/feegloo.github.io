/* Podgląd screenshotów we wszystkich tutorialach. */
(() => {
  'use strict';

  const screenshotLinks = [
    ...document.querySelectorAll('main figure a[href]')
  ].filter(link => link.querySelector('img'));

  if (
    screenshotLinks.length &&
    typeof HTMLDialogElement !== 'undefined'
  ) {
    const dialog = document.createElement('dialog');
    dialog.className = 'screenshot-modal';
    dialog.setAttribute('aria-label', 'Podgląd ilustracji');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'screenshot-modal-close';
    close.setAttribute('aria-label', 'Zamknij podgląd');
    close.textContent = '×';

    const picture = document.createElement('img');
    picture.className = 'screenshot-modal-image';

    const status = document.createElement('p');
    status.className = 'screenshot-modal-status';
    status.setAttribute('role', 'status');

    dialog.append(picture, status, close);
    document.body.append(dialog);

    let opener = null;
    let closing = false;
    let closeTimer;
    let savedOverflow = '';
    let savedPadding = '';

    const root = document.documentElement;

    function finishClose() {
      clearTimeout(closeTimer);

      dialog.close();
      root.style.overflow = savedOverflow;
      root.style.paddingRight = savedPadding;
      picture.removeAttribute('src');

      closing = false;

      if (opener && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    }

    function closePreview() {
      if (!dialog.open || closing) return;

      closing = true;
      dialog.classList.remove('is-visible');

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      closeTimer = window.setTimeout(
        finishClose,
        reducedMotion ? 0 : 180
      );
    }

    picture.addEventListener('load', () => {
      status.hidden = true;
    });

    picture.addEventListener('error', () => {
      if (!dialog.open || closing) return;

      status.textContent = 'Nie udało się wczytać ilustracji.';
      status.hidden = false;
    });

    close.addEventListener('click', closePreview);

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closePreview();
    });

    let backdropPress = false;

    dialog.addEventListener('pointerdown', event => {
      backdropPress = event.target === dialog;
    });

    dialog.addEventListener('click', event => {
      if (event.target === dialog && backdropPress) {
        closePreview();
      }

      backdropPress = false;
    });

    screenshotLinks.forEach(link => {
      link.setAttribute('aria-haspopup', 'dialog');

      link.addEventListener('click', event => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();

        if (dialog.open) return;

        opener = link;

        const thumbnail = link.querySelector('img');
        picture.alt = thumbnail.alt || 'Powiększona ilustracja';

        status.textContent = 'Wczytywanie ilustracji…';
        status.hidden = false;
        picture.src = link.href;

        savedOverflow = root.style.overflow;
        savedPadding = root.style.paddingRight;

        const scrollbar = window.innerWidth - root.clientWidth;

        if (scrollbar > 0) {
          root.style.paddingRight =
            (
              parseFloat(getComputedStyle(root).paddingRight) +
              scrollbar
            ) + 'px';
        }

        root.style.overflow = 'hidden';

        dialog.showModal();
        close.focus({ preventScroll: true });

        // Ustal początkowy stan przed animacją opacity.
        dialog.getBoundingClientRect();
        dialog.classList.add('is-visible');
      });
    });
  }
})();
