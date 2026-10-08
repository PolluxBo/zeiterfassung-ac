# Zeiterfassung AC

Web-App zur täglichen Stundenerfassung (Montag bis Freitag) für iPhone und iPad.

**App öffnen:** https://polluxbo.github.io/zeiterfassung-ac/

## Funktionen

- Wochenansicht Mo–Fr mit Tages- und Wochensummen
- Eintrag pro Kunde mit Zeitaufwand (15-Minuten-Schritte) und optionaler Notiz
- Zuletzt genutzte Kunden als Schnellauswahl
- Auswertung für einen Tag oder die ganze Woche als Excel-Datei (.xlsx), Versand über das Teilen-Menü an Mail
- Empfänger-Adresse und Name einmalig in den Einstellungen
- Datensicherung als JSON-Datei (sichern und wiederherstellen)
- Funktioniert offline

## Installation auf iPhone / iPad

1. Die App-Adresse in **Safari** öffnen.
2. Unten (iPad: oben rechts) auf **Teilen** tippen.
3. **„Zum Home-Bildschirm“** wählen und **Hinzufügen** tippen.

Die App startet danach wie eine normale App über das Symbol „Zeiterfassung AC“.

## Auswertung senden

1. Tag in der Wochenleiste wählen (oder „Ganze Woche“).
2. **Excel per Mail senden** tippen.
3. Im Teilen-Menü **Mail** wählen. Die Excel-Datei hängt an, die Empfänger-Adresse ist bereits kopiert und wird im Feld „An“ eingesetzt.

## Datenschutz

Alle Einträge werden nur lokal auf dem Gerät gespeichert. Es gibt keinen Server und kein Konto.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt. Excel-Export mit [SheetJS](https://sheetjs.com) (`vendor/xlsx.full.min.js`, Apache-2.0). Service Worker (`sw.js`) für den Offline-Betrieb. Nach Änderungen die Versionsnummer `CACHE` in `sw.js` erhöhen.
