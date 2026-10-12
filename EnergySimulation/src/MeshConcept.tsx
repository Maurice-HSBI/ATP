import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Info,
  Moon,
  Pause,
  Play,
  RadioTower,
  RefreshCw,
  Route,
  Server,
  ShieldAlert,
  TimerReset,
  TriangleAlert,
  Wifi,
} from 'lucide-react'

const phases = [
  {
    id: 'sleep',
    short: 'Schlaf',
    title: 'Energiesparphase',
    description:
      'Sensorknoten und Funk schlafen bis zur vereinbarten nächsten Runde. Nur Zeitgeber und notwendige Grundlast bleiben aktiv.',
  },
  {
    id: 'sync',
    short: 'Sync',
    title: 'Aufwachen und synchronisieren',
    description:
      'Der Network Manager sendet einen Sync-Beacon. Baugleiche Stationen geben ihn in getrennten Hop-Zeitschlitzen an entfernte Knoten weiter.',
  },
  {
    id: 'measure',
    short: 'Messen',
    title: 'Gemeinsamer Messzeitpunkt',
    description:
      'Jede Station erfasst beim Auslesen sofort Messwert und lokalen UTC-Zeitstempel. Beides bleibt anschließend untrennbar im Datenpaket.',
  },
  {
    id: 'collect',
    short: 'Senden',
    title: 'Gestaffelte Datenübertragung',
    description:
      'Stationen ohne direkten Gateway-Empfang senden zuerst an ihren automatisch gewählten nächsten Nachbarn. Gleichzeitiges Senden wird vermieden.',
  },
  {
    id: 'relay',
    short: 'Weiter',
    title: 'Pakete zum Gateway weiterleiten',
    description:
      'Station 04 und 05 leiten in dieser Runde weiter. Bei einer anderen Funklage können dieselben Aufgaben andere Stationen übernehmen.',
  },
  {
    id: 'confirm',
    short: 'Prüfen',
    title: 'Vollständigkeit bestätigen',
    description:
      'Das Gateway speichert die Daten lokal und meldet fehlende Knoten. Für sie stehen begrenzte Wiederholungsslots bereit.',
  },
  {
    id: 'finish',
    short: 'Schlafen',
    title: 'Runde sicher beenden',
    description:
      'Nach ROUND_END schlafen alle Knoten wieder. Fehlt das Signal, beendet ein lokaler Timeout das Funkfenster trotzdem.',
  },
] as const

export function MeshConcept() {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const phase = phases[phaseIndex]

  useEffect(() => {
    if (!isPlaying) return

    const timeout = window.setTimeout(() => {
      setPhaseIndex((current) => (current + 1) % phases.length)
    }, 2800)

    return () => window.clearTimeout(timeout)
  }, [isPlaying, phaseIndex])

  function replay() {
    setPhaseIndex(0)
    setIsPlaying(true)
  }

  return (
    <main className="mesh-concept-page">
      <header className="concept-intro">
        <div>
          <span className="concept-kicker">
            <Wifi size={15} aria-hidden="true" /> Architekturvorschlag
          </span>
          <h2>Synchrones Funkfenster statt Dauerempfang</h2>
          <p>
            Alle Messstationen sind baugleich und können dynamisch weiterleiten. Zwischen
            geplanten Kommunikationsrunden schlafen sie; im gemeinsamen Funkfenster
            werden Zeit, Messung, Multi-Hop-Transport und Bestätigung koordiniert.
          </p>
        </div>
        <div className="concept-facts" aria-label="Kernaussagen">
          <span>TDMA-Zeitschlitze</span>
          <span>Baugleiche Stationen</span>
          <span>Gateway bestätigt lokal</span>
        </div>
      </header>

      <div className="concept-main-grid">
        <section className="process-player" aria-labelledby="process-title">
          <div className="process-player-header">
            <div>
              <span className="eyebrow">Protokollrunde</span>
              <h3 id="process-title">Ablauf im Netz</h3>
            </div>
            <span className="player-counter">
              {String(phaseIndex + 1).padStart(2, '0')} / {String(phases.length).padStart(2, '0')}
            </span>
          </div>

          <div
            className={`mesh-stage phase-${phase.id}`}
            aria-label={`Phase ${phaseIndex + 1}: ${phase.title}`}
          >
            <span className="mesh-link link-g-n1 link-core"><i /></span>
            <span className="mesh-link link-g-n2 link-core"><i /></span>
            <span className="mesh-link link-n1-s1 link-edge"><i /></span>
            <span className="mesh-link link-n1-s2 link-edge"><i /></span>
            <span className="mesh-link link-n2-s2 link-edge"><i /></span>
            <span className="mesh-link link-n2-s3 link-edge"><i /></span>

            <MeshDevice
              className="device-gateway"
              icon={<Server size={21} />}
              label="Gateway"
              status={phase.id === 'sleep' ? 'bereit' : phase.id === 'confirm' ? 'prüft' : 'aktiv'}
              alwaysOn
            />
            <MeshDevice
              className="device-station-d"
              icon={<RadioTower size={20} />}
              label="Station 04"
              status={deviceStatus(phase.id, true)}
            />
            <MeshDevice
              className="device-station-e"
              icon={<RadioTower size={20} />}
              label="Station 05"
              status={deviceStatus(phase.id, true)}
            />
            <MeshDevice
              className="device-sensor-a"
              icon={<RadioTower size={20} />}
              label="Station 01"
              status={deviceStatus(phase.id, false)}
            />
            <MeshDevice
              className="device-sensor-b"
              icon={<RadioTower size={20} />}
              label="Station 02"
              status={deviceStatus(phase.id, false)}
            />
            <MeshDevice
              className="device-sensor-c"
              icon={<RadioTower size={20} />}
              label="Station 03"
              status={deviceStatus(phase.id, false)}
            />

            <div className="phase-caption" aria-live="polite">
              <span>{String(phaseIndex + 1).padStart(2, '0')}</span>
              <div>
                <strong>{phase.title}</strong>
                <p>{phase.description}</p>
              </div>
            </div>
          </div>

          <p className="topology-legend">
            <RadioTower size={15} aria-hidden="true" />
            Station 01–05 sind baugleich. Die Linien zeigen nur die in dieser Runde
            automatisch gelernte Route. Bei direkter Erreichbarkeit entsteht stattdessen
            ein Stern zum Gateway.
          </p>

          <div className="player-controls">
            <button
              className="icon-button"
              type="button"
              title="Animation neu starten"
              aria-label="Animation neu starten"
              onClick={replay}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
            <button
              className="button player-toggle"
              type="button"
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              {isPlaying ? 'Pause' : 'Abspielen'}
            </button>
            <div className="phase-timeline" role="group" aria-label="Protokollphase wählen">
              {phases.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === phaseIndex ? 'active' : ''}
                  aria-label={`Phase ${index + 1}: ${item.title}`}
                  aria-pressed={index === phaseIndex}
                  onClick={() => {
                    setPhaseIndex(index)
                    setIsPlaying(false)
                  }}
                >
                  <span />
                  {item.short}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="concept-info-box procedure-box">
          <div className="info-box-heading">
            <Info size={20} aria-hidden="true" />
            <div>
              <span className="eyebrow">Grundprinzip</span>
              <h3>So funktioniert eine Runde</h3>
            </div>
          </div>
          <ol className="procedure-list">
            <li><strong>Wecken:</strong> RTC startet alle Knoten mit Sicherheitsreserve.</li>
            <li><strong>Takten:</strong> Ein Beacon verteilt Rundennummer, Messzeit und Slots.</li>
            <li><strong>Messen:</strong> Wert und UTC-Zeitstempel entstehen gemeinsam direkt beim Auslesen.</li>
            <li><strong>Senden:</strong> Knoten übertragen nacheinander, entfernte zuerst.</li>
            <li><strong>Routen:</strong> Baugleiche Stationen puffern und geben Pakete Hop für Hop weiter.</li>
            <li><strong>Prüfen:</strong> Das Gateway fordert nur fehlende Pakete erneut an.</li>
            <li><strong>Schlafen:</strong> ROUND_END oder Timeout beendet die Runde.</li>
          </ol>
          <div className="packet-example">
            <span>Datenblock je Messung</span>
            <code>node_id · measured_at_utc_ms · time_quality · sync_age_ms · cycle_id · sensorwerte</code>
            <small>Die Empfangszeit am Gateway wird nur zusätzlich gespeichert.</small>
          </div>
          <div className="energy-comparison">
            <div>
              <span>Dauer-RX</span>
              <strong>408 mAh</strong>
              <small>pro Tag</small>
            </div>
            <ArrowRight size={20} aria-hidden="true" />
            <div>
              <span>5 % RX</span>
              <strong>20,4 mAh</strong>
              <small>pro Tag</small>
            </div>
          </div>
          <p className="energy-note">Nur SX1262-RX bei 17 mA; Board, MCU, TX und Sensoren kommen hinzu.</p>
        </aside>
      </div>

      <div className="architecture-grid">
        <section className="concept-info-box route-decision-box">
          <div className="info-box-heading">
            <Route size={21} aria-hidden="true" />
            <div>
              <span className="eyebrow">Automatische Topologie</span>
              <h3>Wie findet ein Knoten seinen Weg?</h3>
            </div>
          </div>
          <div className="route-decision-list">
            <DecisionStep
              number="01"
              title="Gateway-Beacon erkennen"
              text="Das Gateway sendet seine ID mit hop_count 0. Wer diesen Beacon direkt empfängt und bidirektional bestätigt, kennt eine Ein-Hop-Route."
            />
            <DecisionStep
              number="02"
              title="Beacon weitergeben"
              text="Direkt erreichbare Stationen senden ihn mit erhöhtem Hop-Zähler weiter. Entfernte Stationen lernen so einen erreichbaren Nachbarn kennen."
            />
            <DecisionStep
              number="03"
              title="Beste Route wählen"
              text="Routingtabellen vergleichen Hopzahl und Verbindungsqualität. Eine stabile Direktverbindung gewinnt; sonst wird ein Nachbar zum Next Hop."
            />
            <DecisionStep
              number="04"
              title="Nur adressierte Pakete weiterleiten"
              text="Steht die eigene ID im Feld next_hop, puffert die Station das Paket und sendet es in ihrem nächsten Slot weiter."
            />
          </div>
          <p className="route-callout">
            Es gibt keinen dauerhaften Umschalter „Leaf oder Router“. Dieselbe Firmware
            kann messen und weiterleiten; ohne Transitpaket bleibt die Funktion einfach
            ungenutzt.
          </p>
        </section>

        <section className="concept-info-box gateway-architecture-box">
          <div className="info-box-heading">
            <Server size={21} aria-hidden="true" />
            <div>
              <span className="eyebrow">Gateway & Server</span>
              <h3>Empfohlener Aufbau mit Raspberry Pi 4B</h3>
            </div>
          </div>

          <div className="gateway-chain" aria-label="Empfohlene Systemkette">
            <ArchitectureNode
              icon={<RadioTower size={20} />}
              title="LoRa-Mesh"
              text="Baugleiche Messstationen"
            />
            <ArrowRight size={19} aria-hidden="true" />
            <ArchitectureNode
              icon={<Cpu size={20} />}
              title="ESP32 + SX1262"
              text="Network Manager & Bridge"
              emphasized
            />
            <Cable size={19} aria-hidden="true" />
            <ArchitectureNode
              icon={<Database size={20} />}
              title="Raspberry Pi 4B"
              text="Datenbank, MQTT/API & Export"
            />
          </div>

          <div className="gateway-options">
            <div className="gateway-option recommended">
              <span>Empfehlung</span>
              <strong>ESP32-Bridge per USB/UART</strong>
              <p>
                Der ESP32 führt LoRaMesher und die zeitkritischen TDMA-Slots aus. Der Pi
                speichert die Daten dauerhaft. Das ESP32-Board kann über Arduino oder
                PlatformIO programmiert werden.
              </p>
            </div>
            <div className="gateway-option caution">
              <span>Alternative</span>
              <strong>LoRa-Modul direkt am Raspberry Pi</strong>
              <p>
                Möglich, aber LoRaMesher unterstützt derzeit ESP32/FreeRTOS, nicht Linux
                auf dem Pi. Dafür wären Treiber, Protokollportierung und Tests der
                Echtzeitplanung nötig.
              </p>
            </div>
          </div>

          <p className="module-note">
            Ein klassischer Arduino Uno/Nano reicht für LoRaMesher nicht. Geeignet ist
            ein ESP32 im Arduino-Framework. Beim Pi-HAT muss roher LoRa-P2P-Betrieb
            geprüft werden; ein reines LoRaWAN-Concentrator-HAT genügt nicht automatisch.
          </p>
        </section>
      </div>

      <section className="concept-info-box commissioning-box">
        <div className="info-box-heading">
          <TimerReset size={21} aria-hidden="true" />
          <div>
            <span className="eyebrow">Inbetriebnahme & Ausfall</span>
            <h3>Wie tritt eine neue Station dem laufenden Netz bei?</h3>
          </div>
        </div>

        <div className="commissioning-flow" aria-label="Ablauf der Netzanmeldung">
          <CommissioningState
            number="01"
            icon={<RadioTower size={19} />}
            title="NODE_ONLY startet"
            text="Die Station gründet niemals selbst ein zweites Netz."
          />
          <ArrowRight size={18} aria-hidden="true" />
          <CommissioningState
            number="02"
            icon={<Wifi size={19} />}
            title="Discovery · maximal 2 h"
            text="Beacon direkt oder über eine Sponsor-Station suchen."
            warning
          />
          <ArrowRight size={18} aria-hidden="true" />
          <CommissioningState
            number="03"
            icon={<Route size={19} />}
            title="JOIN_REQUEST"
            text="Zufälligen Discovery-Subslot verwenden und Route bestätigen."
          />
          <ArrowRight size={18} aria-hidden="true" />
          <CommissioningState
            number="04"
            icon={<CheckCircle2 size={19} />}
            title="Nächste volle Runde"
            text="Slots und Uhr übernehmen, erst dann Messdaten senden."
            success
          />
        </div>

        <div className="commissioning-details">
          <div className="commissioning-detail timeout-detail">
            <div>
              <AlertTriangle size={19} aria-hidden="true" />
              <strong>Nach 2 h ohne Join: Offline-Logger</strong>
            </div>
            <p>
              `JOIN_TIMEOUT` sichern, LoRa ausschalten und zwischen den
              5-Minuten-Messungen tief schlafen. Jede Messung erhält weiterhin ihren
              lokalen Zeitstempel und wird gepuffert. Ohne jemals empfangenen Sync gilt
              `time_quality = unsynced`; eine erfundene 100-ms-genaue UTC ist verboten.
              Zwei Stunden Dauer-RX bei 17 mA kosten ungefähr 34 mAh. Timeout und
              Offline-Logger sind Anwendungslogik oberhalb von LoRaMesher.
            </p>
          </div>
          <div className="commissioning-detail retry-detail">
            <div>
              <RefreshCw size={19} aria-hidden="true" />
              <strong>Später erneut versuchen</strong>
            </div>
            <p>
              Beispielsweise alle sechs Stunden ein begrenztes Suchfenster öffnen oder
              den Retry per Statustaste auslösen. Mehrere neue Stationen verteilen ihre
              Anfragen zufällig auf Discovery-Subslots.
            </p>
          </div>
          <div className="commissioning-detail led-detail">
            <div>
              <Moon size={19} aria-hidden="true" />
              <strong>LED ohne Schein-Deep-Sleep</strong>
            </div>
            <p>
              Fehlercode einmal vor dem Schlafen, bei einem ohnehin anstehenden
              Mess-Wakeup oder auf Tastendruck anzeigen. Kein vollständiges ESP32-Wakeup
              alle paar Sekunden nur für die LED.
            </p>
            <div className="led-codes" aria-label="LED-Fehlercodes">
              <span><i />1× Rot: kein Beacon</span>
              <span><i />2× Rot: Join abgelehnt</span>
              <span><i />3× Rot: Speicherfehler</span>
              <span className="led-success"><i />Grün: Join erfolgreich</span>
            </div>
          </div>
        </div>
      </section>

      <div className="concept-notes-grid">
        <InfoBox
          className="contradictions-box"
          icon={<TriangleAlert size={21} />}
          eyebrow="Offene Punkte"
          title="Widersprüche & Hinweise"
        >
          <InfoRow
            icon={<Clock3 size={17} />}
            title="Messzeitstempel, nicht Empfangszeit"
            text="Jede Station schreibt den Zeitstempel direkt beim Sensor-Auslesen zu den Werten. Gateway- und Server-Empfangszeit bleiben getrennt. time_quality und sync_age_ms zeigen, ob die geforderten 100 ms tatsächlich eingehalten werden können."
          />
          <InfoRow
            icon={<Database size={17} />}
            title="Gateway bestätigt, nicht der Server"
            text="Die ESP32-Bridge bestätigt erst nach persistenter Ablage auf dem lokalen Raspberry Pi oder in einer eigenen Ausfallwarteschlange. Ein Internet-Ausfall darf das Funkfenster nicht offenhalten."
          />
          <InfoRow
            icon={<RadioTower size={17} />}
            title="Topologie wird gelernt, nicht vorgebaut"
            text="Erreicht eine Station das Gateway direkt, sendet sie wie im Stern. Andernfalls wählt die Routingtabelle einen erreichbaren Nachbarn als Next Hop. Diese Rolle kann sich ändern."
          />
          <InfoRow
            icon={<Wifi size={17} />}
            title="Gemeinsam wach, nicht gleichzeitig senden"
            text="Alle Knoten teilen ein Funkfenster, senden aber in getrennten Slots. Sonst entstehen LoRa-Kollisionen."
          />
          <InfoRow
            icon={<TimerReset size={17} />}
            title="RX-Anteil ist ein Ergebnis"
            text="Er folgt aus Fensterdauer, Intervall, Knotenzahl, Hopzahl, Airtime und Wiederholungen und sollte später nicht frei geschätzt werden."
          />
        </InfoBox>

        <InfoBox
          className="limitations-box"
          icon={<ShieldAlert size={21} />}
          eyebrow="Technische Grenzen"
          title="Einschränkungen des Ansatzes"
        >
          <InfoRow
            icon={<Cpu size={17} />}
            title="ESP32 ist ein LoRaMesher-Zwang, kein Konzept-Zwang"
            text="Die aktuelle LoRaMesher-Implementierung setzt ESP32, FreeRTOS und RadioLib voraus. Für den RAK4631 wäre eine Portierung oder ein eigenes Protokoll nötig."
          />
          <InfoRow
            icon={<Moon size={17} />}
            title="Aktuell Light Sleep statt echtem Deep Sleep"
            text="LoRaMesher schläft in SLEEP-Slots mit ESP32 Light Sleep. Deep Sleep startet den Controller neu und verliert ohne Zusatzarbeit Routing- und Zeitplanstatus."
          />
          <InfoRow
            icon={<AlertTriangle size={17} />}
            title="Außerhalb des Fensters nicht erreichbar"
            text="Spontane Downlinks und Alarme können erst in der nächsten Runde zugestellt werden. Das erhöht die maximale Latenz."
          />
          <InfoRow
            icon={<Server size={17} />}
            title="Raspberry Pi benötigt mehrere Watt"
            text="Der Pi 4B ist als lokaler Server sinnvoll, aber nicht mit einem Sensorknoten-Akku vergleichbar. Er sollte Netzversorgung oder eine separat ausgelegte große Solaranlage erhalten."
          />
          <InfoRow
            icon={<Wifi size={17} />}
            title="Eine durchgehende Funkkette bleibt notwendig"
            text="Ohne direkten Gateway-Link und ohne mindestens einen erreichbaren, gleichzeitig wachen Nachbarn entsteht eine Netzpartition. Software kann diese physische Lücke nicht überbrücken."
          />
          <InfoRow
            icon={<ShieldAlert size={17} />}
            title="Join-Sicherheit ist zusätzliche Arbeit"
            text="Geräte-ID, Netzschlüssel, Replay-Schutz und Allowlist dürfen nicht als fertige LoRaMesher-Sicherheitsfunktion vorausgesetzt werden und müssen im Prototyp separat spezifiziert und getestet werden."
          />
          <InfoRow
            icon={<CheckCircle2 size={17} />}
            title="Noch praktisch zu validieren"
            text="Drift, Guard Times, Mehrfach-Hops, Paketverluste und Verbrauch müssen mit mehreren realen Knoten und bei SF7 bis SF12 gemessen werden."
          />
        </InfoBox>
      </div>
    </main>
  )
}

function deviceStatus(phase: string, forwarding: boolean): string {
  if (phase === 'sleep' || phase === 'finish') return 'sleep'
  if (phase === 'measure') return 'misst'
  if (phase === 'collect') return forwarding ? 'rx' : 'tx'
  if (phase === 'relay') return forwarding ? 'tx' : 'wartet'
  if (phase === 'confirm') return 'rx'
  return 'sync'
}

function MeshDevice({
  className,
  icon,
  label,
  status,
  alwaysOn = false,
}: {
  className: string
  icon: ReactNode
  label: string
  status: string
  alwaysOn?: boolean
}) {
  return (
    <div className={`mesh-device ${className} status-${status} ${alwaysOn ? 'always-on' : ''}`}>
      <span className="device-icon" aria-hidden="true">{icon}</span>
      <span className="device-copy">
        <strong>{label}</strong>
        <small>{status}</small>
      </span>
    </div>
  )
}

function InfoBox({
  className,
  icon,
  eyebrow,
  title,
  children,
}: {
  className: string
  icon: ReactNode
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className={`concept-info-box ${className}`}>
      <div className="info-box-heading">
        <span aria-hidden="true">{icon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="info-rows">{children}</div>
    </section>
  )
}

function InfoRow({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="info-row">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function DecisionStep({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className="decision-step">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function ArchitectureNode({
  icon,
  title,
  text,
  emphasized = false,
}: {
  icon: ReactNode
  title: string
  text: string
  emphasized?: boolean
}) {
  return (
    <div className={`architecture-node ${emphasized ? 'emphasized' : ''}`}>
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <small>{text}</small>
    </div>
  )
}

function CommissioningState({
  number,
  icon,
  title,
  text,
  warning = false,
  success = false,
}: {
  number: string
  icon: ReactNode
  title: string
  text: string
  warning?: boolean
  success?: boolean
}) {
  return (
    <div
      className={`commissioning-state ${warning ? 'warning' : ''} ${success ? 'success' : ''}`}
    >
      <span className="commissioning-number">{number}</span>
      <span className="commissioning-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <small>{text}</small>
    </div>
  )
}