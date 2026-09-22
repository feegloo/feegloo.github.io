# Screenshoty tutorialu 4

Po przejściu kroków zastąp blok `.screenshot-placeholder` w odpowiednim `figure[data-screenshot]` obrazem i linkiem, jak w tutorialu 2. Zachowaj podpis i dodaj alt. Nie publikuj sekretów, kluczy, haseł ani rzeczywistych UDID.

- `02-existing-distribution.png`: Apple Distribution z widocznym powiązanym kluczem prywatnym; dane zespołu zamazane.
- `03-certificate-1.png`: Apple Distribution z rozwiniętym kluczem prywatnym. Dane przykładowe.
- `03-certificate-2.png`: Eksport certyfikatu i klucza do AppleDistribution.p12.
- `03-certificate-3.png`: Hasło chroniące eksport .p12. Zapisz je do późniejszego użycia w CI.
- `04-secrets.png`: Lista nazw sekretów w centralnym repo. Bez wartości, hasła i zawartości .p12.
- `05-appid.png`: App ID zgodny z projektem; sprawdzony właściwy zespół Apple.
- `06-devices.png`: Aktywny iPhone na liście Devices; UDID zamazany.
- `07-api.png`: Team Keys: rola i nazwy pól Key ID oraz Issuer ID. Bez treści .p8.
- `08-profile-type.png`: Distribution → Ad Hoc na ekranie wyboru typu profilu.
- `08-profile-summary.png`: Podsumowanie profilu: App ID, Apple Distribution i urządzenia; identyfikatory zamazane.
- `09-github-permissions.png`: GitHub App: Actions, Contents i subskrypcja Workflow run.
- `09-github-installation.png`: Instalacja App obejmująca repo aplikacji, signer i repo strony.
- `11-run.png`: Run workflow dla Build Ad Hoc artifact na main.
- `12-signer.png`: Zakończone kroki centralnego signera i link do katalogu w podsumowaniu.
- `13-app-list.png`: Lista aplikacji Ad Hoc: ikony, nazwy, wersje i przyciski Install.
- `13-ios-confirmation.png`: Komunikat iOS potwierdzający instalację z Safari.
- `14-version-history.png`: Historia jednej aplikacji z możliwością instalacji konkretnego buildu.
