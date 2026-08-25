# HOY Stadtkyll

**Region-2-Proof für HOY Gastro + HOY Lifestyle in Stadtkyll / Oberes Kylltal.**

Ziel dieses Repositories ist nicht, eine zweite unabhängige HOY-App zu entwickeln. Stadtkyll dient als kontrollierter Nachweis, dass der bestehende HOY-Core auf eine touristische Mikroregion außerhalb von La Manga übertragen werden kann.

## Produktfrage

> Was geht heute, jetzt und hier in Stadtkyll und Umgebung?

## Aktueller Scope

- HOY NOW / schnelle Entscheidung
- Gastro: aktuelle quellbasierte Öffnungszeiten mit klarer Trennung zu echten Live-Signalen
- Lifestyle: Wandern, Rad, Natur, Familie, Regen und erste Ziele im Startcluster
- interaktive OpenStreetMap-Karte mit Gastro-/Lifestyle-Filter
- Browser-Standort nur nach aktivem Klick; im Prototyp keine Speicherung
- regionale Daten als Konfiguration statt Hardcoding im UI
- saisonal gültige Zeitpläne im Datenmodell
- mobile-first, PWA-fähig
- automatischer Datenvertrag in CI: IDs, Quellen, Koordinaten, Zeitpläne und Trust-Kennzeichnung

## Region

Startcluster: Stadtkyll, Kerschenbach, Jünkerath, Kronenburg und das Obere Kylltal. Gerolstein bleibt zunächst Erweiterungsgebiet.

Der Datenstand 0.2.0 enthält 17 Seed-Einträge:
- 8 Gastro-Angebote
- 9 Lifestyle-Angebote
- erste Cluster-Erweiterung nach Jünkerath und Kronenburg

## Qualitätsregel

Öffnungszeiten, Live-Status und Verfügbarkeiten dürfen nicht als live-verifiziert erscheinen, wenn sie nur aus Websites, Tourismusportalen oder Branchenquellen stammen. Jede dynamische Information erhält Herkunft und Aktualitätsstatus.

Für zeitlich begrenzte Angaben kann zusätzlich ein Gültigkeitszeitraum (`scheduleValidFrom` / `scheduleValidTo`) hinterlegt werden.

## Architekturprinzip

Der HOY-Gastro-Core bleibt Referenz für Designsystem, App-Shell, Karten-/Standortlogik, Mehrsprachigkeit, Aktualitäts- und Trust-Logik. Lifestyle-spezifische Inhalte werden als regionale Datenmodelle ergänzt.

Die Region ist über `data/region.json` konfiguriert. Orte und Angebote liegen in `data/places.json`. Die UI kennt keine fest verdrahteten Stadtkyller Betriebe.

## Status

- 0.1.0: Bootstrap am 25.08.2026
- 0.2.0: echte Kartenansicht, Datenabdeckung und Data-Trust-Validierung
