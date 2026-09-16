"use strict";
const endpoint = "https://gwfdnwlhonszocjizrnl.supabase.co/functions/v1/udid-service/profile";
const status = document.getElementById("status");
const storageKey = "udid-profile-session";
const result = new URLSearchParams(location.hash.slice(1));
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
document.getElementById("clear").addEventListener("click", () => location.replace(location.pathname));
