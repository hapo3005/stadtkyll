# HOY Stadtkyll

**Region-2-Proof für HOY Gastro + HOY Lifestyle in Stadtkyll / Oberes Kylltal.**

Ziel dieses Repositories ist nicht, eine zweite unabhängige HOY-App zu entwickeln. Stadtkyll dient als kontrollierter Nachweis, dass der bestehende HOY-Core auf eine touristische Mikroregion außerhalb von La Manga übertragen werden kann.

## Produktfrage

> Was geht heute, jetzt und hier in Stadtkyll und Umgebung?

## V1-Scope

- HOY NOW / schnelle Entscheidung
- Gastro: heute geöffnet, Küche, Entfernung, Tages-/Live-Hinweise
- Lifestyle: Wandern, Rad, Natur, Familie, Regen, Ausflüge
- gemeinsame Karten- und Standortlogik
- regionale Daten als Konfiguration statt Hardcoding im UI
- mobile-first, PWA-fähig

## Region

Startcluster: Stadtkyll, Kerschenbach, Jünkerath, Kronenburg und das Obere Kylltal. Gerolstein ist zunächst Erweiterungsgebiet.

## Qualitätsregel

Öffnungszeiten, Live-Status und Verfügbarkeiten dürfen nicht als verifiziert erscheinen, wenn sie nur aus statischen Quellen stammen. Jede dynamische Information erhält Herkunft und Aktualitätsstatus.

## Architekturprinzip

Der HOY-Gastro-Core bleibt Referenz für Designsystem, App-Shell, Karten-/Standortlogik, Mehrsprachigkeit, Aktualitäts- und Trust-Logik. Lifestyle-spezifische Inhalte werden als regionale Datenmodelle ergänzt.

## Status

Bootstrap gestartet am 25.08.2026.