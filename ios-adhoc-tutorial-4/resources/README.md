# Screenshoty tutorialu Ad Hoc

Przechodzimy ten tutorial samodzielnie, na własnym koncie Apple i repozytoriach GitHub. Materiały zbieramy po jednym kroku. Każdy slot ma stabilny `data-screenshot` i opis oczekiwanego ekranu. Nie twórz duplikatów certyfikatów dla screenów.

Po otrzymaniu obrazu zastąp `.screenshot-placeholder` w odpowiednim `figure` linkiem i obrazem, zachowując podpis. Przykład:

```html
<a href="resources/07-profile-type.png" target="_blank">
  <img src="resources/07-profile-type.png" alt="Wybór profilu Ad Hoc" loading="lazy">
</a>
```

Do publikacji używaj zanonimizowanych kopii. Bez sekretów, haseł, kluczy prywatnych, tokenów i pełnych UDID.

1. `02-existing-distribution.png`: Apple Distribution z rozwiniętym kluczem prywatnym. Zamazany identyfikator zespołu.
2. `03-certificate-1.png`: Apple Distribution z rozwiniętym kluczem prywatnym. Dane przykładowe.
3. `03-certificate-2.png`: Eksport certyfikatu i klucza do AppleDistribution.p12.
4. `03-certificate-3.png`: Hasło chroniące eksport .p12. Zapisz je do późniejszego użycia w CI.
5. `03-csr.png`: Formularz CSR: zapis na dysku, przykładowa nazwa i e-mail.
6. `03-apple-distribution.png`: Apple Developer: wybór Apple Distribution i wgranie CSR.
7. `04-appid.png`: App ID zgodny z Bundle ID projektu; właściwy zespół Apple.
8. `05-udid-finder.png`: Finder z wierszem UDID pod nazwą iPhone’a. UDID zamazany.
9. `05-udid-profile.png`: Pobrany profil Device UDID w Ustawieniach iOS.
10. `05-udid-result.png`: Wynik odczytu UDID w Safari. Identyfikator zamazany.
11. `06-register-device.png`: Formularz rejestracji urządzenia z zamazanym UDID.
12. `06-device-list.png`: Aktywny iPhone na liście Devices.
13. `07-profile-type.png`: Distribution → Ad Hoc na ekranie wyboru typu profilu.
14. `07-profile-appid.png`: Wybór właściwego App ID.
15. `07-profile-certificate.png`: Certyfikat Apple Distribution odpowiadający plikowi .p12.
16. `07-profile-devices.png`: Wybrane urządzenia dopuszczone do instalacji.
17. `07-profile-download.png`: Gotowy profil Ad Hoc i przycisk Download.
18. `08-signing-secrets.png`: Lista trzech nazw sekretów podpisywania, bez ich wartości.
19. `09-pages.png`: GitHub Pages: main, /(root) i rzeczywisty adres HTTPS strony.
20. `10-token-permissions.png`: Token ograniczony do repo strony, Contents: Read and write. Bez wartości tokenu.
21. `10-token-secret.png`: BUILDS_REPO_TOKEN na liście sekretów repo aplikacji.
22. `11-variables.png`: Cztery Variables w repo aplikacji, z przykładowymi wartościami.
23. `12-workflow-files.png`: Repo aplikacji z plikami workflow i scripts, bez sekretów w kodzie.
24. `13-run.png`: Run workflow dla Build and publish Ad Hoc, gałąź main.
25. `14-workflow-result.png`: Zakończony workflow i link do katalogu w podsumowaniu.
26. `14-pages-result.png`: Zakończona publikacja GitHub Pages.
27. `15-catalog.png`: Własna strona z ikoną aplikacji, wersją i Install.
28. `15-install.png`: Komunikat instalacji iOS po wybraniu Install w Safari.
29. `15-history.png`: Historia wersji tej samej aplikacji.
