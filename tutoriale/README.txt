WSPÓLNE ZASOBY TUTORIALI iOS

style.css - układ, typografia, tabele, ilustracje, galerie, zakładki, prompt i wydruk.
app.js - kopiowanie prompta i dostępne z klawiatury zakładki systemów.

Każda część importuje ../tutoriale/style.css oraz ../tutoriale/app.js. Brak bundlera i zależności zewnętrznych.

Przycisk kopiowania: data-copy-target wskazuje id elementu z tekstem; data-copy-status wskazuje id komunikatu.
Zakładki: kontener data-tabs, przyciski role=tab z aria-controls wskazującym panel. Skrypt toleruje brak tych komponentów.

Dla części 3 użyj tych samych importów i klas. Nie kopiuj CSS ani JS do resources. Folder resources pozostaje na obrazki i zasoby konkretnej części.

prompt-zrodla.txt - wspólny fragment z linkami do trzech części. Jest już zawarty w promptach części 1 i 2; dodaj go również do prompta części 3 (TXT i HTML), gdy powstanie.
