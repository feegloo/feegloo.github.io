Sentry.onLoad(function() {
  Sentry.init({
    dsn: "https://80c32dff6b98c61c03158dbf5202b885@o4507817217490944.ingest.de.sentry.io/4507817219457104",
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      Sentry.feedbackIntegration({
        colorScheme: "light",
        showBranding: false,
        isNameRequired: false,
        isEmailRequired: true,
        enableScreenshot: false,
        triggerLabel: "Wyślij wiadomość",
        formTitle: "Wyślij wiadomość",
        nameLabel: "Imię",
        namePlaceholder: "",
        emailPlaceholder: "",
        isRequiredLabel: "(wymagane)",
        messageLabel: "Wiadomość",
        messagePlaceholder: "",
        submitButtonLabel: "Wyślij",
        cancelButtonLabel: "Anuluj",
        successMessageText: "Wiadomość wysłana"
      }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.5,
    replaysOnErrorSampleRate: 1.0,
  });
});
