(() => {
  const form = document.getElementById('support-form');
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('form-status');
  const endpoint = 'https://gwfdnwlhonszocjizrnl.supabase.co/rest/v1/support_requests';
  const publishableKey = 'sb_publishable_HEtoyyAepo29rmGVRLD10Q_TvOZZmoE';
  let submitting = false;

  function showStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    for (const name of ['app', 'email', 'message']) {
      form.elements[name].value = form.elements[name].value.trim();
    }

    if (!form.reportValidity()) return;
    if (form.elements.message.value.length < 10) {
      showStatus('Please write at least 10 characters.', 'error');
      form.elements.message.focus();
      return;
    }

    if (form.elements.website.value) {
      showStatus('Thank you! Your support request has been received.', 'success');
      return;
    }

    submitting = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    showStatus('', '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          app: form.elements.app.value,
          email: form.elements.email.value.toLowerCase(),
          message: form.elements.message.value,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (error.code === '23505') {
          showStatus('A request from this email was already received in the current minute. Please wait a minute before sending another.', 'error');
          return;
        }
        throw new Error('Support request failed');
      }

      form.elements.message.value = '';
      showStatus('Thank you! Your support request has been received. I will reply to your email.', 'success');
    } catch {
      showStatus('Could not confirm your request. Please check your connection and try again.', 'error');
    } finally {
      clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      button.textContent = 'Send message';
    }
  });
})();
