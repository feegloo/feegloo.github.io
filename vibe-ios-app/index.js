(() => {
  // DOM references, configuration and page state.
  const form = document.getElementById('create-ios-app-form');

  const invitationInput = document.getElementById('invitation-hash');

  const invitationError = document.getElementById('invitation-error');

  const status = document.getElementById('form-status');

  const submitButton = form.querySelector('button[type="submit"]');

  const attachmentInput = document.getElementById('attachments');

  const attachmentPicker = document.getElementById('attachment-picker');

  const attachmentPreviews = document.getElementById('attachment-previews');

  const drawButton = document.getElementById('attachment-draw');

  let drawingEditor;

  const attachmentError = document.getElementById('attachments-error');

  const createAppEndpoint =
    'https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/create-app';

  const invitationHash = readInvitationHash();

  let buttonAnimationTimer = null;

  let buttonAnimationBase = '';

  let statusPollTimer = null;

  let currentRequestId = null;

  let currentRequestKey = null;

  let requestGeneration = 0;

  const resultPanel = document.getElementById('app-result');

  const resultMessage = document.getElementById('result-message');

  const loginButton = document.getElementById('github-login');

  const repositoryLink = document.getElementById('repository-link');

  const authEndpoint = createAppEndpoint.replace(/create-app$/, 'github-auth');

  const randomKey = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');

  const storedSession = () => localStorage.getItem('vibe-github-session');

  let selectedAttachments = [];

  const fields = [
    {
      element: document.getElementById('email'),
      wrapper: document.querySelector('[data-field="email"]'),
      isValid: function (element) {
        return element.value.trim() !== '' && element.validity.valid;
      },
    },
    {
      element: document.getElementById('app-name'),
      wrapper: document.querySelector('[data-field="appName"]'),
      isValid: function (element) {
        const appName = element.value.trim();
        return appName.length >= 2 && appName.length <= 30;
      },
    },
    {
      element: document.getElementById('initial-prompt'),
      wrapper: document.querySelector('[data-field="initialPrompt"]'),
      isValid: function (element) {
        return element.value.trim() !== '';
      },
    },
    {
      element: document.getElementById('agreement'),
      wrapper: document.getElementById('agreement-field'),
      isValid: function (element) {
        return element.checked;
      },
    },
  ];

  // Startup and event binding.

  function initialize() {
    form.reset();
    invitationInput.value = invitationHash;
    restoreDraft();
    bindAttachmentEvents();
    bindValidationEvents();
    form.addEventListener('submit', submitApp);
    loginButton.addEventListener('click', startGitHubLogin);
    document
      .getElementById('create-another-app')
      .addEventListener('click', createAnotherApp);
    restoreInvitationState();
  }

  function bindAttachmentEvents() {
    drawingEditor = createDrawingEditor(saveDrawing);
    drawButton.addEventListener('click', () => drawingEditor.open());
    attachmentInput.addEventListener('change', function () {
      addAttachments(attachmentInput.files);
      attachmentInput.value = '';
    });
    attachmentPicker.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        attachmentInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(function (name) {
      attachmentPicker.addEventListener(name, function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        attachmentPicker.classList.add('drag-over');
      });
    });
    attachmentPicker.addEventListener('dragleave', function () {
      attachmentPicker.classList.remove('drag-over');
    });
    attachmentPicker.addEventListener('drop', function (event) {
      event.preventDefault();
      attachmentPicker.classList.remove('drag-over');
      addAttachments(event.dataTransfer.files);
    });
  }

  function bindValidationEvents() {
    fields.forEach(function (field) {
      const eventName = field.element.type === 'checkbox' ? 'change' : 'input';
      field.element.addEventListener(eventName, function () {
        saveDraft();
        if (field.wrapper.classList.contains('invalid')) {
          setValidity(field, field.isValid(field.element));
        }
      });
    });
  }

  // Only unsent text is restored on a normal page load.
  function draftStorageKey() {
    return 'vibe-app-draft:' + invitationHash;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftStorageKey(), JSON.stringify({
        email: document.getElementById('email').value,
        appName: document.getElementById('app-name').value,
        prompt: document.getElementById('initial-prompt').value,
      }));
    } catch (_) {}
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftStorageKey()) || 'null');
      if (!draft) return;
      for (const [id, key] of [['email', 'email'], ['app-name', 'appName'], ['initial-prompt', 'prompt']]) {
        if (typeof draft[key] === 'string') document.getElementById(id).value = draft[key];
      }
    } catch (_) {}
  }

  // Form validation and submission.

  function setValidity(field, valid) {
    field.wrapper.classList.toggle('invalid', !valid);
    field.element.setAttribute('aria-invalid', String(!valid));
  }

  function validateForm() {
    let firstInvalidElement = null;
    fields.forEach(function (field) {
      const valid = field.isValid(field.element);
      setValidity(field, valid);
      if (!valid && !firstInvalidElement) {
        firstInvalidElement = field.element;
      }
    });
    if (firstInvalidElement) firstInvalidElement.focus();
    return firstInvalidElement === null;
  }

  function buildRequestPayload() {
    const payload = new FormData();
    payload.append('email', document.getElementById('email').value.trim());
    payload.append('appName', document.getElementById('app-name').value.trim());
    payload.append(
      'prompt',
      document.getElementById('initial-prompt').value.trim(),
    );
    payload.append('invitation', invitationHash);
    if (!currentRequestId) {
      currentRequestId = crypto.randomUUID();
      currentRequestKey = randomKey();
    }
    payload.append('requestId', currentRequestId);
    selectedAttachments.forEach(function (item) {
      payload.append('attachments', item.file, item.file.name);
      payload.append('attachmentSources', item.source || 'upload');
    });
    return payload;
  }

  async function submitApp(event) {
    event.preventDefault();
    if (submitButton.disabled) {
      return;
    }
    hideBanner();
    status.textContent = '';
    if (!validateForm()) return;
    requestGeneration += 1;
    clearTimeout(statusPollTimer);
    const payload = buildRequestPayload();
    startButtonAnimation(
      selectedAttachments.length > 0 ? 'Uploading files' : 'Creating',
    );
    try {
      const response = await fetch(createAppEndpoint, {
        method: 'POST',
        headers: { 'x-request-key': currentRequestKey },
        body: payload,
      });
      const result = await response.json().catch(function () {
        return {};
      });
      if (!response.ok)
        throw new Error(result.error || 'Could not save app request.');
      currentRequestId = result.requestId;
      if (
        [
          'missing_invitation',
          'invalid_invitation',
          'invitation_limit',
        ].includes(result.status)
      ) {
        showResult(result);
        return;
      }
      localStorage.removeItem(draftStorageKey());
      startButtonAnimation('Creating app');
      scheduleStatusPoll();
    } catch (error) {
      setButton('Create iOS app', false);
      showBanner(error.message || 'Could not create app request.');
    }
  }

  // Attachments and drawings.

  function attachmentExtension(file) {
    const parts = file.name.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
  }

  function attachmentIsAllowed(file) {
    return [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'svg',
      'pdf',
      'txt',
      'md',
      'ppt',
      'pptx',
      'xls',
      'xlsx',
      'doc',
      'docx',
      'mp4',
      'mov',
      'webm',
    ].includes(attachmentExtension(file));
  }

  function attachmentIsVideo(file) {
    return ['mp4', 'mov', 'webm'].includes(attachmentExtension(file));
  }

  function saveDrawing(file) {
    const previousCount = selectedAttachments.length;
    addAttachments([file], 'drawing');
    return selectedAttachments.length > previousCount;
  }

  function addAttachments(files, source) {
    attachmentError.textContent = '';
    Array.from(files || []).forEach(function (file) {
      if (!attachmentIsAllowed(file)) {
        attachmentError.textContent =
          'Use PNG, JPG, WEBP, SVG, PDF, TXT, MD, PPT/PPTX, XLS/XLSX, DOC/DOCX, MP4, MOV or WEBM files.';
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        attachmentError.textContent =
          file.name + ': file is too large. Maximum size is 50 MB.';
        return;
      }
      if (file.size === 0) {
        attachmentError.textContent = file.name + ': file is empty.';
        return;
      }
      const isVideo = attachmentIsVideo(file);
      const count = selectedAttachments.filter(function (item) {
        return attachmentIsVideo(item.file) === isVideo;
      }).length;
      if (count >= (isVideo ? 1 : 5)) {
        attachmentError.textContent = isVideo
          ? 'You can attach up to 1 video.'
          : 'You can attach up to 5 images and files.';
        return;
      }
      selectedAttachments.push({
        file: file,
        source: source === 'drawing' ? 'drawing' : 'upload',
        url: URL.createObjectURL(file),
      });
    });
    renderAttachments();
  }

  function renderAttachments() {
    attachmentPreviews.innerHTML = '';
    selectedAttachments.forEach(function (item, index) {
      const preview = document.createElement('div');
      preview.className = 'attachment-preview';
      const isVideo = attachmentIsVideo(item.file);
      const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(
        attachmentExtension(item.file),
      );
      const image = document.createElement(
        isVideo ? 'video' : isImage ? 'img' : 'span',
      );
      preview.title = item.file.name;
      if (!isVideo && !isImage) {
        image.className = 'attachment-document';
        const fileType = document.createElement('span');
        fileType.textContent = attachmentExtension(item.file).toUpperCase();
        const fileName = document.createElement('span');
        fileName.className = 'attachment-document-name';
        fileName.textContent = item.file.name;
        image.appendChild(fileType);
        image.appendChild(fileName);
        image.setAttribute('aria-label', item.file.name);
      }
      if (isVideo) {
        image.muted = true;
        image.playsInline = true;
        image.preload = 'metadata';
        image.setAttribute('aria-label', item.file.name);
        const badge = document.createElement('span');
        badge.className = 'attachment-video-label';
        badge.textContent = 'VIDEO';
        preview.appendChild(badge);
      }
      if (isVideo || isImage) {
        image.src = item.url;
        image.alt = item.file.name;
      }
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'attachment-remove';
      removeButton.setAttribute('aria-label', 'Remove ' + item.file.name);
      const removeIcon = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      );
      removeIcon.setAttribute('viewBox', '0 0 12 12');
      removeIcon.setAttribute('aria-hidden', 'true');
      removeIcon.setAttribute('focusable', 'false');
      const removePath = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
      );
      removePath.setAttribute('d', 'M3 3L9 9M9 3L3 9');
      removePath.setAttribute('fill', 'none');
      removePath.setAttribute('stroke', 'currentColor');
      removePath.setAttribute('stroke-width', '2.5');
      removePath.setAttribute('stroke-linecap', 'round');
      removeIcon.appendChild(removePath);
      removeButton.appendChild(removeIcon);
      removeButton.addEventListener('click', function () {
        URL.revokeObjectURL(item.url);
        selectedAttachments.splice(index, 1);
        attachmentError.textContent = '';
        renderAttachments();
      });
      preview.appendChild(image);
      preview.appendChild(removeButton);
      attachmentPreviews.appendChild(preview);
    });
    attachmentPicker.classList.toggle(
      'disabled',
      selectedAttachments.length >= 6,
    );
    drawButton.disabled =
      selectedAttachments.filter((item) => !attachmentIsVideo(item.file))
        .length >= 5;
  }

  // Request identity and GitHub authentication.

  function readInvitationHash() {
    const query = new URLSearchParams(window.location.search);
    let value =
      query.get('invitation') ||
      (window.location.search.includes('=')
        ? ''
        : window.location.search.slice(1));
    try {
      value = decodeURIComponent(value);
    } catch (_) {}
    return value.trim();
  }

  function requestHeaders() {
    const headers = { 'x-request-key': currentRequestKey };
    const token = storedSession();
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  function rememberRequest() {
    sessionStorage.setItem(
      'vibe-app-request',
      JSON.stringify({
        id: currentRequestId,
        key: currentRequestKey,
        invitation: invitationHash,
      }),
    );
  }

  async function startGitHubLogin() {
    loginButton.disabled = true;
    try {
      const browserKey = randomKey();
      sessionStorage.setItem('vibe-login-browser-key', browserKey);
      const response = await fetch(authEndpoint, {
        method: 'POST',
        headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          requestId: currentRequestId,
          browserKey,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      rememberRequest();
      location.assign(result.url);
    } catch (error) {
      resultMessage.textContent =
        error.message || 'Could not start GitHub login.';
      loginButton.disabled = false;
    }
  }

  async function restoreInvitationState() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const returningFromGitHub = fragment.has('login_ticket') || fragment.has('login_error');
    const saved = sessionStorage.getItem('vibe-app-request');
    sessionStorage.removeItem('vibe-app-request');
    if (returningFromGitHub && saved) {
      try {
        const value = JSON.parse(saved);
        if (value.invitation === invitationHash &&
            /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id || '') &&
            /^[a-f0-9-]{32,80}$/i.test(value.key || '')) {
          currentRequestId = value.id;
          currentRequestKey = value.key;
        } else {
          sessionStorage.removeItem('vibe-app-request');
        }
      } catch (_) {
        sessionStorage.removeItem('vibe-app-request');
      }
    }
    // Choose the screen before the first network request on OAuth return.
    form.hidden = Boolean(currentRequestId);
    resultPanel.hidden = !currentRequestId;
    if (currentRequestId) {
      loginButton.hidden = true;
      repositoryLink.hidden = true;
      resultMessage.textContent = 'Connecting your GitHub account...';
    }
    if (fragment.has('login_ticket')) {
      const ticket = fragment.get('login_ticket');
      history.replaceState(null, '', location.pathname + location.search);
      try {
        const response = await fetch(authEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'exchange',
            ticket,
            browserKey: sessionStorage.getItem('vibe-login-browser-key'),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        localStorage.setItem('vibe-github-session', result.token);
        sessionStorage.removeItem('vibe-login-browser-key');
      } catch (error) {
        showBanner(error.message || 'GitHub login failed. Please try again.');
      }
    } else if (fragment.has('login_error')) {
      history.replaceState(null, '', location.pathname + location.search);
      showBanner('GitHub login was cancelled or expired. Please try again.');
    }
    if (currentRequestId) pollInvitationStatus();
    else setButton('Create iOS app', false);
  }

  // Status polling and result screen.

  async function connectGitHubAfterCreation(result) {
    if (!result.creationOutcome || result.githubConnected || !storedSession()) {
      return result;
    }
    const response = await fetch(authEndpoint, {
      method: 'POST',
      headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', requestId: currentRequestId }),
    });
    const connection = await response.json();
    if (!response.ok) throw new Error(connection.error || 'Could not check GitHub access.');
    if (!connection.githubConnected) {
      localStorage.removeItem('vibe-github-session');
      return result;
    }
    return getInvitationStatus();
  }

  async function getInvitationStatus() {
    const response = await fetch(
      createAppEndpoint + '?requestId=' + encodeURIComponent(currentRequestId),
      { headers: { 'x-request-key': currentRequestKey }, cache: 'no-store' },
    );
    if (!response.ok) {
      const error = new Error('Could not check app status.');
      error.requestNotFound = response.status === 404;
      throw error;
    }
    return response.json();
  }

  function scheduleStatusPoll() {
    clearTimeout(statusPollTimer);
    statusPollTimer = setTimeout(pollInvitationStatus, 2500);
  }

  async function pollInvitationStatus() {
    if (!currentRequestId) return;
    const generation = requestGeneration;
    const requestId = currentRequestId;
    const isCurrent = () => generation === requestGeneration && requestId === currentRequestId;
    try {
      const savedResult = await getInvitationStatus();
      if (!isCurrent()) return;
      const result = await connectGitHubAfterCreation(savedResult);
      if (!isCurrent()) return;
      status.textContent = '';
      if (
        [
          'finished',
          'missing_invitation',
          'invalid_invitation',
          'invitation_limit',
        ].includes(result.status) || result.creationOutcome === 'failed'
      ) {
        showResult(result);
        return;
      }
      startButtonAnimation(
        result.attachmentStatus === 'uploading'
          ? 'Uploading files'
          : 'Creating app',
      );
      if (result.provisioningError)
        status.textContent = result.provisioningError;
    } catch (error) {
      if (!isCurrent()) return;
      if (error.requestNotFound) {
        clearTimeout(statusPollTimer);
        currentRequestId = null;
        currentRequestKey = null;
        sessionStorage.removeItem('vibe-app-request');
        status.textContent = '';
        resultPanel.hidden = true;
        form.hidden = false;
        setButton('Create iOS app', false);
        return;
      }
      // A temporary network error must not discard a saved request or its key.
      // Retry quietly; the existing form/result remains unchanged.
    }
    scheduleStatusPoll();
  }

  function showResult(result) {
    clearTimeout(statusPollTimer);
    status.textContent = '';
    stopButtonAnimation();
    form.hidden = true;
    resultPanel.hidden = false;
    const rejected = [
      'missing_invitation',
      'invalid_invitation',
      'invitation_limit',
    ].includes(result.status);
    if (rejected) {
      requestGeneration += 1;
      currentRequestId = null;
      currentRequestKey = null;
      sessionStorage.removeItem('vibe-app-request');
      resultPanel.hidden = true;
      form.hidden = false;
      loginButton.hidden = true;
      repositoryLink.hidden = true;
      saveDraft();
      const messages = {
        missing_invitation: 'An invitation is required. Your request has been saved.',
        invalid_invitation: 'This invitation is invalid. Your request has been saved.',
        invitation_limit: "You've reached the app limit. Your request has been saved.",
      };
      showBanner(messages[result.status]);
      setButton('Create iOS app', false);
      return;
    }
    const failed = result.creationOutcome === 'failed';
    document.getElementById('result-title').textContent = rejected
      ? 'Request saved'
      : failed ? 'Your repository is ready' : 'App successfully created!';
    document.getElementById('apple-email-message').hidden = rejected || failed;
    const accessReady = ['repository_invited', 'collaborator_present'].includes(result.accessStatus);
    loginButton.disabled = false;
    loginButton.hidden = rejected || result.githubConnected;
    repositoryLink.hidden =
      rejected || !result.githubConnected || !result.repositoryUrl || !accessReady;
    if (!repositoryLink.hidden) repositoryLink.href = result.repositoryUrl;
    const messages = {
      missing_invitation:
        'Your app name, prompt and files have been saved. An invitation is required before we can create your app.',
      invalid_invitation:
        'Your app name, prompt and files have been saved. This invitation is invalid. Please contact the app owner.',
      invitation_limit:
        'Your app name, prompt and files have been saved. This invitation has reached its limit. The app owner can resume this request.',
    };
    resultMessage.textContent = rejected
      ? messages[result.status]
      : result.githubConnected
        ? result.accessStatus === 'repository_invited'
          ? 'Your GitHub invitation has been sent. Accept it before opening the private repository.'
          : result.accessStatus === 'collaborator_present'
            ? 'Your repository is ready.'
            : 'Preparing your GitHub repository invitation...'
        : 'Log in with GitHub to receive an invitation to your repository.';
    if (failed) {
      resultMessage.textContent = 'Copilot could not complete your app. Your repository is saved and the process can be retried. ' + resultMessage.textContent;
    }
    if (
      !rejected &&
      result.githubConnected &&
      !accessReady
    )
      scheduleStatusPoll();
  }

  function createAnotherApp() {
    requestGeneration += 1;
    localStorage.removeItem(draftStorageKey());
    clearTimeout(statusPollTimer);
    currentRequestId = null;
    currentRequestKey = null;
    sessionStorage.removeItem('vibe-app-request');
    form.reset();
    invitationInput.value = invitationHash;
    selectedAttachments.forEach((item) => URL.revokeObjectURL(item.url));
    selectedAttachments = [];
    renderAttachments();
    resultPanel.hidden = true;
    form.hidden = false;
    hideBanner();
    status.textContent = '';
    fields.forEach((field) => field.wrapper.classList.remove('invalid'));
    setButton('Create iOS app', false);
    document.getElementById('email').focus();
  }

  // Shared UI feedback.

  function showBanner(message) {
    invitationError.textContent = message;
    invitationError.classList.add('visible');
  }

  function hideBanner() {
    invitationError.textContent = '';
    invitationError.classList.remove('visible');
  }

  function stopButtonAnimation() {
    if (buttonAnimationTimer) {
      window.clearInterval(buttonAnimationTimer);
      buttonAnimationTimer = null;
    }
    buttonAnimationBase = '';
  }

  function setButton(text, disabled) {
    stopButtonAnimation();
    submitButton.textContent = text;
    submitButton.disabled = disabled;
  }

  function startButtonAnimation(baseText) {
    if (buttonAnimationTimer && buttonAnimationBase === baseText) {
      submitButton.disabled = true;
      return;
    }
    stopButtonAnimation();
    buttonAnimationBase = baseText;
    submitButton.disabled = true;
    let dots = 1;
    const render = function () {
      submitButton.textContent = baseText + '.'.repeat(dots);
      dots = dots === 3 ? 1 : dots + 1;
    };
    render();
    buttonAnimationTimer = window.setInterval(render, 350);
  }

  initialize();
})();
