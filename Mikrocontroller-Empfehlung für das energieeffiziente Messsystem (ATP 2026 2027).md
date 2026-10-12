# Mikrocontroller-Empfehlung für das energieeffiziente Messsystem (ATP 2026/2027)

Oct 12, 2026 · @Maurice

## Ausgangspunkt: RAK WisBlock Starter Kit (RAK19007 + RAK4631)

Das **RAK WisBlock Starter Kit** bleibt die Low-Power-Referenz und eignet sich für P2P, LoRaWAN oder ein eigenes Mesh-Protokoll. Ein Prototyp mit **LoRaMesher** benötigt nach aktuellem Stand jedoch **ESP32 + SX1262**, weil LoRaMesher FreeRTOS und die ESP32-Plattform voraussetzt. Die endgültige Controllerwahl ist deshalb wieder offen: RAK4631 bei eigener Portierung beziehungsweise eigenem Protokoll, ESP32 + SX1262 für den kurzfristig umsetzbaren LoRaMesher-Prototyp.

| Merkmal | Wert |
| --- | --- |
| Kit-Inhalt | 1× Base-Board RAK19007, 1× Core-Modul RAK4631 (Frequenzband vor Bestellung wählen, in Europa EU868) |
| Mikrocontroller | Nordic nRF52840, 32-Bit-ARM-Cortex, 64 MHz, Bluetooth 5 |
| Funk | Semtech SX1262 (LoRa / LoRaWAN) |
| Speicher | ca. 1 MB Flash, 256 KB RAM (nRF52840-Datenblatt, aus dem Gedächtnis, ungeprüft) |
| Sleep-Strom | ca. 2–3 µA auf Chip-Ebene (Schätzwert, auf dem Board selbst messen) |
| Sensor-Anschluss | Pro Base-Board 4 Sensor-Slots und 1 IO-Slot (I²C/SPI/UART über WisBlock-Module) |
| Stromversorgung | USB-C (Daten, Strom, Laden), Li-Ion/LiPo-Akku über JST-Stecker, Solar-Ladeeingang |
| Akku | Laut Helium-Doku mindestens 1024 mAh |
| Maße / Gewicht | 30 × 60 mm, 35 g (Starter Kit, laut Helium-Doku) |
| Firmware-Varianten | RUI3 (stromsparend) oder Arduino, bei der RAK4631-Bestellung wählbar |
| Toolchain | Arduino IDE, PlatformIO/VSCode, gcc |

**Hinweise:** Das Starter Kit hat nur das Base-Board und das Core-Modul. Sensoren (Temperatur/Feuchte/Druck, Licht, GPS) kommen als zusätzliche WisBlock-Module dazu, oder als I²C-Breakouts, die ihr anlöten könnt. Für den Frostbetrieb (R61, R11) muss die Ladetemperatur des Akkus geprüft werden, Li-Ion darf unter 0 °C nicht geladen werden.

## Systemarchitektur mit synchronem Mesh (R21)

R21 ist in der Aufgabenstellung ein Kann-Kriterium, wird wegen der unbekannten Entfernungen aber als Architekturtreiber behandelt. Ziel ist kein Mesh mit dauerempfangenden Spezialrelais, sondern ein **synchrones, duty-cycled LoRa-P2P-Mesh**. Alle Feldstationen sind baugleich, wachen in einem gemeinsamen Funkfenster auf und können in dieser Runde sowohl eigene Messwerte senden als auch adressierte Pakete anderer Stationen weiterleiten.

| Rolle | Aufgabe | Funkzustand | Versorgung |
| --- | --- | --- | --- |
| Messstation | Messen, Zeitstempel bilden, aggregieren und bei Bedarf als Next Hop weiterleiten | Außerhalb des gemeinsamen Funkfensters Schlaf; innerhalb zugewiesene RX-/TX-Slots | Akku und kleines Panel |
| ESP32 + SX1262 Bridge | Network Manager, Sync-Beacons, TDMA-Slots, Join und LoRa-Weiterleitung | Dauerhaft versorgt und für die geplanten Fenster verfügbar | USB/Netzteil oder separat ausgelegte Solaranlage |
| Raspberry Pi 4B | Lokaler Server mit Datenbank, MQTT/API, Export und Überwachung | Kein zeitkritisches LoRa-Routing | Netzteil oder große, separat dimensionierte Solaranlage |

Es gibt **keinen dauerhaften Umschalter „Leaf oder Router“**. Die gleiche Firmware läuft auf allen Messstationen. Wenn die eigene ID als `next_hop` in einem empfangenen Paket steht, puffert die Station das Paket und sendet es in ihrem nächsten Slot weiter. Ohne Transitpaket bleibt die Weiterleitungsfunktion ungenutzt.

### Automatische Routenbildung

1. Die Bridge sendet einen Sync-Beacon mit Gateway-ID und `hop_count = 0`.
2. Direkt erreichbare Stationen bestätigen die Verbindung und kennen damit eine Ein-Hop-Route.
3. Diese Stationen geben den Beacon in getrennten Hop-Slots mit erhöhtem Hop-Zähler weiter.
4. Eine entfernte Station wählt einen erreichbaren Nachbarn als Sponsor und später als Next Hop.
5. Routingtabellen vergleichen Hopzahl und Verbindungsqualität. Wird später eine bessere direkte Route verfügbar, wird sie automatisch bevorzugt.
6. Ohne direkten Gateway-Link und ohne eine durchgehende Kette gleichzeitig wacher Nachbarn entsteht eine Netzpartition; Software kann diese physische Funklücke nicht überbrücken.

Beispiel für ein weiterzuleitendes Datenpaket:

```text
origin_node_id       = Station B
final_destination    = Gateway
next_hop             = Station A
measured_at_utc_ms   = Zeitstempel der Messung
time_quality         = synchronized/holdover/unsynced
sync_age_ms          = Alter der letzten Synchronisation
cycle_id             = Messrunde
sensor_values        = Messwerte/Aggregate
```

`measured_at_utc_ms` wird **direkt beim Auslesen des Sensors** gebildet und gemeinsam mit den Sensorwerten übertragen. Gateway- und Server-Empfangszeit werden nur als zusätzliche Metadaten gespeichert und ersetzen den Messzeitstempel nicht. Eine neue Station, die noch nie einen Sync-Beacon empfangen hat, kennt ohne vorab gesetzte RTC keine belastbare UTC. In diesem Fall speichert sie einen lokalen/monotonen Zeitbezug mit `time_quality = unsynced`; sie darf die Daten nicht als 100-ms-genau kennzeichnen. Für absolute UTC im Offline-Betrieb muss die RTC bei der Inbetriebnahme gesetzt und ihre Drift charakterisiert werden.

### Ablauf einer synchronen Messrunde

1. Alle Stationen wachen mit einer Guard Time vor dem Funkfenster auf.
2. Die Bridge verteilt Rundennummer, Messzeit, Slotplan und Zeitsynchronisation per Beacon; Stationen leiten ihn Hop für Hop weiter.
3. Alle Stationen messen zum angekündigten Zeitpunkt und speichern Wert plus UTC-Zeitstempel.
4. Entfernte Stationen senden zuerst in ihren TDMA-Slots; baugleiche Zwischenstationen puffern und leiten später weiter.
5. Die Bridge übergibt die Pakete per USB/UART an den Raspberry Pi.
6. Nach persistenter Ablage meldet die Bridge fehlende Stationen; für sie folgen begrenzte Wiederholungsslots.
7. `ROUND_END` oder ein lokaler Timeout beendet das Fenster. Danach schlafen die Feldstationen wieder.

Bei 17 mA SX1262-RX-Strom ergibt sich für den reinen Empfang:

```latex
Q_{RX} = 17\,\mathrm{mA} \cdot 24\,\mathrm{h} \cdot D_{RX}
	= 408 \cdot D_{RX}\,\mathrm{mAh/Tag}
```

5 % RX-Anteil entsprechen damit 20,4 mAh beziehungsweise rund 75,5 mWh pro Tag nur für RX. MCU, Sensoren, TX und Board-Grundlast kommen hinzu. Der RX-Anteil ist kein frei gewählter Rabatt, sondern folgt aus Knotenzahl, Hopzahl, Slotdauer, Airtime, Kontrollverkehr und Wiederholungen.

### Neue Station und fehlgeschlagene Anmeldung

Messstationen starten als `NODE_ONLY`, damit sie niemals versehentlich ein zweites Netz gründen:

1. Die neue Station hört maximal zwei Stunden auf einen direkten oder weitergeleiteten Sync-Beacon.
2. Sie wählt Gateway oder erste erreichbare Sponsor-Station und sendet `JOIN_REQUEST` in einem zufälligen Discovery-Subslot.
3. Die Bridge prüft ID, geplante Join-Berechtigung und Kapazität, vergibt Kontroll- und Datenslots und antwortet direkt oder über den Sponsor.
4. Der neue Slotplan wird an der nächsten Superframe-Grenze verteilt. Die Station beginnt erst in der nächsten vollständigen, ausreichend synchronisierten Messrunde.
5. Mehrere neue Stationen verteilen ihre Versuche zufällig; zusätzliche Anfragen erhalten einen späteren Retry.

Zwei Stunden ununterbrochener RX kosten bereits:

```latex
Q_{Join,max} = 17\,\mathrm{mA} \cdot 2\,\mathrm{h} = 34\,\mathrm{mAh}
```

Nach zwei Stunden ohne Join speichert die Station `JOIN_TIMEOUT` und wechselt in den Offline-Logger-Modus: alle fünf Minuten aufwachen, messen, lokalen Zeitstempel samt Zeitqualität bilden, lokal puffern und wieder tief schlafen; LoRa bleibt aus. Ein begrenzter neuer Suchlauf erfolgt beispielsweise alle sechs Stunden oder per Statustaste.

Die Zwei-Stunden-Grenze, der Offline-Logger und die Retry-Strategie sind eigene Anwendungslogik oberhalb von LoRaMesher. Ebenso dürfen Geräteauthentisierung, Netzschlüssel, Replay-Schutz und Allowlist nicht als fertige LoRaMesher-Sicherheitsfunktionen vorausgesetzt werden; sie müssen separat spezifiziert und getestet werden.

Eine LED darf den Deep Sleep nicht durch vollständiges Aufwachen alle paar Sekunden zunichtemachen. Der Fehlercode wird einmal vor dem Schlafen, bei einem ohnehin nötigen Mess-Wakeup oder auf Tastendruck ausgegeben:

- 1× Rot: kein Beacon gefunden
- 2× Rot: Join abgelehnt oder falscher Netzwerkschlüssel
- 3× Rot: lokaler Speicherfehler
- Grün: Join erfolgreich

### Gateway und Raspberry-Pi-Server

Empfohlene Kette:

```text
LoRa-Messstationen <--- LoRa ---> ESP32 + SX1262 <--- USB/UART ---> Raspberry Pi 4B
					   |                                  |
				  Network Manager                    Datenbank, MQTT/API,
				  und TDMA-Bridge                    Export, Überwachung
```

Der Raspberry Pi 4B ist als lokaler Server sinnvoll, benötigt aber mehrere Watt und daher Netzversorgung oder eine separat ausgelegte große Solaranlage. Die ESP32-Bridge führt LoRaMesher und die zeitkritischen TDMA-Slots aus. Sie bestätigt eine Runde erst nach persistenter Ablage auf dem Pi oder in einer eigenen Ausfallwarteschlange; ein Internet-Ausfall darf das LoRa-Funkfenster nicht offenhalten.

Ein LoRa-Modul direkt am Pi ist grundsätzlich möglich, verlangt aber eine Linux-Portierung des Mesh-Protokolls, passende Treiber und Tests der Zeitplanung. LoRaMesher unterstützt derzeit ESP32/FreeRTOS, nicht den Raspberry Pi. Ein klassischer Arduino Uno/Nano reicht ebenfalls nicht; geeignet ist ein ESP32, der im Arduino-Framework oder mit PlatformIO programmiert wird. Bei einem Pi-HAT muss roher LoRa-P2P-Betrieb geprüft werden; ein reines LoRaWAN-Concentrator-HAT unterstützt das geplante Mesh nicht automatisch.

**Folgen für die Anforderungen**

- **Funktechnik (R20):** LoRaWAN ist ein Stern-Netz und liefert kein Mesh. Verwendet wird LoRa-P2P mit Routing und TDMA, zunächst LoRaMesher auf ESP32.
- **Mesh (R21):** Die Topologie wird im Betrieb gelernt. Alle Messstationen können dynamisch weiterleiten; dedizierte Relais sind nicht vorgesehen.
- **Zeit (R28):** Die Aufgabenstellung fordert höchstens **100 ms** Abweichung, nicht 30 s. Synchronisation und Guard Times müssen deshalb im Feld vermessen werden.
- **Puffern und Wiederverbinden (R22, R27):** Messwerte bleiben bei Join-, Routen- oder Serverausfall mit ihrem Messzeitstempel lokal gespeichert und werden später nachgeliefert.
- **Firmware:** LoRaMesher bietet inzwischen TDMA-Superframes, Multi-Hop-Sync und Schlafslots, nutzt auf ESP32 aber Light Sleep. Echter Deep Sleep startet den Controller neu und erfordert zusätzliches Wiederherstellen von Zeit- und Routingzustand.
- **RAK4631:** RUI3 bietet LoRa-P2P ohne Routing. Für diese Plattform wären eine Portierung, ein eigenes Protokoll oder eine andere Mesh-Firmware nötig.
- **Sicherheit:** Join-Berechtigung, Schlüsselverwaltung, Replay-Schutz und Firmware-Updates sind zusätzliche Arbeitspakete.

## Energiebilanz (nur Muss-Kriterien)

Mit nur Messen, Aggregieren und Senden liegt der Durchschnittsstrom bei etwa 74 µA (Planungsfall) und im Schlechtfall bei etwa 350 µA. Bei festen Sendeintervallen macht der Ruhestrom des Gesamtsystems 54–77 % der Energie aus, nicht das Senden.

**Einordnung:** Diese Rechnung bildet einen einzelnen RAK4631-Knoten mit kurzem RX-Fenster ab und ist damit eine Untergrenze beziehungsweise P2P-Referenz. Sync-Beacons, Kontrollslots, Join, Routingtabellen und das Weiterleiten fremder Pakete des synchronen Mesh sind noch nicht enthalten. Für die endgültige Dimensionierung muss der aus dem konkreten TDMA-Slotplan resultierende RX-/TX-Anteil addiert werden.

**Annahmen**

| Parameter | Wert | Herkunft |
| --- | --- | --- |
| Messintervall | alle 5 min (einstellbar), Temperatur, Feuchte, Druck | Vorgabe |
| Sendeintervall | alle 30 min fest, ein Paket mit Mittel/Min/Max aus 6 Messungen, ca. 20 Byte Nutzdaten (33 Byte Planungsframe; Mesh-Header kann abweichen) | Annahme |
| Controller aktiv | 5 mA, 0,3 s je Messung, 1 s je Senden | Annahme |
| Senden (TX) | 92 mA bei 17 dBm, 125 mA bei 20 dBm | RAK4631-Datenblatt |
| Empfangen (RX) | 17 mA, 0,4 s (Planung) bzw. 1,5 s (Schlechtfall) je Senden | Datenblatt (Strom), Annahme (Dauer) |
| Sendedauer (125 kHz, 33 Byte) | SF7 0,07 s, SF9 0,25 s, SF12 1,8 s | Berechnet, siehe unten |
| Ruhestrom Core allein | 2 µA | RAK4631-Datenblatt |
| Ruhestrom Gesamtsystem (Core + Base-Board + Sensor) | 20 µA optimiert, 50 µA Planung, 200 µA Schlechtfall | Annahme, Forum-Messungen reichen von ca. 7,6 µA (ohne Base-Board) über ca. 30–40 µA bis ca. 200 µA |
| Akkuspannung | 3,7 V | Annahme |

**Rechnung**

Die Ladung pro Tag setzt sich aus Ruhe, Messen und Senden zusammen (Ströme in mA, Zeiten in s, Ladung in mAs):

```latex
Q_{Tag} = Q_{Ruhe} + Q_{Messen} + Q_{Senden}
Q_{Ruhe} = I_{Ruhe} \cdot 86400
Q_{Messen} = N_{Mess} \cdot I_{akt} \cdot t_{Mess}
Q_{Senden} = N_{Send} \cdot \left( I_{TX} \, t_{Air} + I_{RX} \, t_{RX} + I_{akt} \, t_{Send} \right)
\bar{I} = \frac{Q_{Tag}}{86400} \qquad E_{Tag} = \frac{Q_{Tag}}{3600} \cdot 3{,}7\,\mathrm{V} \qquad C_{2\,Jahre} = \frac{Q_{Tag}}{3600} \cdot 730
```

Die Sendedauer folgt aus der Semtech-Formel für LoRa (Bandbreite 125 kHz, Coding Rate 4/5, 8 Präambelsymbole, CRC an, PL = 33 Byte, DE = 1 ab SF11):

```latex
T_{Air} = (8 + 4{,}25 + n_{Pay}) \cdot \frac{2^{SF}}{BW} \qquad n_{Pay} = 8 + \max\left( \left\lceil \frac{8 \, PL - 4 \, SF + 44}{4 \, (SF - 2 \, DE)} \right\rceil \cdot 5, \; 0 \right)
```

Rechenbeispiel Planungsfall (50 µA Ruhestrom, SF9, 48 Sendungen und 288 Messungen am Tag):

| Größe | Rechnung | Ergebnis |
| --- | --- | --- |
| Sendedauer SF9 | n\_Pay = 8 + ⌈272 / 36⌉ · 5 = 48, T = (8 + 4,25 + 48) · 4,096 ms | 0,247 s |
| Q\_Ruhe | 0,05 mA · 86400 s | 4320 mAs |
| Q\_Messen | 288 · 5 mA · 0,3 s | 432 mAs |
| Q\_Senden | 48 · (92 mA · 0,247 s + 17 mA · 0,4 s + 5 mA · 1 s) = 48 · 34,5 mAs | 1657 mAs |
| Q\_Tag | 4320 + 432 + 1657 | 6409 mAs = 1,78 mAh |
| Ø-Strom | 6409 mAs / 86400 s | 74,2 µA |
| Energie pro Tag | 1,78 mAh · 3,7 V | 6,6 mWh |
| Akku für 2 Jahre ohne Sonne | 1,78 mAh · 730 Tage | 1300 mAh |

**Ergebnis (Messen alle 5 min, Senden alle 30 min)**

| Szenario | Ø-Strom (µA) | Energie (mWh/Tag) | Akku für 2 Jahre ohne Sonne (mAh) | Anteil Ruhestrom |
| --- | --- | --- | --- | --- |
| Optimiert: 20 µA, SF7 | 34 | 3,05 | 600 | 58 % |
| Planung: 50 µA, SF9 | 74 | 6,6 | 1300 | 67 % |
| Planung, alle 15 min senden | 93 | 8,3 | 1640 | 54 % |
| Planung, alle 60 min senden | 65 | 5,7 | 1130 | 77 % |
| Schlechtfall: 200 µA, SF12, 20 dBm | 348 | 30,9 | 6090 | 58 % |

Das Base-Board (Lade-IC, Spannungsregler, Lastschalter) ist die größte Unbekannte und sollte als Erstes am echten Kit gemessen werden.

**Sendestrategie: fest oder nur bei Änderung**

Idee: Das Board misst alle 5 min, sendet aber nur, wenn sich ein Wert über eine Schwelle hinaus ändert, sonst nur einen Heartbeat alle 30 min (Low-Energy-Modus). Die Zahl der Sendungen am Tag ist 48 (Heartbeat) plus Anteil der Änderungen an den übrigen 240 Messungen. Gerechnet mit denselben Annahmen wie oben:

| Strategie | Sendungen/Tag | Ø-Strom Planung (µA) | Ø-Strom Schlechtfall (µA) | Akku 2 Jahre, Planung (mAh) |
| --- | --- | --- | --- | --- |
| Jede Messung senden (alle 5 min) | 288 | 170 | 1061 | 2980 |
| Alle 15 min | 96 | 93 | 490 | 1640 |
| Alle 30 min fest | 48 | 74 | 348 | 1300 |
| Bei Änderung (10 % der Messungen) plus Heartbeat | 72 | 84 | 419 | 1470 |
| Bei Änderung (30 % der Messungen) plus Heartbeat | 120 | 103 | 562 | 1800 |
| Nur messen, nie senden (Untergrenze) | 0 | 55 | 205 | 960 |

Bewertung: Gegenüber "jede Messung senden" spart die Änderungsschwelle im Planungsfall etwa 40–50 %. Gegenüber dem festen 30-Minuten-Takt spart sie nichts, sondern kostet 13–40 % mehr, liefert dafür aber schneller Änderungen. Unter 55 µA geht es wegen des Ruhestroms nie. Die Änderungsschwelle ist als R25 ein Kann-Kriterium und kommt deshalb in Phase 2. Wenn ihr sie umsetzt: Heartbeat beibehalten (der Server muss "unverändert" von "Sensor ausgefallen" unterscheiden, R43), Schwellen einstellbar machen (z. B. 0,5 K, 3 % rF, 1 hPa) und immer den Aggregatblock mit Messzeitstempel senden (R28). Die TTN-Fair-Use-Regel wäre nur für die verworfene LoRaWAN-Alternative relevant, nicht für das eigene P2P-Mesh; gesetzliche EU868-Duty-Cycle-Grenzen gelten weiterhin.

## Dimensionierung für 2 Jahre autark

Empfehlung: **Li-Ion/LiPo-Akku mit mindestens 3000 mAh** und ein **5-V-Solarpanel mit 1–2 W**. Mit Solar ist die Bilanz in allen Fällen positiv. Ohne jede Sonne wäre der Akku im Planungsfall knapp, weil auch Selbstentladung (Annahme 3 % pro Monat) an ihm zehrt.

**Akku**

```latex
C_{nutzbar} = 3000\,\mathrm{mAh} \cdot 0{,}8 = 2400\,\mathrm{mAh} \qquad t_{autark} = \frac{C_{nutzbar}}{Q_{Tag}/3600}
```

| Fall | Ladung pro Tag | Autarkie ohne Sonne (ohne Selbstentladung) |
| --- | --- | --- |
| Planung | 1,78 mAh | 2400 / 1,78 ≈ 1350 Tage |
| Schlechtfall | 8,34 mAh | 2400 / 8,34 ≈ 290 Tage |

**Solarertrag am Standort**

Grundlage ist die Einstrahlung in Nordalgerien: Für M'Sila (35,7° N) nennt eine Messreihe 242,5 MJ/m² im Dezember, das sind 242,5 / 31 Tage / 3,6 ≈ 2,17 kWh/m² pro Tag, im Jahresmittel etwa 4,8 kWh/m² pro Tag. Wald und Nordwand liefern nur einen Bruchteil davon, die Lichtanteile in der Tabelle sind Annahmen.

```latex
E_{Solar} = P_{Panel} \cdot H_{Dez} \cdot f_{Licht} \cdot \eta \qquad \text{mit } H_{Dez} = 2{,}17\,\tfrac{\mathrm{kWh}}{\mathrm{m^2 \cdot Tag}}, \; \eta = 0{,}6
```

Beispiel freie Fläche mit 1-W-Panel: 1 W · 2,17 h · 1,0 · 0,6 ≈ 1,3 Wh pro Tag.

| Standort im Dezember | Licht (Annahme) | Ertrag 1-W-Panel (mWh/Tag) | Faktor zum Schlechtfall (30,9 mWh/Tag) | Faktor zum Planungsfall (6,6 mWh/Tag) |
| --- | --- | --- | --- | --- |
| Freie Fläche | 100 % | 1300 | 42 | 198 |
| Nordwand oder lichter Wald | 10 % | 130 | 4,2 | 20 |
| Dichter Wald, Nordwand im Schatten | 5 % | 65 | 2,1 | 9,9 |

Selbst im dunklen Fall deckt ein 1-W-Panel den Planungsfall fast zehnfach. Für den Schlechtfall in dichtem Wald empfehle ich 2 W, damit Staub, Laub und Schnee nicht sofort die Bilanz kippen.

**Risiken, die die Rechnung nicht abbildet**

- **Ladeschwelle:** Das Base-Board lädt laut Meshtastic-Doku erst ab 4,4 V Panelspannung und verträgt maximal 5,5 V (RAK-Datenblatt). Im Schatten sackt die Spannung eines 5-V-Panels ab, dann fließt kein Ladestrom. Die Werte oben sind für dichten Wald deshalb optimistisch. Das Panel sollte eine Leerlaufspannung von höchstens 5,5 V haben.
- **Frost und Hitze:** Li-Ion/LiPo darf nicht unter 0 °C und nicht über etwa 45 °C geladen werden (aus dem Gedächtnis, ungeprüft). In Hochlagen mit Frost und in einem sonnenbeheizten Gehäuse in Algerien wird das relevant. Ob das RAK19007 eine Temperaturabschaltung hat, habe ich nicht gefunden.
- **LiFePO4 geht damit nicht:** Das Base-Board lädt Li-Ion/LiPo (Akkuspannung maximal 4,3 V). Für LiFePO4 bräuchtet ihr einen eigenen Laderegler, also ein eigenes PCB.
- **Zeitabgleich:** Für R28 reicht kein täglicher LoRaWAN-MAC-Abgleich. Das synchrone Mesh verteilt bei jedem Funkfenster einen Multi-Hop-Sync-Beacon; dessen RX/TX-Zeit und Guard Times müssen in die Mesh-Bilanz aufgenommen werden.

## Vergleich: Dauerempfang und synchrones RX-Fenster

Die frühere Relaisrechnung bleibt als Negativvergleich erhalten. Bei 17 mA SX1262-RX-Strom verbraucht eine Station im Dauerempfang 408 mAh beziehungsweise rund 1,51 Wh pro Tag. Ein 20-Ah-Pack mit 80 % nutzbarer Kapazität (16 Ah) hielte ohne Sonne nur etwa 39 Tage.

```latex
Q_{RX} = 17\,\mathrm{mA} \cdot 24\,\mathrm{h} \cdot D_{RX}
\qquad
P_{Panel} = \frac{E_{Tag}}{H_{Dez} \cdot f_{Licht} \cdot \eta}
```

| RX-Anteil | RX-Zeit pro 30-min-Runde | Nur RX (mAh/Tag) | Nur RX (mWh/Tag bei 3,7 V) |
| --- | --- | --- | --- |
| 100 % | 30 min | 408 | 1510 |
| 10 % | 3 min | 40,8 | 151 |
| 5 % | 90 s | 20,4 | 75,5 |
| 1 % | 18 s | 4,08 | 15,1 |

Nötige Panel-Nennleistung nur für den SX1262-RX-Anteil im Dezember (2,17 Peak-Sonnenstunden, 60 % Wirkungsgrad, ohne Reserve):

| RX-Fall | Freie Fläche (100 % Licht) | Lichter Wald/Nordwand (10 %) | Dichter Wald (5 %) |
| --- | --- | --- | --- |
| Dauerempfang | 1,16 W | 11,6 W | 23,2 W |
| 5 % RX | 0,058 W | 0,58 W | 1,16 W |

**Schlussfolgerungen**

- **Dauerempfang ist nicht das Zielsystem:** Er zeigt nur, warum ein unsynchronisiertes Mesh für die autarken Stationen ausscheidet.
- **Alle Stationen werden gleich ausgelegt:** Jede kann dynamisch weiterleiten. Die Dimensionierung muss daher den ungünstigsten erwarteten Slotanteil einer Station berücksichtigen, nicht eine separate Relais-Hardware.
- **5 % RX ist nur ein Beispiel:** LoRaMesher unterstützt power-optimierte TDMA-Superframes und Schlafslots; der tatsächliche Anteil wächst mit Knoten, Hops, Kontrollslots und Wiederholungen und muss aus dem Prototyp-Slotplan bestimmt werden.
- **Light Sleep statt garantiertem Deep Sleep:** LoRaMesher versetzt den ESP32 während SLEEP-Slots derzeit in Light Sleep. Ein echter Deep Sleep würde einen Neustart und das Wiederherstellen von Zeit- und Routingzustand erfordern.
- **20 Ah ist keine Standardforderung mehr:** Akku und Panel werden erst nach Messung des realen Board-Ruhestroms und des RX-/TX-Anteils festgelegt. Die Werte oben enthalten noch keine MCU-, Sensor-, TX- oder Boardlast.

**Zu beachten**

- Das Base-Board RAK19007 nimmt nur 5-V-Panels (maximal 5,5 V), der maximale Ladestrom ist nicht belegt. Für größere Panels ist wahrscheinlich ein externer MPPT-Laderegler und damit eigene Hardware nötig.
- Fertige Powerbanks schalten bei sehr kleiner Last oft ab (aus dem Gedächtnis, ungeprüft). Besser sind lose Zellen (z. B. 21700) mit Schutzschaltung.
- Ein großes Li-Ion-Pack altert in einem sonnenbeheizten Gehäuse schnell und ist ein Sicherheitsthema, das noch nicht bewertet ist.
- Die Einstrahlung gilt für horizontale Flächen in M'Sila. Ein geneigtes Panel bringt im Winter mehr, die Werte für freie Flächen sind also eher konservativ.

## Phase 1: Muss-Anforderungen

Phase 1 muss neben Messen, Aggregieren und Senden bereits den kritischsten Architekturpfad prüfen: synchrones LoRa-Mesh, Zeitstempel bei der Messung, lokales Puffern und automatischer Rejoin. GPS und SD-Karte können später folgen; ein ausreichend genauer Zeitgeber kann wegen R28 nicht pauschal in Phase 2 verschoben werden.

| Nr | Anforderung | Umsetzung im aktuellen Architekturstand | Status |
| --- | --- | --- | --- |
| R02–R04 | Temperatur, Feuchte, Druck | BME680 per I²C; als RAK1906 auf WisBlock oder als Breakout am ESP32, Gasheizer deaktiviert | Machbar |
| R05 | Modulare Sensoren | I²C/SPI/UART als gemeinsame Schnittstellen; WisBlock-Slots bei RAK, Steck-/Adapterkonzept bei ESP32 noch festlegen | Teilweise offen |
| R11 | Solar + Akku im Winter | Plattformabhängiger Laderegler; beim RAK19007 gelten 4,4–5,5 V Solareingang und Li-Ion/LiPo-Einschränkungen | Zu prüfen (Ladeschwelle, Frost) |
| R12 | Deep Sleep | LoRaMesher nutzt in SLEEP-Slots auf ESP32 Light Sleep. Echter Deep Sleep nur mit Wiederherstellung von Zeit/Routing; im Offline-Logger zwischen Messungen vorgesehen | Prototyp und Messung nötig |
| R14 | USB-C-Netzteil | RAK19007 beziehungsweise geeignetes ESP32-Board mit USB-C | Boardabhängig machbar |
| R22 | Lokal puffern | Messwert plus `measured_at_utc_ms`, `time_quality`, `sync_age_ms` und `cycle_id` in Flash/FRAM; auch nach zwei Stunden Join-Timeout weiter messen | Eigenleistung |
| R23, R24 | Aggregation, Berechnungen | Eigener C/C++-Code (Mittel, Min, Max über 6 Messungen) | Eigenleistung |
| R26 | Messwerte validieren | Eigener Code (Plausibilitätsgrenzen, Sprungerkennung) | Eigenleistung |
| R27 | Automatisch neu verbinden | `NODE_ONLY`-Discovery, Sponsor-Join, zufällige Discovery-Subslots, Retry; nach 2 h Offline-Logger und periodischer neuer Suchlauf | Protokolltest nötig |
| R21 | Mesh-Topologie (Kann, als Architekturtreiber behandelt) | LoRa-P2P mit dynamischem Next Hop und TDMA; zunächst LoRaMesher auf ESP32 + SX1262 | Prototyp festgelegt, Feldtest offen |
| R28 | Zeitbasen höchstens 100 ms auseinander | Sync-Beacon in jedem Funkfenster; UTC-Zeitstempel direkt beim Sensor-Auslesen; Empfangszeiten nur Zusatzmetadaten | Kritisch, nachmessen |
| R40–R43 | Server | ESP32 + SX1262 als Network Manager/USB-Bridge; Raspberry Pi 4B mit Datenbank, MQTT/API, Export und Überwachung | Architektur festgelegt, Implementierung offen |
| R60–R63 | Gehäuse | Nicht Teil des Kits | Extern |

**Zu R28:** Zwei Uhren mit jeweils 20 ppm können nach 30 Minuten relativ bereits um bis zu 72 ms auseinanderliegen:

```latex
\Delta t_{rel} = 2 \cdot 20\,\mathrm{ppm} \cdot 1800\,\mathrm{s} = 72\,\mathrm{ms}
```

Damit bleiben nur 28 ms Reserve für Temperaturdrift, Wake-up-Jitter und Synchronisationsfehler. Bei 100 ppm wären es 360 ms. Deshalb sind Sync bei jedem Funkfenster, ein charakterisierter Quarz beziehungsweise eine geeignete RTC und Messungen über Temperatur nötig. Ob der konkrete ESP32- oder RAK-Aufbau die 100 ms einhält, ist noch nicht belegt.

## Phase 2: Soll- und Kann-Anforderungen

Diese Punkte werden erst nach einem laufenden Phase-1-Prototyp einzeln bewertet, jeweils mit Blick auf den Energiebedarf.

| Nr | Anforderung | Priorität | Hinweis zu Umsetzung und Energie |
| --- | --- | --- | --- |
| R13 | Automatischer Hardware-Reset | Soll | Interner Watchdog (`api.system.wdt.enable()`), kostet kaum Energie, kann früh dabei sein |
| R06 | GPS-Modul | Soll | Nur für initiale Position (R06). Bei festem Standort kann die Position auch im Server eingetragen werden, das spart Modul und Strom |
| R07 | Helligkeit/Einstrahlung | Soll | Lichtsensor-Modul (RAK1903 oder RAK12010), kleiner Zusatzstrom, Slots sind frei |
| R08 | Bodenfeuchte | Kann | RAK12035 mit Adapter RAK12023 |
| R09 | Niederschlag | Kann | RAK12005 oder Kippwaage, Datenblatt prüfen |
| R10 | Wind | Kann | Externer Sensor über RS485 (RAK5802) oder SDI-12 (RAK13010), Sensor braucht oft eigene Versorgung |
| R20 | Funktechnologie | Kann | Für den Mesh-Prototyp LoRa-P2P mit LoRaMesher; kein LoRaWAN-Netzwerkserver |
| R25 | Sendeintervall dynamisch ändern | Kann | Konfigurationspaket vom Gateway in einem geplanten Slot; Werte authentisieren, persistent speichern und Timer sicher neu planen |
| – | SD-Karte | Keine Anforderung | Lokale Zusatzspeicherung, Schreibzugriffe kosten Energie, erst bei Bedarf (R22) |
| – | RTC/genauer Zeitgeber | Architekturunterstützung | Wegen R28 und Wake-Schedule bereits in Phase 1 prüfen; Auswahl abhängig von gemessener Board-Drift |
| – | Zweifarb-LED + Statustaste | Diagnose | Kurze Codes bei vorhandenem Wake-up oder auf Tastendruck; kein ESP32-Wakeup alle paar Sekunden nur zum Blinken |

## Mögliche Sensoren

Für die Muss-Messgrößen (R02–R04) gibt es fertige WisBlock-Module, die ihr ohne Löten in einen der 4 Sensor-Slots steckt. Für Wind und Niederschlag (R09, R10) fehlt ein passendes Standardmodul, hier braucht ihr externe Sensoren.

| Messgröße | Anforderung | WisBlock-Modul (Chip) | RUI3-Beispiel |
| --- | --- | --- | --- |
| Temperatur, Feuchte | R02, R03 | RAK1901 (Sensirion SHTC3) | Vorhanden |
| Temperatur, Feuchte, Druck, Gas | R02–R04 | RAK1906 (Bosch BME680) | Vorhanden |
| Luftdruck | R04 | RAK1902 (ST-Drucksensor) | Vorhanden |
| Umgebungslicht | R07 | RAK1903 (TI OPT3001, 0,01–83865 lux) | Vorhanden |
| Umgebungslicht | R07 | RAK12010 (Vishay VEML7700) | Vorhanden |
| Umgebungslicht | R07 | RAK12020 (AMS TSL25911FN) | Nicht geprüft |
| UV-Licht | R07 | RAK12019 (UV-Sensor) | In Arbeit |
| GPS/GNSS | R06 | RAK1910 (u-blox MAX-7Q, GPS und GLONASS) | Vorhanden |
| Bodenfeuchte und -temperatur | R08 | RAK12035 mit Adapter RAK12023 | In Arbeit |
| Niederschlag | R09 | RAK12005 (Rain Sensor Module) | Nicht geprüft |
| Wind | R10 | Kein WisBlock-Sensor, extern über RS485 (RAK5802) oder SDI-12 (RAK13010) | Nicht geprüft |
| Akku- und Ladestrom | R42 | RAK16002 (Coulomb-Sensor) | Nicht geprüft |

**Startbestückung:** In Phase 1 nur BME680 für Temperatur, Feuchte und Druck: RAK1906 auf WisBlock oder ein BME680-Breakout am ESP32-Prototyp. Lichtsensor und GPS folgen in Phase 2; konkrete Module hängen von der finalen Controllerplattform ab.

**Zu beachten:**

- **Einstrahlung (R07):** Lichtsensoren messen Helligkeit in Lux, nicht die Einstrahlungsleistung in W/m². Für die Ertragsprognose von Photovoltaik wäre ein Pyranometer oder eine Referenzzelle nötig (aus dem Gedächtnis, ungeprüft). Lux reicht als Näherung.
- **Niederschlag (R09):** Im Datenblatt prüfen, ob RAK12005 Regenmenge oder nur Regen erkennt. Für Mengen eignet sich ein Kippwaagen-Regenmesser.
- **Wind (R10):** Ein Ultraschall-Anemometer mit RS485-Ausgang lässt sich über das Interface-Modul RAK5802 anbinden.
- **Gehäuseklima (R62, R42):** Für die interne Gehäusetemperatur braucht ihr einen zweiten Temperatursensor im Gehäuse, getrennt vom belüfteten Außensensor.
- **Adresskonflikte:** Vor dem Kombinieren mehrerer Module die I²C-Adressen auf Konflikte prüfen (laut RAK-Doku), sonst hilft ein I²C-Multiplexer.
- **Stromverbrauch:** Einige WisBlock-Sensormodule lassen sich vom Core-Modul ein- und ausschalten, das hilft beim Deep Sleep (R12).

## Variante: ESP32 + SX1262 (LoRaMesher)

Da LoRaMesher RadioLib und FreeRTOS nutzt und derzeit auf ESP32 zielt, ist ESP32 + SX1262 die schnellste Plattform für den synchronen Mesh-Prototyp. Die aktuelle LoRaMesher-Version bietet TDMA-Superframes, Network-Manager-Wahl, Sponsor-Join, Multi-Hop-Sync, dynamische Routingtabellen und SLEEP-Slots. Geeignete Boards sind beispielsweise ESP32-S3/C6 mit SX1262; die konkrete Boardwahl und der Ruhestrom müssen gemessen werden.

| Option | Mesh | Energie | Bewertung |
| --- | --- | --- | --- |
| **ESP32 (S3/C6) + SX1262** | LoRaMesher läuft nativ; jede Station kann dynamisch routen | Aktiv höher als nRF52840; LoRaMesher nutzt in SLEEP-Slots Light Sleep | Bevorzugt für den homogenen Mesh-Prototyp |
| **ESP8266** | Kein LoRa-Funk, nur WLAN, LoRa nur über externes SPI-Modul, kein Support in LoRaMesher | Aufwachen und Verbinden kostet viel, kein BLE | Nicht empfohlen |
| **RAK4631 (nRF52840) mit RUI3** | Nur LoRa-P2P, Routing und TDMA selbst entwickeln oder portieren | Sehr niedriger Ruhestrom und gutes Sensor-Ökosystem | Low-Power-Referenz; nicht direkt kompatibel mit LoRaMesher |

**Ruhestrom der ESP32-Boards:** In Foren heißt es, die meisten ESP32-LoRa-Boards ziehen im Tiefschlaf mA statt µA. Für den Heltec Wireless Stick Lite werden 30 µA angegeben, für den Heltec V3 laut Datenblatt 10 µA, gemessen oft mehr. Ein Board muss deshalb vor der Wahl nachgemessen werden.

**Grobe P2P-Untergrenze für einen ESP32-Sensorknoten** (Annahmen: 30 µA Ruhe, 40 mA aktiv, 0,5 s je Aufwachen wegen Boot, sonst wie im Planungsfall, nicht gemessen; Mesh-Kontroll- und Weiterleitungsverkehr fehlt):

| Größe | Rechnung | Ergebnis |
| --- | --- | --- |
| Q\_Ruhe | 0,03 mA · 86400 s | 2592 mAs |
| Q\_Messen | 288 · 40 mA · 0,5 s | 5760 mAs |
| Q\_Senden | 48 · (92 mA · 0,247 s + 17 mA · 0,4 s + 40 mA · 1 s) = 48 · 69,5 mAs | 3337 mAs |
| Q\_Tag | Summe | 11689 mAs = 3,25 mAh |
| Ø-Strom | 11689 mAs / 86400 s | 135 µA |
| Energie pro Tag | 3,25 mAh · 3,7 V | 12,0 mWh |

Das ist etwa das 1,8-Fache des RAK4631 im Planungsfall (74 µA, 6,6 mWh). Der Mehrverbrauch entsteht vor allem durch das Aufwachen alle 5 Minuten, wegen der Bootzeit des ESP32. Mit weniger Aufwachen (z. B. nur alle 10 oder 15 Minuten messen) oder schneller Boot-Konfiguration sinkt er.

**Dauerempfang als obere Referenz:** Ein komplettes ESP32-LoRa-Board kann im Dauerempfang grob 50 mA benötigen (Annahme), also etwa 1200 mAh beziehungsweise 4,4 Wh pro Tag. Das Zielsystem darf diesen Zustand an Feldstationen nicht dauerhaft verwenden. Der reale Bedarf ergibt sich aus Light Sleep, Sync-, Kontroll-, Daten- und Weiterleitungsslots.

**Zwischenfazit:** Für einen kurzfristigen LoRaMesher-Prototyp müssen alle dynamisch routenden Messstationen denselben kompatiblen ESP32/SX1262-Stack verwenden. Eine Mischung aus RAK-RUI3-Endpunkten und LoRaMesher-Routern funktioniert nicht ohne eigenes gemeinsames Funkprotokoll. Der RAK4631 bleibt interessant, wenn die Portierung oder ein eigenes TDMA-Mesh den Entwicklungsaufwand rechtfertigt. Meshtastic auf RAK4631 ist eine weitere, noch praktisch zu prüfende Alternative, bietet aber nicht automatisch denselben synchronen Messablauf.

## Alternativen

Der RAK4631 bleibt die ursprüngliche Low-Power-Referenz; für den LoRaMesher-Prototyp ist ESP32 + SX1262 vorgesehen. Die folgenden Optionen dienen als Vergleich, falls später eine Portierung oder ein eigenes, energieoptimiertes PCB nötig wird, z. B. mit dem **STM32WLE5**.

| Option | Stärken | Schwächen |
| --- | --- | --- |
| **nRF52840 + SX1262** (z. B. RAK4631 / WisBlock) | Sehr niedriger Sleep-Strom (\~2–3 µA), viel Flash/RAM, steckbares Sensor-Ökosystem (BME680, Licht, GPS) passt zum Modularitätsgedanken, Meshtastic-Support | Zwei Chips (MCU + Radio), etwas höhere Kosten |
| **ESP32-S3/C6 + SX1262** (Heltec V3, LilyGO T-Beam) | Sehr viel Rechenleistung, riesiges Ökosystem, WLAN/BLE als Zusatz | Deep Sleep auf Boardebene meist deutlich höher (10–100 µA), höherer Aktiv-Strom, Solar-/Akku-Auslegung kritischer |
| **Semtech LR1110/LR1121** + beliebige MCU | Integriertes GNSS-Scanning (R06) | Zusatzkosten und Komplexität |

## Wichtige Punkte aus den Anforderungen

1. **R28 (Zeitabweichung ≤ 100 ms):** Zeitstempel entstehen direkt bei der Messung. Sync-Beacons bei jedem Funkfenster, RTC/Quarz-Drift und Wake-up-Jitter müssen praktisch nachgewiesen werden; ein täglicher Abgleich genügt nicht als Beleg.
2. **R21 (Mesh):** LoRaWAN ist sternförmig. Der Entwurf nutzt LoRa-P2P mit synchronem TDMA und dynamischem Next Hop. Alle Messstationen sind baugleich und können weiterleiten.
3. **R61 (Frost) und R11 (Winterbetrieb):** Li-Ion-Akkus dürfen unter 0 °C nicht geladen werden. **LiFePO4** wäre meist besser, braucht aber einen eigenen Laderegler (z. B. BQ25185 oder CN3791). Das Base-Board lädt nur Li-Ion/LiPo.
4. **Server (R40–R43):** ESP32 + SX1262 als zeitkritische LoRa-/TDMA-Bridge, per USB/UART an einen Raspberry Pi 4B mit Datenbank, MQTT/API, Export und Überwachung. ChirpStack/TTN entfallen.
5. **Join und Ausfall:** Neue Station als `NODE_ONLY`; nach maximal zwei Stunden ohne Join Offline-Logger, lokale Messung mit UTC-Zeitstempel und begrenzte spätere Retries.
6. **Sensoren per I²C:** BME280/BME680 oder BMP390 (Temperatur, Feuchte, Druck), SHT45 (genauere Feuchte), VEML7700 oder OPT3001 (Licht/Einstrahlung). Auf eindeutige I²C-Adressen achten oder einen I²C-Multiplexer wie den TCA9548A nutzen.
7. **R13:** Ergänzend zum internen Watchdog kann ein externer Timer wie der TPL5010 den Controller bei Hängern hart zurücksetzen und verbraucht nur etwa 35 nA.

## Mögliche nächste Schritte

- [x] Stromverbrauchs-Simulation für P2P, Mesh-RX-Anteil, Akku und Solar erstellen
- [ ] Blockschaltbild für Messstation, ESP32-Bridge und Raspberry Pi 4B erstellen

* [ ] Ruhestrom des Gesamtsystems messen (Core, Base-Board, BME680), Ziel unter 50 µA
* [ ] Zeitgeber der ausgewählten ESP32- und RAK-Boards prüfen und Drift über Temperatur messen
* [ ] Solarpanel mit Leerlaufspannung unter 5,5 V testen, Ladeverhalten im Schatten beobachten

- [x] Mesh-Knotenrollen festlegen: baugleiche Messstationen mit dynamischer Weiterleitung, keine dedizierten Relais
- [x] LoRaMesher-TDMA, Multi-Hop-Sync, Join und SLEEP-Slots anhand der aktuellen Dokumentation prüfen
- [ ] Prototyp mit mindestens 3–5 ESP32/SX1262-Knoten und erzwungenem Multi-Hop aufbauen
- [ ] Light-Sleep-, RX-, TX- und Gesamtstrom eines konkreten ESP32-LoRa-Boards messen
- [ ] 100-ms-Zeitabweichung über mehrere Hops und Temperatur praktisch nachweisen
- [ ] RTC vor Inbetriebnahme setzen und Verhalten von `time_quality`/`sync_age_ms` im Offline-Betrieb testen
- [ ] Sponsor-Join, mehrere gleichzeitige Joins, Zwei-Stunden-Timeout und Offline-Logger testen
- [ ] Join-Authentisierung, Netzschlüssel, Allowlist und Replay-Schutz spezifizieren und testen
- [ ] ESP32-USB/UART-Bridge mit Raspberry Pi 4B und persistenter Empfangsbestätigung implementieren
- [ ] Zweifarb-LED, Statustaste und Fehlercodes mit minimalem Energiebedarf testen

## Quellen

- [RAK Store: WisBlock Starter Kit](https://store.rakwireless.com/products/wisblock-starter-kit)
- [RAK Doku: WisBlock IoT Starter Kit](https://docs.rakwireless.com/product-categories/wisblock/kit1-iot-starter/overview/)
- [Helium Doku: WisBlock Starter Kit RAK4631](https://docs.helium.com/network-iot/devices/development/rakwireless/wisblock-4631)
- [RUI3 Release Note v4.1.1 (Watchdog, Zeitabfrage, P2P-API)](https://docs.rakwireless.com/release-notes/rui3/2024/v4.1.1)
- [RUI3 Release Note v4.2.4](https://docs.rakwireless.com/release-notes/rui3/2026/v4.2.4/)
- [RAK Anleitung: Downlinks mit RUI3](https://learn.rakwireless.com/hc/en-us/articles/29822137743255-how-to-use-downlinks-from-the-lorawan-server-to-change-device-settings-with-rui3)

* [RAK Store: WisBlock Sensor Modules](https://store.rakwireless.com/products/wisblock-sensor-modules)
* [RAK: WisBlock Sensoren (RAK1901, RAK1902, RAK1903, RAK1904, RAK1906, RAK1910)](https://rakwireless.com/en-us/company/wisblock-series/wisblock-sensors)
* [RAK Doku: WisBlock Agriculture Kit (RAK12010, RAK12035, RAK5802, RAK13010)](https://docs.rakwireless.com/product-categories/wisblock/kit7-agriculture/datasheet/)
* [GitHub: RUI3-Sensor-Node (unterstützte Sensoren)](https://github.com/beegee-tokyo/RUI3-Sensor-Node)

- [RAK Doku: RAK4631 Datenblatt (Stromwerte)](https://docs.rakwireless.com/product-categories/wisblock/rak4631/datasheet/)
- [RAK Doku: RAK19007 Datenblatt (Solar- und Akkuanschluss)](https://docs.rakwireless.com/product-categories/wisblock/rak19007/datasheet/)
- [Meshtastic Doku: WisBlock Base Boards (Ladespannung Solar 4,4–5,5 V)](https://meshtastic.org/docs/hardware/devices/rak/base-board)
- [RAK Forum: RAK4631 Stromverbrauch im Schlafmodus](https://forum.rakwireless.com/t/rak4631-power-consumption/10259)
- [RAK Forum: Excessive Current Consumption in Blank Sketch](https://forum.rakwireless.com/t/excessive-current-consumption-in-blank-sketch/4259)
- [Univ. M'Sila: Solarenergie in M'Sila (Einstrahlung)](https://repository.univ-msila.dz/handle/123456789/30469)

* [LoRaMesher: An open-source library for multi-hop LoRa mesh networks (SoftwareX)](https://www.sciencedirect.com/science/article/pii/S2352711026000646)
* [GitHub: LoRaMesher (aktuelle Implementierung)](https://github.com/LoRaMesher/LoRaMesher)
* [LoRaMesher Protocol Specification (TDMA, Sync, Join, Sleep)](https://github.com/LoRaMesher/LoRaMesher/blob/main/PROTOCOL_SPEC.md)
* [LoRaMesher Battery-Optimized Example](https://github.com/LoRaMesher/LoRaMesher/tree/main/examples/battery_optimized_example)
* [TTN Forum: ESP32-LoRaWAN-Board für Batteriebetrieb](https://www.thethingsnetwork.org/forum/t/is-there-a-esp32-lorawan-board-for-battery-operation/35266)
* [Meshtastic Forum: Heltec V3 Deep Sleep](https://meshtastic.discourse.group/t/heltec-v3-shutdown-light-versus-deep-sleep/9930)
