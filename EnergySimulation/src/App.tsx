import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BatteryCharging,
  Building2,
  Calculator,
  Check,
  Clock3,
  Compass,
  Cpu,
  Download,
  Gauge,
  Info,
  Moon,
  Network,
  Plus,
  RadioTower,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TreePine,
  Trash2,
  Zap,
} from 'lucide-react'
import './simulation.css'
import { calculateSimulation } from './calculations'
import { MeshConcept } from './MeshConcept'
import {
  cloneConfig,
  getDefaultConfig,
  getSolarLightPercent,
  presets,
  solarEnvironmentPresets,
  solarOrientationPresets,
} from './presets'
import type {
  BatteryConfig,
  McuConfig,
  RadioConfig,
  SensorConfig,
  SimulationConfig,
  SolarConfig,
  SolarEnvironment,
  SolarOrientation,
} from './types'

const STORAGE_KEY = 'energy-simulation-config-v2'
const THEME_STORAGE_KEY = 'energy-simulation-theme-v1'

type Theme = 'light' | 'dark'

interface NumberFieldProps {
  label: string
  value: number
  unit: string
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hint?: string
}

function NumberField({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max,
  step = 0.1,
  disabled = false,
  hint,
}: NumberFieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && (
          <span className="hint-icon" title={hint}>
            <Info size={13} aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="input-shell">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              Number.isNaN(event.currentTarget.valueAsNumber)
                ? 0
                : event.currentTarget.valueAsNumber,
            )
          }
        />
        <span>{unit}</span>
      </span>
    </label>
  )
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '∞'
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: digits,
  }).format(value)
}

function formatCurrent(currentMa: number): string {
  return currentMa < 1
    ? `${formatNumber(currentMa * 1000, 1)} µA`
    : `${formatNumber(currentMa, 2)} mA`
}

function formatEnergy(energyWh: number): string {
  return Math.abs(energyWh) < 1
    ? `${formatNumber(energyWh * 1000, 1)} mWh`
    : `${formatNumber(energyWh, 2)} Wh`
}

function formatPower(powerW: number): string {
  if (!Number.isFinite(powerW)) return 'nicht berechenbar'
  return powerW < 1
    ? `${formatNumber(powerW * 1000, 1)} mW`
    : `${formatNumber(powerW, 2)} W`
}

function formatAutonomy(days: number): string {
  if (!Number.isFinite(days)) return 'unbegrenzt'
  return days >= 730
    ? `${formatNumber(days / 365, 1)} Jahre`
    : `${formatNumber(days, 0)} Tage`
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

interface CalculationLine {
  id: string
  label: string
  formula: string
  values: string
  chargeMah: number
}

interface SolarCalculationLine {
  id: string
  label: string
  formula: string
  values: string
  result: string
}

function getCalculationLines(
  config: SimulationConfig,
  result: ReturnType<typeof calculateSimulation>,
): CalculationLine[] {
  const daySeconds = 86_400
  const baseCurrentMa = nonNegative(config.baseLoadUa) / 1000
  const mcuActiveSeconds = Math.min(
    daySeconds,
    (result.measurementEventsPerDay *
      nonNegative(config.mcu.measurementDurationMs) +
      result.totalTransmissionsPerDay *
        nonNegative(config.mcu.transmissionDurationMs)) /
      1000,
  )
  const mcuRestSeconds = daySeconds - mcuActiveSeconds
  const mcuRestCurrentMa =
    config.networkMode === 'p2p'
      ? nonNegative(config.mcu.deepSleepCurrentUa) / 1000
      : nonNegative(config.mcu.meshStandbyCurrentUa) / 1000
  const txSeconds = result.txAirtimeSecondsPerDay
  const rxSeconds = result.rxHoursPerDay * 3600
  const radioSleepSeconds = Math.max(0, daySeconds - txSeconds - rxSeconds)

  const sensorLines = config.sensors
    .filter((sensor) => sensor.enabled)
    .map((sensor) => {
      const activeSeconds = Math.min(
        daySeconds,
        (result.measurementEventsPerDay *
          nonNegative(sensor.activeDurationMs)) /
          1000,
      )
      const sleepSeconds = daySeconds - activeSeconds
      const quantity = nonNegative(sensor.quantity)
      const activeCurrentMa = nonNegative(sensor.activeCurrentMa)
      const sleepCurrentMa = nonNegative(sensor.sleepCurrentUa) / 1000

      return {
        id: `sensor-${sensor.id}`,
        label: `Sensor: ${sensor.name}`,
        formula: 'Q = Anzahl × (I aktiv × t aktiv + I Schlaf × t Schlaf) / 3.600',
        values: `${formatNumber(quantity, 0)} × (${formatNumber(activeCurrentMa, 3)} mA × ${formatNumber(activeSeconds, 1)} s + ${formatNumber(sleepCurrentMa, 3)} mA × ${formatNumber(sleepSeconds, 1)} s) / 3.600`,
        chargeMah:
          (quantity *
            (activeCurrentMa * activeSeconds + sleepCurrentMa * sleepSeconds)) /
          3600,
      }
    })

  return [
    {
      id: 'base',
      label: 'Grundlast',
      formula: 'Q = I × t',
      values: `${formatNumber(baseCurrentMa, 3)} mA × 24 h`,
      chargeMah: baseCurrentMa * 24,
    },
    {
      id: 'mcu',
      label: 'Mikrocontroller',
      formula: 'Q = (I aktiv × t aktiv + I Ruhe × t Ruhe) / 3.600',
      values: `(${formatNumber(nonNegative(config.mcu.activeCurrentMa), 3)} mA × ${formatNumber(mcuActiveSeconds, 1)} s + ${formatNumber(mcuRestCurrentMa, 3)} mA × ${formatNumber(mcuRestSeconds, 1)} s) / 3.600`,
      chargeMah:
        (nonNegative(config.mcu.activeCurrentMa) * mcuActiveSeconds +
          mcuRestCurrentMa * mcuRestSeconds) /
        3600,
    },
    {
      id: 'radio',
      label: 'Funk',
      formula: 'Q = (I TX × t TX + I RX × t RX + I Schlaf × t Schlaf) / 3.600',
      values: `(${formatNumber(nonNegative(config.radio.txCurrentMa), 3)} mA × ${formatNumber(txSeconds, 1)} s + ${formatNumber(nonNegative(config.radio.rxCurrentMa), 3)} mA × ${formatNumber(rxSeconds, 1)} s + ${formatNumber(nonNegative(config.radio.sleepCurrentUa) / 1000, 3)} mA × ${formatNumber(radioSleepSeconds, 1)} s) / 3.600`,
      chargeMah: result.components.find((component) => component.id === 'radio')?.chargeMah ?? 0,
    },
    ...sensorLines,
  ]
}

function getSolarCalculationLines(
  config: SimulationConfig,
  result: ReturnType<typeof calculateSimulation>,
): SolarCalculationLine[] {
  const peakSunHours = nonNegative(config.solar.peakSunHours)
  const lightFraction = Math.min(100, nonNegative(config.solar.lightPercent)) / 100
  const efficiencyFraction =
    Math.min(100, nonNegative(config.solar.efficiencyPercent)) / 100

  return [
    {
      id: 'solar-yield',
      label: 'Solarertrag',
      formula: 'E Solar = P Panel × Sonnenstunden × Licht × Wirkungsgrad',
      values: `${formatNumber(nonNegative(config.solar.panelPowerW), 3)} W × ${formatNumber(peakSunHours, 2)} h × ${formatNumber(lightFraction, 3)} × ${formatNumber(efficiencyFraction, 3)}`,
      result: `${formatEnergy(result.solarYieldWhPerDay)} / Tag`,
    },
    {
      id: 'solar-balance',
      label: 'Tagesbilanz',
      formula: 'Bilanz = E Solar − E Verbrauch',
      values: `${formatEnergy(result.solarYieldWhPerDay)} − ${formatEnergy(result.dailyEnergyWh)}`,
      result: `${result.solarBalanceWhPerDay >= 0 ? '+' : ''}${formatEnergy(result.solarBalanceWhPerDay)} / Tag`,
    },
    {
      id: 'required-panel',
      label: 'Panel mit Reserve',
      formula: 'P Panel = E Verbrauch × Reserve / (Sonnenstunden × Licht × Wirkungsgrad)',
      values: `${formatEnergy(result.dailyEnergyWh)} × ${formatNumber(nonNegative(config.solar.reserveFactor), 2)} / (${formatNumber(peakSunHours, 2)} h × ${formatNumber(lightFraction, 3)} × ${formatNumber(efficiencyFraction, 3)})`,
      result: formatPower(result.requiredPanelPowerW),
    },
  ]
}

function SolarEnvironmentIcon({ environment }: { environment: SolarEnvironment }) {
  if (environment === 'forest') return <TreePine size={15} aria-hidden="true" />
  if (environment === 'city') return <Building2 size={15} aria-hidden="true" />
  return <Sun size={15} aria-hidden="true" />
}

function loadInitialConfig(): SimulationConfig {
  const fallback = getDefaultConfig()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<SimulationConfig>
    if (!parsed || typeof parsed !== 'object') return fallback

    return {
      ...fallback,
      ...parsed,
      mcu: { ...fallback.mcu, ...parsed.mcu },
      radio: { ...fallback.radio, ...parsed.radio },
      battery: { ...fallback.battery, ...parsed.battery },
      solar: { ...fallback.solar, ...parsed.solar },
      sensors: Array.isArray(parsed.sensors) ? parsed.sensors : fallback.sensors,
    }
  } catch {
    return fallback
  }
}

function loadInitialTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

function App() {
  const [config, setConfig] = useState<SimulationConfig>(loadInitialConfig)
  const [theme, setTheme] = useState<Theme>(loadInitialTheme)
  const [activeView, setActiveView] = useState<'calculator' | 'mesh-concept'>(
    'calculator',
  )
  const result = calculateSimulation(config)
  const calculationLines = getCalculationLines(config, result)
  const solarCalculationLines = getSolarCalculationLines(config, result)
  const activePreset =
    presets.find((preset) => preset.config.profileName === config.profileName)
      ?.id ?? 'custom'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  function updateRoot(patch: Partial<SimulationConfig>) {
    setConfig((current) => ({
      ...current,
      ...patch,
      profileName: 'Eigene Konfiguration',
    }))
  }

  function updateMcu(patch: Partial<McuConfig>) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      mcu: { ...current.mcu, ...patch },
    }))
  }

  function updateRadio(patch: Partial<RadioConfig>) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      radio: { ...current.radio, ...patch },
    }))
  }

  function updateBattery(patch: Partial<BatteryConfig>) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      battery: { ...current.battery, ...patch },
    }))
  }

  function updateSolar(patch: Partial<SolarConfig>) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      solar: { ...current.solar, ...patch },
    }))
  }

  function selectSolarEnvironment(environment: SolarEnvironment) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      solar: {
        ...current.solar,
        environment,
        lightPercent: getSolarLightPercent(
          environment,
          current.solar.orientation,
        ),
      },
    }))
  }

  function selectSolarOrientation(orientation: SolarOrientation) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      solar: {
        ...current.solar,
        orientation,
        lightPercent: getSolarLightPercent(
          current.solar.environment,
          orientation,
        ),
      },
    }))
  }

  function updateSensor(id: string, patch: Partial<SensorConfig>) {
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      sensors: current.sensors.map((sensor) =>
        sensor.id === id ? { ...sensor, ...patch } : sensor,
      ),
    }))
  }

  function addSensor() {
    const id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `sensor-${Date.now()}`
    const sensor: SensorConfig = {
      id,
      name: 'Neuer Sensor',
      quantity: 1,
      activeCurrentMa: 1,
      activeDurationMs: 100,
      sleepCurrentUa: 0,
      enabled: true,
    }
    setConfig((current) => ({
      ...current,
      profileName: 'Eigene Konfiguration',
      sensors: [...current.sensors, sensor],
    }))
  }

  function selectPreset(id: string) {
    const preset = presets.find((item) => item.id === id)
    if (preset) setConfig(cloneConfig(preset.config))
  }

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ['Kennzahl', 'Wert', 'Einheit'],
      ['Netzmodus', config.networkMode === 'p2p' ? 'P2P' : 'Mesh', ''],
      ['Durchschnittsstrom', result.averageCurrentMa * 1000, 'µA'],
      ['Tagesverbrauch', result.dailyChargeMah, 'mAh/Tag'],
      ['Tagesenergie', result.dailyEnergyWh * 1000, 'mWh/Tag'],
      ['Messungen', result.measurementEventsPerDay, 'pro Tag'],
      ['Sendungen gesamt', result.totalTransmissionsPerDay, 'pro Tag'],
      ['Airtime je Paket', result.airtimeMs, 'ms'],
      ['RX-Zeit', result.rxHoursPerDay, 'h/Tag'],
      ['Akkuautarkie ohne Solar', result.batteryAutonomyDays, 'Tage'],
      ['Laufzeitprognose mit Solar', result.projectedAutonomyDays, 'Tage'],
      ['Solarertrag', result.solarYieldWhPerDay, 'Wh/Tag'],
      ['Erforderliche Panelleistung', result.requiredPanelPowerW, 'W'],
      ...result.components.map((component) => [
        `Anteil ${component.label}`,
        component.chargeMah,
        'mAh/Tag',
      ]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value =
              typeof cell === 'number'
                ? Number.isFinite(cell)
                  ? String(cell).replace('.', ',')
                  : 'unbegrenzt'
                : cell
            return `"${value.replaceAll('"', '""')}"`
          })
          .join(';'),
      )
      .join('\r\n')
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `energiebilanz-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const projectedAutonomyProgress = Math.min(
    100,
    (result.projectedAutonomyDays / 730) * 100,
  )
  const solarProgress = Math.min(100, result.solarCoveragePercent)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Zap size={22} />
          </span>
          <div>
            <span className="eyebrow">ATP 2026 / 2027</span>
            <h1>Energiebilanz</h1>
          </div>
        </div>
        <nav className="app-tabs" role="tablist" aria-label="Hauptbereiche">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'calculator'}
            className={activeView === 'calculator' ? 'active' : ''}
            onClick={() => setActiveView('calculator')}
          >
            <Calculator size={17} aria-hidden="true" />
            Berechnung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'mesh-concept'}
            className={activeView === 'mesh-concept' ? 'active' : ''}
            onClick={() => setActiveView('mesh-concept')}
          >
            <Network size={17} aria-hidden="true" />
            Synchrones Mesh
          </button>
        </nav>
        <div className="topbar-actions">
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label="Dunkelmodus"
            aria-pressed={theme === 'dark'}
            title={
              theme === 'dark'
                ? 'Hellmodus aktivieren'
                : 'Dark Mode aktivieren'
            }
            onClick={() =>
              setTheme((current) => (current === 'light' ? 'dark' : 'light'))
            }
          >
            {theme === 'dark' ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
          {activeView === 'calculator' && (
            <>
              <span className="save-status">
                <Check size={15} aria-hidden="true" /> Lokal gespeichert
              </span>
              <button className="button secondary" type="button" onClick={exportCsv}>
                <Download size={17} aria-hidden="true" /> CSV
              </button>
              <button
                className="icon-button"
                type="button"
                title="Planungsprofil zurücksetzen"
                aria-label="Planungsprofil zurücksetzen"
                onClick={() => setConfig(getDefaultConfig())}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      <section
        className={`scenario-bar ${activeView !== 'calculator' ? 'view-hidden' : ''}`}
        aria-label="Szenarioauswahl"
      >
        <label className="preset-select">
          <span>Ausgangsprofil</span>
          <select
            value={activePreset}
            onChange={(event) => selectPreset(event.currentTarget.value)}
          >
            {activePreset === 'custom' && (
              <option value="custom" disabled>
                Eigene Konfiguration
              </option>
            )}
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <span>
            {presets.find((preset) => preset.id === activePreset)?.description}
          </span>
        </label>
        <div className="network-modes" role="group" aria-label="Netzmodus">
          <ModeButton
            active={config.networkMode === 'p2p'}
            icon={<RadioTower size={19} aria-hidden="true" />}
            title="P2P"
            subtitle="Deep Sleep"
            onClick={() => updateRoot({ networkMode: 'p2p' })}
          />
          <ModeButton
            active={config.networkMode === 'mesh'}
            icon={<Network size={19} aria-hidden="true" />}
            title="Mesh"
            subtitle="Empfangsbereit"
            onClick={() => updateRoot({ networkMode: 'mesh' })}
          />
        </div>
      </section>

      <main className={`workspace ${activeView !== 'calculator' ? 'view-hidden' : ''}`}>
        <div className="controls-column">
          <section className="panel">
            <PanelHeader icon={<Clock3 size={19} />} eyebrow="System" title="Zyklus & Grundlast">
              <div className="detail-switch" role="group" aria-label="Eingabetiefe">
                <button
                  type="button"
                  className={config.detailMode === 'basic' ? 'active' : ''}
                  aria-pressed={config.detailMode === 'basic'}
                  onClick={() =>
                    setConfig((current) => ({ ...current, detailMode: 'basic' }))
                  }
                >
                  Basis
                </button>
                <button
                  type="button"
                  className={config.detailMode === 'advanced' ? 'active' : ''}
                  aria-pressed={config.detailMode === 'advanced'}
                  onClick={() =>
                    setConfig((current) => ({ ...current, detailMode: 'advanced' }))
                  }
                >
                  <SlidersHorizontal size={14} aria-hidden="true" /> Experte
                </button>
              </div>
            </PanelHeader>
            <div className="field-grid three-columns">
              <NumberField
                label="Messintervall"
                value={config.measurementIntervalMinutes}
                unit="min"
                min={0.1}
                step={1}
                onChange={(value) => updateRoot({ measurementIntervalMinutes: value })}
              />
              <NumberField
                label="Sendeintervall"
                value={config.sendIntervalMinutes}
                unit="min"
                min={0.1}
                step={1}
                onChange={(value) => updateRoot({ sendIntervalMinutes: value })}
              />
              <NumberField
                label="Board-Grundlast"
                value={config.baseLoadUa}
                unit="µA"
                step={1}
                hint="Lade-IC, Regler und weitere dauerhaft aktive Board-Komponenten"
                onChange={(value) => updateRoot({ baseLoadUa: value })}
              />
            </div>
          </section>

          <section className="panel sensors-panel">
            <PanelHeader icon={<Thermometer size={19} />} eyebrow="Komponenten" title="Sensoren">
              <button className="button secondary" type="button" onClick={addSensor}>
                <Plus size={17} aria-hidden="true" /> Sensor
              </button>
            </PanelHeader>
            <div className="sensor-list">
              {config.sensors.length === 0 && (
                <div className="empty-state">Keine Sensoren konfiguriert</div>
              )}
              {config.sensors.map((sensor) => (
                <div className={`sensor-row ${sensor.enabled ? '' : 'disabled'}`} key={sensor.id}>
                  <div className="sensor-identity">
                    <label className="sensor-check" title="Sensor ein- oder ausschalten">
                      <input
                        type="checkbox"
                        checked={sensor.enabled}
                        onChange={(event) =>
                          updateSensor(sensor.id, { enabled: event.currentTarget.checked })
                        }
                      />
                      <span aria-hidden="true" />
                    </label>
                    <label className="name-field">
                      <span>Bezeichnung</span>
                      <input
                        type="text"
                        value={sensor.name}
                        onChange={(event) =>
                          updateSensor(sensor.id, { name: event.currentTarget.value })
                        }
                      />
                    </label>
                  </div>
                  <NumberField
                    label="Anzahl"
                    value={sensor.quantity}
                    unit="×"
                    min={1}
                    step={1}
                    disabled={!sensor.enabled}
                    onChange={(value) => updateSensor(sensor.id, { quantity: value })}
                  />
                  <NumberField
                    label="Aktivstrom"
                    value={sensor.activeCurrentMa}
                    unit="mA"
                    disabled={!sensor.enabled}
                    onChange={(value) => updateSensor(sensor.id, { activeCurrentMa: value })}
                  />
                  <NumberField
                    label="Messdauer"
                    value={sensor.activeDurationMs}
                    unit="ms"
                    step={10}
                    disabled={!sensor.enabled}
                    onChange={(value) => updateSensor(sensor.id, { activeDurationMs: value })}
                  />
                  <NumberField
                    label="Ruhe / passiv"
                    value={sensor.sleepCurrentUa}
                    unit="µA"
                    disabled={!sensor.enabled}
                    hint="Bei vollständig abschaltbaren Sensoren auf 0 setzen"
                    onChange={(value) => updateSensor(sensor.id, { sleepCurrentUa: value })}
                  />
                  <button
                    className="icon-button danger"
                    type="button"
                    title={`${sensor.name} entfernen`}
                    aria-label={`${sensor.name} entfernen`}
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        profileName: 'Eigene Konfiguration',
                        sensors: current.sensors.filter((item) => item.id !== sensor.id),
                      }))
                    }
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <PanelHeader icon={<Cpu size={19} />} eyebrow="Elektronik" title="µC & Funk" />
            <div className="component-block">
              <h3>Mikrocontroller</h3>
              <div className="field-grid three-columns">
                <NumberField
                  label="Aktivstrom"
                  value={config.mcu.activeCurrentMa}
                  unit="mA"
                  onChange={(value) => updateMcu({ activeCurrentMa: value })}
                />
                {config.networkMode === 'p2p' ? (
                  <NumberField
                    label="Deep Sleep"
                    value={config.mcu.deepSleepCurrentUa}
                    unit="µA"
                    onChange={(value) => updateMcu({ deepSleepCurrentUa: value })}
                  />
                ) : (
                  <NumberField
                    label="Mesh-Standby"
                    value={config.mcu.meshStandbyCurrentUa}
                    unit="µA"
                    hint="240 µA als Light-Sleep-Annahme für ESP32-S3; zusätzliche CPU-Aktivität für Routing und RX-Verarbeitung über die Aktivzeiten erfassen"
                    onChange={(value) => updateMcu({ meshStandbyCurrentUa: value })}
                  />
                )}
                {config.detailMode === 'advanced' && (
                  <NumberField
                    label="Aktiv je Messung"
                    value={config.mcu.measurementDurationMs}
                    unit="ms"
                    step={10}
                    onChange={(value) => updateMcu({ measurementDurationMs: value })}
                  />
                )}
                {config.detailMode === 'advanced' && (
                  <NumberField
                    label="Aktiv je Sendung"
                    value={config.mcu.transmissionDurationMs}
                    unit="ms"
                    step={10}
                    onChange={(value) => updateMcu({ transmissionDurationMs: value })}
                  />
                )}
              </div>
            </div>

            <div className="component-block radio-block">
              <h3>LoRa-Funk</h3>
              <div className="field-grid three-columns">
                <NumberField
                  label="TX-Strom"
                  value={config.radio.txCurrentMa}
                  unit="mA"
                  step={1}
                  onChange={(value) => updateRadio({ txCurrentMa: value })}
                />
                <NumberField
                  label="RX-Strom"
                  value={config.radio.rxCurrentMa}
                  unit="mA"
                  step={1}
                  onChange={(value) => updateRadio({ rxCurrentMa: value })}
                />
                {config.networkMode === 'p2p' ? (
                  <NumberField
                    label="RX nach Sendung"
                    value={config.radio.rxAfterTxMs}
                    unit="ms"
                    step={10}
                    onChange={(value) => updateRadio({ rxAfterTxMs: value })}
                  />
                ) : (
                  <NumberField
                    label="Weitergeleitete Pakete"
                    value={config.radio.forwardedPacketsPerDay}
                    unit="/ Tag"
                    step={1}
                    onChange={(value) => updateRadio({ forwardedPacketsPerDay: value })}
                  />
                )}
                {config.detailMode === 'advanced' && (
                  <NumberField
                    label="Funk-Sleep"
                    value={config.radio.sleepCurrentUa}
                    unit="µA"
                    onChange={(value) => updateRadio({ sleepCurrentUa: value })}
                  />
                )}
              </div>

              {config.networkMode === 'mesh' && (
                <div className="rx-duty-control">
                  <label className="range-field">
                    <span>
                      RX-Anteil
                      <output>{formatNumber(config.radio.meshRxDutyPercent, 0)} %</output>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={config.radio.meshRxDutyPercent}
                      onChange={(event) =>
                        updateRadio({ meshRxDutyPercent: event.currentTarget.valueAsNumber })
                      }
                    />
                  </label>
                  <p>
                    100 % entspricht Dauerempfang. Kleinere Werte setzen synchronisierte
                    Empfangsfenster und passende Protokollunterstützung voraus.
                  </p>
                </div>
              )}

              {config.detailMode === 'advanced' && (
                <div className="field-grid five-columns advanced-radio">
                  <SelectField
                    label="Spreading Factor"
                    value={config.radio.spreadingFactor}
                    options={[7, 8, 9, 10, 11, 12].map((value) => [value, `SF${value}`])}
                    onChange={(value) => updateRadio({ spreadingFactor: value })}
                  />
                  <SelectField
                    label="Bandbreite"
                    value={config.radio.bandwidthKhz}
                    options={[125, 250, 500].map((value) => [value, `${value} kHz`])}
                    onChange={(value) => updateRadio({ bandwidthKhz: value })}
                  />
                  <SelectField
                    label="Coding Rate"
                    value={config.radio.codingRate}
                    options={[5, 6, 7, 8].map((value) => [value, `4/${value}`])}
                    onChange={(value) => updateRadio({ codingRate: value })}
                  />
                  <NumberField
                    label="Präambel"
                    value={config.radio.preambleSymbols}
                    unit="Sym."
                    step={1}
                    onChange={(value) => updateRadio({ preambleSymbols: value })}
                  />
                  <NumberField
                    label="Paketgröße"
                    value={config.radio.payloadBytes}
                    unit="Byte"
                    step={1}
                    onChange={(value) => updateRadio({ payloadBytes: value })}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="panel supply-panel">
            <PanelHeader
              icon={<BatteryCharging size={19} />}
              eyebrow="Versorgung"
              title="Akku & Solar"
            />
            <div className="supply-grid">
              <div className="component-block">
                <h3>Akku</h3>
                <div className="field-grid two-columns">
                  <NumberField
                    label="Kapazität"
                    value={config.battery.capacityMah}
                    unit="mAh"
                    step={100}
                    onChange={(value) => updateBattery({ capacityMah: value })}
                  />
                  <NumberField
                    label="Nutzbar"
                    value={config.battery.usablePercent}
                    unit="%"
                    max={100}
                    step={1}
                    onChange={(value) => updateBattery({ usablePercent: value })}
                  />
                  {config.detailMode === 'advanced' && (
                    <NumberField
                      label="Spannung"
                      value={config.battery.voltage}
                      unit="V"
                      onChange={(value) => updateBattery({ voltage: value })}
                    />
                  )}
                  {config.detailMode === 'advanced' && (
                    <NumberField
                      label="Selbstentladung"
                      value={config.battery.selfDischargePercentMonth}
                      unit="% / Monat"
                      onChange={(value) =>
                        updateBattery({ selfDischargePercentMonth: value })
                      }
                    />
                  )}
                </div>
              </div>
              <div className="component-block solar-inputs">
                <h3>Solarpanel</h3>
                <div className="solar-context-controls">
                  <div className="solar-preset-row">
                    <span className="solar-preset-label">Umgebung</span>
                    <div
                      className="solar-mode-buttons solar-environment-modes"
                      role="group"
                      aria-label="Umgebungspreset"
                    >
                      {solarEnvironmentPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={
                            config.solar.environment === preset.id ? 'active' : ''
                          }
                          title={`${preset.description} · ${getSolarLightPercent(
                            preset.id,
                            config.solar.orientation,
                          )} % Licht`}
                          aria-pressed={config.solar.environment === preset.id}
                          onClick={() => selectSolarEnvironment(preset.id)}
                        >
                          <SolarEnvironmentIcon environment={preset.id} />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="solar-preset-row">
                    <span className="solar-preset-label">
                      <Compass size={14} aria-hidden="true" /> Hausseite
                    </span>
                    <div
                      className="solar-mode-buttons solar-orientation-modes"
                      role="group"
                      aria-label="Kompassseite des Hauses"
                    >
                      {solarOrientationPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={
                            config.solar.orientation === preset.id ? 'active' : ''
                          }
                          title={`${preset.label} · ${getSolarLightPercent(
                            config.solar.environment,
                            preset.id,
                          )} % Licht`}
                          aria-label={preset.label}
                          aria-pressed={config.solar.orientation === preset.id}
                          onClick={() => selectSolarOrientation(preset.id)}
                        >
                          {preset.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="field-grid two-columns">
                  <NumberField
                    label="Nennleistung"
                    value={config.solar.panelPowerW}
                    unit="W"
                    onChange={(value) => updateSolar({ panelPowerW: value })}
                  />
                  <NumberField
                    label="Sonnenstunden (Peak)"
                    value={config.solar.peakSunHours}
                    unit="h / Tag"
                    step={0.1}
                    hint="Äquivalente Volllaststunden, nicht die reine Tageslänge; Winterwert M'Sila: 2,17 h/Tag"
                    onChange={(value) => updateSolar({ peakSunHours: value })}
                  />
                  <NumberField
                    label="Verfügbares Licht"
                    value={config.solar.lightPercent}
                    unit="%"
                    max={100}
                    step={1}
                    hint="Wird durch Umgebung und Hausseite vorbelegt und kann manuell überschrieben werden"
                    onChange={(value) => updateSolar({ lightPercent: value })}
                  />
                  {config.detailMode === 'advanced' && (
                    <NumberField
                      label="Systemwirkungsgrad"
                      value={config.solar.efficiencyPercent}
                      unit="%"
                      max={100}
                      step={1}
                      onChange={(value) => updateSolar({ efficiencyPercent: value })}
                    />
                  )}
                  {config.detailMode === 'advanced' && (
                    <NumberField
                      label="Auslegungsreserve"
                      value={config.solar.reserveFactor}
                      unit="×"
                      min={0.1}
                      onChange={(value) => updateSolar({ reserveFactor: value })}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
          <CalculationPanel
            className="panel embedded-calculation"
            calculationLines={calculationLines}
            solarCalculationLines={solarCalculationLines}
            dailyChargeMah={result.dailyChargeMah}
            isEmbedded
          />
        </div>

        <aside className="results-column" aria-label="Berechnungsergebnisse">
          <section className="result-overview">
            <div className="result-mode">
              {config.networkMode === 'p2p' ? (
                <RadioTower size={16} aria-hidden="true" />
              ) : (
                <Network size={16} aria-hidden="true" />
              )}
              {config.networkMode === 'p2p'
                ? 'P2P · Deep Sleep'
                : `Mesh · ${formatNumber(config.radio.meshRxDutyPercent, 0)} % RX`}
            </div>
            <div className="primary-result">
              <span>Durchschnittsstrom</span>
              <strong>{formatCurrent(result.averageCurrentMa)}</strong>
            </div>
            <div className="overview-grid">
              <ResultStat
                label="Verbrauch"
                value={`${formatNumber(result.dailyChargeMah, 2)} mAh`}
                note="pro Tag"
              />
              <ResultStat label="Energie" value={formatEnergy(result.dailyEnergyWh)} note="pro Tag" />
            </div>
          </section>

          <section className="result-panel">
            <ResultHeading icon={<Gauge size={18} />} title="Verbrauchsanteile" />
            <div className="energy-bar" aria-label="Verbrauchsanteile">
              {result.components.map((component) => (
                <span
                  key={component.id}
                  title={`${component.label}: ${formatNumber(component.sharePercent, 1)} %`}
                  style={{
                    width: `${component.sharePercent}%`,
                    backgroundColor: component.color,
                  }}
                />
              ))}
            </div>
            <div className="component-legend">
              {result.components.map((component) => (
                <div key={component.id}>
                  <span className="legend-dot" style={{ backgroundColor: component.color }} />
                  <span>{component.label}</span>
                  <strong>{formatNumber(component.chargeMah, 3)} mAh</strong>
                  <small>{formatNumber(component.sharePercent, 0)} %</small>
                </div>
              ))}
            </div>
          </section>

          <CalculationPanel
            className="result-panel side-calculation"
            calculationLines={calculationLines}
            solarCalculationLines={solarCalculationLines}
            dailyChargeMah={result.dailyChargeMah}
            isEmbedded={false}
          />

          <section className="result-panel">
            <ResultHeading icon={<BatteryCharging size={18} />} title="Laufzeitprognose" />
            <div className="large-result">
              <strong>{formatAutonomy(result.projectedAutonomyDays)}</strong>
              <span>
                {formatNumber(result.solarCoveragePercent, 0)} % Solardeckung im
                Tagesmittel
                {' · '}
                ohne Solar {formatAutonomy(result.batteryAutonomyDays)}
              </span>
            </div>
            <Progress
              label="2-Jahres-Ziel mit Solar"
              value={`${formatNumber(projectedAutonomyProgress, 0)} %`}
              percent={projectedAutonomyProgress}
            />
          </section>

          <section className="result-panel">
            <ResultHeading icon={<Sun size={18} />} title="Solarbilanz" />
            <div className="solar-results">
              <div>
                <span>Ertrag</span>
                <strong>{formatEnergy(result.solarYieldWhPerDay)}</strong>
              </div>
              <div>
                <span>Bilanz</span>
                <strong className={result.solarBalanceWhPerDay >= 0 ? 'positive' : 'negative'}>
                  {result.solarBalanceWhPerDay >= 0 ? '+' : ''}
                  {formatEnergy(result.solarBalanceWhPerDay)}
                </strong>
              </div>
            </div>
            <Progress
              label="Bedarfsdeckung"
              value={`${formatNumber(result.solarCoveragePercent, 0)} %`}
              percent={solarProgress}
              solar
            />
            <div className="required-panel">
              <span>Panel mit {formatNumber(config.solar.reserveFactor, 1)}× Reserve</span>
              <strong>{formatPower(result.requiredPanelPowerW)}</strong>
            </div>
          </section>

          <section className="result-panel compact-results">
            <ResultHeading icon={<Clock3 size={18} />} title="Funk & Zyklen" />
            <dl>
              <DetailResult label="Messungen" value={`${formatNumber(result.measurementEventsPerDay, 1)} / Tag`} />
              <DetailResult label="Sendungen" value={`${formatNumber(result.totalTransmissionsPerDay, 1)} / Tag`} />
              <DetailResult label="Airtime je Paket" value={`${formatNumber(result.airtimeMs, 1)} ms`} />
              <DetailResult label="TX-Airtime" value={`${formatNumber(result.txAirtimeSecondsPerDay, 1)} s / Tag`} />
              <DetailResult label="RX-Zeit" value={`${formatNumber(result.rxHoursPerDay, 2)} h / Tag`} />
            </dl>
          </section>

          {result.warnings.length > 0 && (
            <section className="warning-panel">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <h2>Hinweise</h2>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </section>
          )}
        </aside>
      </main>
      {activeView === 'mesh-concept' && <MeshConcept />}
    </div>
  )
}

interface ChildrenProps {
  children?: React.ReactNode
}

function CalculationPanel({
  className,
  calculationLines,
  solarCalculationLines,
  dailyChargeMah,
  isEmbedded,
}: {
  className: string
  calculationLines: CalculationLine[]
  solarCalculationLines: SolarCalculationLine[]
  dailyChargeMah: number
  isEmbedded: boolean
}) {
  return (
    <section className={`calculation-panel ${className}`}>
      {isEmbedded && (
        <div className="conclusion-heading">
          <span className="eyebrow">Fazit</span>
          <h3>Rechenaufstellung</h3>
        </div>
      )}
      <details open>
        <summary>
          <ResultHeading
            icon={<Calculator size={18} />}
            title={isEmbedded ? 'Berechnung im Detail' : 'Rechenaufstellung'}
          />
          <span>Live mit den Eingabewerten</span>
        </summary>
        <div className="calculation-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Formel</th>
                <th scope="col">Eingesetzte Werte</th>
                <th scope="col">mAh/Tag</th>
              </tr>
            </thead>
            <tbody>
              {calculationLines.map((line) => (
                <tr key={line.id}>
                  <th scope="row">{line.label}</th>
                  <td className="formula">{line.formula}</td>
                  <td className="formula-values">{line.values}</td>
                  <td>{formatNumber(line.chargeMah, 3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  Summe Tagesverbrauch
                </th>
                <td>{formatNumber(dailyChargeMah, 3)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="solar-calculation">
          <h3>Solarbilanz</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Formel</th>
                <th scope="col">Eingesetzte Werte</th>
                <th scope="col">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {solarCalculationLines.map((line) => (
                <tr key={line.id}>
                  <th scope="row">{line.label}</th>
                  <td className="formula">{line.formula}</td>
                  <td className="formula-values">{line.values}</td>
                  <td>{line.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function PanelHeader({
  icon,
  eyebrow,
  title,
  children,
}: ChildrenProps & { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span aria-hidden="true">{icon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </div>
  )
}

function ModeButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={onClick}>
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: Array<[number, string]>
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="select-shell">
        <select value={value} onChange={(event) => onChange(Number(event.currentTarget.value))}>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}

function ResultHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="result-heading">
      <span aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
    </div>
  )
}

function ResultStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function Progress({
  label,
  value,
  percent,
  solar = false,
}: {
  label: string
  value: string
  percent: number
  solar?: boolean
}) {
  return (
    <div className="progress-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className={`progress-track ${solar ? 'solar' : ''}`}>
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}

function DetailResult({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default App
