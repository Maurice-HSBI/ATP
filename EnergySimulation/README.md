# Energiebilanz

React-/TypeScript-Anwendung zur Abschätzung von Verbrauch, Akku- und Solarbedarf eines LoRa-Messsystems.

## Hardware und Standardwerte

Hardwarebasis ist **ESP32-S3 + SX1262**, beispielsweise der **Heltec Wireless Stick Lite V3** (ohne OLED). RAK4631 steht im Projekt nicht zur Verfügung und wird nicht mehr als Profil angeboten.

Die Profile sind **Planungsannahmen, keine gemessenen oder garantierten Heltec-Boardwerte**. WLAN und Bluetooth bleiben aus; LEDs und externe Verbraucher müssen abgeschaltet beziehungsweise separat bilanziert werden.

| Parameter | Planung | Optimiert | Schlechtfall |
| --- | --- | --- | --- |
| Zusätzliche Board-Grundlast (Regler, Lade-IC etc.) | 100 µA | 20 µA (Zielwert) | 1.000 µA |
| MCU aktiv | 40 mA | 40 mA | 40 mA |
| MCU Deep Sleep (P2P) | 8 µA | 8 µA | 8 µA |
| MCU Light Sleep / Mesh-Standby | 240 µA | 240 µA | 240 µA |
| Aktiv je Messung, inklusive Wakeup-Budget | 500 ms | 500 ms | 500 ms |
| Aktiv je Sendung | 1.000 ms | 1.000 ms | 1.000 ms |
| SX1262 TX / RX / Sleep | 92 mA / 17 mA / 0,6 µA | wie Planung | 125 mA / 17 mA / 0,6 µA |
| Spreading Factor / RX nach TX | SF9 / 400 ms | SF7 / 400 ms | SF12 / 1.500 ms |

Board-Grundlast, MCU, Funk und Sensoren werden **addiert**, nicht doppelt als kompletter Board-Ruhestrom angesetzt. Mit BME680-Ruhestrom ergeben sich im Planungsprofil rund 108,75 µA Gesamt-Ruhestrom. Bei Messung alle 5 Minuten und Versand alle 30 Minuten berechnet das P2P-Modell rund **214,4 µA im Mittel bzw. 5,146 mAh/Tag**. Akku (3.000 mAh) und Solarannahmen bleiben unverändert.

P2P bleibt der Standardmodus; Mesh ist separat wählbar. Die 240 µA gelten nur als Light-Sleep-Annahme zwischen MCU-Aktivphasen, nicht als garantierter Verbrauch einer laufenden Mesh-Firmware. CPU-Zeit für Routing, RX-Verarbeitung, Synchronisation und Neustarts muss in den Aktivzeiten berücksichtigt und am Prototyp gemessen werden. Die 100 % RX im Mesh-Modus bleiben bewusst ein Dauerempfangs-Vergleichsfall, kein optimierter TDMA-Zeitplan.

Die Speicherung verwendet nun `energy-simulation-config-v2`. Alte RAK-Konfigurationen unter `energy-simulation-config-v1` bleiben erhalten, werden aber nicht automatisch geladen; dadurch greifen die neuen Hardware-Defaults auch in bereits verwendeten Browsern. Das gespeicherte Farbschema bleibt bestehen.

Hardwarequelle: [Heltec Wireless Stick Lite (ESP32-S3FN8 + SX1262, Datenblatt und Schaltplan)](https://docs.heltec.org/en/node/esp32/wireless_stick_lite/index.html). Die konkreten Strombudgets oben sind Schätzwerte und müssen am Akkuanschluss ohne USB-Versorgung validiert werden. Solar-Laderegler und Frost-Ladeschutz sind für das gewählte Board separat zu prüfen.

## Lokal ausführen

```shell
npm ci
npm run dev
```

Qualitätsprüfungen:

```shell
npm run lint
npm test
npm run build
```

## GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` prüft jeden Push und Pull Request. Nur ein erfolgreicher Lauf auf dem bei GitHub hinterlegten Default-Branch wird veröffentlicht.

Einmalig im GitHub-Repository unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** auswählen. Danach erfolgt das Deployment automatisch.

Der Befehl `npm run build:pages` erzeugt relative Assetpfade, sodass die Anwendung sowohl unter einer Projekt-URL als auch mit einer GitHub-Pages-Unique-Domain funktioniert.