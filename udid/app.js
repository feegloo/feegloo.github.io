"use strict";
const endpoint = "https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/udid-service-301/profile";
const status = document.getElementById("status");
const storageKey = "udid-profile-session";
const result = new URLSearchParams(location.hash.slice(1));
const instructionImages = [
  "ios-downloaded-profile-settings.jpeg",
  "ios-downloaded-udid-profile.jpeg",
  "ios-install-udid-profile.jpeg",
  "ios-enter-device-passcode.jpeg",
  "ios-confirm-profile-installation.jpeg",
  "ios-udid-result-redacted.jpeg",
  "ios-remove-downloaded-profile.jpeg",
  "ios-security-delay-complete.jpeg",
  "ios-profile-downloaded-confirmation.jpeg",
];
const instructionImageAlts = {
  "ios-downloaded-profile-settings.jpeg": "Ekran Ustawień iOS z widoczną opcją Profil pobrany",
  "ios-downloaded-udid-profile.jpeg": "Ekran VPN i urządzenia zarządzane z widocznym pobranym profilem Odczyt UDID",
  "ios-install-udid-profile.jpeg": "Ekran instalowania profilu Odczyt UDID z wyróżnionym przyciskiem Instaluj",
  "ios-enter-device-passcode.jpeg": "Ekran iOS proszący o kod używany do odblokowywania iPhone'a",
  "ios-confirm-profile-installation.jpeg": "Potwierdzenie instalacji profilu Odczyt UDID",
  "ios-udid-result-redacted.jpeg": "Strona z odczytanym i zanonimizowanym UDID",
  "ios-remove-downloaded-profile.jpeg": "Ekran instalowania profilu z wyróżnionym przyciskiem Usuń pobrany profil",
  "ios-security-delay-complete.jpeg": "Powiadomienie iOS informujące o zakończeniu odliczania bezpieczeństwa",
  "ios-profile-downloaded-confirmation.jpeg": "Komunikat iOS Profil pobrany po ponownym pobraniu profilu",
};
const instructionImageHighlights = {
  "ios-downloaded-profile-settings.jpeg": {
    left: "4.7%",
    top: "39.7%",
    width: "90.6%",
    height: "5.8%",
  },
  "ios-downloaded-udid-profile.jpeg": {
    left: "3.8%",
    top: "39.1%",
    width: "92.3%",
    height: "8.1%",
  },
  "ios-install-udid-profile.jpeg": {
    left: "73.7%",
    top: "9.6%",
    width: "21.5%",
    height: "5.0%",
  },
  "ios-remove-downloaded-profile.jpeg": {
    left: "4.7%",
    top: "48.2%",
    width: "90.6%",
    height: "5.9%",
  },
};
const instructionCarousel = document.getElementById("instruction-carousel");
const instructionImage = instructionCarousel.querySelector(".instruction-image");
const profileHighlight = instructionCarousel.querySelector(".profile-highlight");
let instructionImageIndex = 0;
let instructionImageChanging = false;

function advanceInstructionImage() {
  if (instructionImageChanging) return;
  instructionImageChanging = true;
  profileHighlight.hidden = true;
  instructionCarousel.classList.add("is-changing");

  window.setTimeout(() => {
    instructionImageIndex = (instructionImageIndex + 1) % instructionImages.length;
    const fileName = instructionImages[instructionImageIndex];

    instructionImage.style.transition = "none";
    instructionImage.style.opacity = "0";
    instructionCarousel.classList.remove("is-changing");
    instructionImage.src = `images/${fileName}`;
    instructionImage.alt = instructionImageAlts[fileName];
    const highlight = instructionImageHighlights[fileName];
    profileHighlight.hidden = !highlight;
    if (highlight) {
      Object.entries(highlight).forEach(([property, value]) => {
        profileHighlight.style.setProperty(`--highlight-${property}`, value);
      });
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      instructionImage.style.removeProperty("transition");
      instructionImage.style.removeProperty("opacity");
      instructionImageChanging = false;
    }));
  }, 130);
}

instructionCarousel.addEventListener("click", advanceInstructionImage);
instructionCarousel.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  advanceInstructionImage();
});
// Clear the fragment before any further interaction. UDID is never stored by this script.
history.replaceState(null, "", location.pathname);
if (result.has("udid")) {
  try {
    const pending = JSON.parse(localStorage.getItem(storageKey) || "null");
    const udid = result.get("udid");
    if (!pending || pending.state !== result.get("state") || Date.now() - pending.created > 30 * 60 * 1000 || !/^(?:[A-F0-9]{8}-[A-F0-9]{16}|[A-F0-9]{40})$/.test(udid)) throw Error();
    localStorage.removeItem(storageKey);
    document.getElementById("start").hidden = true;
    document.getElementById("result").hidden = false;
    document.getElementById("udid").value = udid;
  } catch {
    status.textContent = "Sesja wygasła lub wynik otwarto w innej przeglądarce. Pobierz nowy profil w Safari.";
  }
}
document.getElementById("download").addEventListener("click", () => {
  try {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(storageKey, JSON.stringify({ state, created: Date.now() }));
    status.textContent = "Po pobraniu przejdź do Ustawienia → Profil pobrany → Instaluj.";
    location.assign(`${endpoint}?state=${state}`);
  } catch {
    status.textContent = "Nie można rozpocząć sesji. Otwórz stronę w Safari z dostępną pamięcią witryny.";
  }
});
document.getElementById("copy").addEventListener("click", async () => {
  const input = document.getElementById("udid");
  try { await navigator.clipboard.writeText(input.value); status.textContent = "Skopiowano UDID."; }
  catch { input.focus(); input.select(); input.setSelectionRange(0, input.value.length); status.textContent = "Przytrzymaj zaznaczony identyfikator i wybierz Kopiuj."; }
});
