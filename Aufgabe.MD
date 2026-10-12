Entwicklung eines energieeffizienten Messsystems zur Erfassung von Umwelteinflüssen
 
ATP2026/2027
 
Projektbeschreibung
 
Die kontinuierliche und präzise Erfassung von Umweltdaten bildet eine essenzielle Grundlage für vielfältige Analyse- und Optimierungsprozesse in modernen Infrastrukturen. Die spezifische Relevanz der Sensordaten variiert dabei je nach Anwendungsfall: Während in Gebäuden die Messung von Temperatur und Luftfeuchte primär der Charakterisierung des Raumklimas dient, erfordert die Bewertung des lokalen Außenklimas zusätzlich die Erfassung von Parametern wie Windgeschwindigkeit und Luftdruck. Darüber hinaus spielt die exakte Messung der Sonneneinstrahlung eine entscheidende Rolle für die zuverlässige Ertragsprognose von Photovoltaikanlagen.
 
Um diese diversen Szenarien mit einer einheitlichen technologischen Basis abzudecken, zielt das vorliegende Projekt auf die Entwicklung eines eigenständig operierenden und vielseitig einsetzbaren Loggersystems ab. 
 
Ein zentraler Fokus der Entwicklungsarbeit dieses ATP-Projektes liegt dabei auf der robusten, weiträumigen Vernetzung der Sensorknoten sowie auf einem energieeffizienten Design, das einen dauerhaft autarken Betrieb ohne externe Stromversorgung gewährleistet. Durch eine konsequent modulare Systemarchitektur wird zudem sichergestellt, dass die Hardware flexibel an zukünftige Anforderungen und zusätzliche Messparameter angepasst und erweitert werden kann.
 
Liefergegenstände / Projektablaufplan
 
Es wird ein modulares Logger-System, ähnlich Abbildung 2, entwickelt. Das Logger-System besteht aus mehreren Sensorköpfen zur Messung von jeweils ein oder mehreren Sensoren, die Messwert-Zwischenspeicherung und -Versendung sowie einem Server zum Empfang und dem Halten der Messdaten.
 
Generelles
 
| **Nr** | **Beschreibung** | **Muss / Soll / Kann** |
| --- | --- | --- |
| G01 | Zum Projekt- und Datenmanagemement werden folgende Tools verwendet: Ticketsystem  Planka mit Kanban-Board und Projektstrukturplan (Ansprechpartner OWetter) Projekt-Repo, Dokumentenspeicherung  GIT (Ansprechpartner FHeimann) Office-Tools  MSOffice nur für Texte und zum Zählen von Material oder Euro; NICHT jedoch für wissenschaftlich-numerische Zwecke Simulationen und Skript-Engines  Python Standard-Editor und Programmierumgebung  VSCode Systemmodellierungsdiagramme  UML mit Draw.io Skizzen und Zeichnungen  Draw.io CAD  Autodesk Fusion ECAD  KiCAD Compiler  gcc+gdb über VSCode/Debugger Container für Anwendungen  Docker, falls erforderlich Weitere Tools können nach Absprache und allseitiger Einigung eingeführt werden. | Muss |
| G02 | Im Kanban-Board wird ein agiles Ticket-System etabliert. Die Tickets bilden einen Projektstrukturplan mit drei Ebenen ab. Die Hauptebene benennt ein Teilprojekt. Die zweite Ebene detailliert die Hauptebene (Feature-Ebene). Die dritte Ebene nummeriert die Artefakte und Liefergegenstände (Task-Ebene). | Soll |
 
Sensorkopf und Messgrößen
 
| **Nr** | **Beschreibung** | **Muss / Soll / Kann** |
| --- | --- | --- |
| R01 | Der Sensorkopf dient zur Messung von jeweils ein oder mehreren Sensoren, zur Messwert-Zwischenspeicherung und zur -Versendung s | Muss |
| R02 | Messung der Lufttemperatur | Muss |
| R03 | Messung der Luftfeuchtigkeit | Muss |
| R04 | Messung des Luftdrucks | Muss |
| R05 | Konzept zur modularen Integration weiterer Sensoren | Muss |
| R06 | Das Der Sensorkopf soll ein GPS-Modul zur initialen Positionsbestimmung enthalten | Soll |
| R07 | Messung der Messung der Helligkeit bzw. der Einstrahlungsstärke des Sonnenlichts | Soll |
| R08 | Messung der Bodenfeuchte | Kann |
| R09 | Niederschlagsmessung | Kann |
| R10 | Windgeschwindigkeit und Windrichtung (z.B. Ultraschall-Anemometer) | Kann |
| R11 | Die Kombination aus Solarpanel und Akku soll den Betrieb auch während sonnenärmeren Wintermonaten ermöglichen | Muss |
| R12 | Energieeffizienz-/Deep-Sleep-Fähigkeit: Das Messsystem muss sehr stromsparend sein und z.B. zyklisch aufwachen, um Messungen durchzuführen | Muss |
| R13 | Bei einer Störung soll ein Hardware-Reset automatisch durchgeführt werden | Soll |
| R14 | Indoor kann statt der Solarzelle auch ein USB-C-Netzteil genutzt werden | Muss |
 
Datenvorverarbeitung und Datenübertragung auf dem Sensorkopf
 
| **Nr** | **Beschreibung** | **Muss / Soll / Kann** |
| --- | --- | --- |
| R20 | Für die energieeffiziente Funk-Datenübertragung über lange Strecken muss eine geeignete Technologie gewählt werden (z.B. LoRaWAN) | Kann |
| R21 | Das Netzwerk soll eine Mesh-Topologie unterstützen, um die Reichweite über mehrere Knoten zu erweitern | Kann |
| R22 | Bei Ausfall des Funk-Netzes müssen die Sensoren die Daten lokal puffern und bei Wiederherstellung der Verbindung nachträglich übertragen können. | Muss |
| R23 | Das Loggersystem muss in der Lage sein, Rohdaten zu aggregieren und beispielsweise Durchschnittsdaten, Min-/Max-Werte über ein Zeitfenster zu bilden | Muss |
| R24 | Das Loggersystem muss in der Lage sein, simple Berechnungen mit den Sensordaten durchzuführen | Muss |
| R25 | Das Sensorsystem erkennt selbstständig kritische Schwellwerte oder starke Gradienten und ändert dynamisch das Sendeintervall | Kann |
| R26 | Die Messwerte der Sensoren müssen validiert werden | Muss |
| R27 | Das Messystem muss sich nach einem Verbindungsabbruch selbstständig wieder mit dem Server verbinden. | Muss |
| R28 | Die Zeitbasen der Loggersysteme dürfen nicht mehr als 100 ms voneinander abweichen. | Muss |
 
Server
 
| **Nr** | **Beschreibung** | **Muss / Soll / Kann** |
| --- | --- | --- |
| R40 | Die Daten werden auf einem Server empfangen, zentral gesammelt und abgespeichert. | Muss |
| R41 | Der Server hat eine Schnittstelle zum Export der Daten | Muss |
| R42 | Die Messdaten (R02 .. R09) und Systemdaten (Akkustand, Solar-Ladeleistung, interne Gehäusetemperatur) der einzelnen Loggersysteme müssen versehen mit dem jeweiligen Zeitstempel gebündelt abgelegt werden. | Muss |
| R43 | Die Systemdaten der einzelnen Sensorsysteme müssen kontinuierlich überwacht werden und bei Störungen müssen diese über eine Schnittstelle ausgegeben werden | Muss |
 
Gehäuse und Umweltbeständigkeit
 
| **Nr** | **Beschreibung** | **Muss / Soll / Kann** |
| --- | --- | --- |
| R60 | Vollständiger Schutz gegen das Eindringen von Staub und starkem Regen (Erfüllung der Anforderungen IP67) | Muss |
| R61 | UV- und Temperaturbeständigkeit gegen Hitze und Frost | Muss |
| R62 | Belüftetes Gehäuse für Temperatur- und Feuchtesensoren, um Messfehler durch direkte Sonneneinstrahlung zu verhindern | Muss |
| R63 | Das Gehäuse unterstützt alle Funktionsaspekte hat also die (Muss-) Sensoren funktionsgerecht integriert, trägt die Solarzelle und Akkus, kann befestigt werden, … | Muss |
