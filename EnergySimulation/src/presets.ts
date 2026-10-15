import type {
  SimulationConfig,
  SimulationPreset,
  SolarEnvironment,
  SolarOrientation,
} from './types'

interface SolarEnvironmentPreset {
  id: SolarEnvironment
  label: string
  description: string
}

interface SolarOrientationPreset {
  id: SolarOrientation
  label: string
  shortLabel: string
}

export const solarEnvironmentPresets: readonly SolarEnvironmentPreset[] = [
  {
    id: 'forest',
    label: 'Wald',
    description: 'Lichter bis dichter Baumbestand',
  },
  {
    id: 'city',
    label: 'Stadtbetrieb',
    description: 'Zeitweise Schatten durch Gebäude',
  },
  {
    id: 'full-sun',
    label: 'Volle Sonne',
    description: 'Freie Fläche ohne Verschattung',
  },
]

export const solarOrientationPresets: readonly SolarOrientationPreset[] = [
  { id: 'north', label: 'Nordseite', shortLabel: 'N' },
  { id: 'east', label: 'Ostseite', shortLabel: 'O' },
  { id: 'south', label: 'Südseite', shortLabel: 'S' },
  { id: 'west', label: 'Westseite', shortLabel: 'W' },
]

const solarLightPercentByContext: Record<
  SolarEnvironment,
  Record<SolarOrientation, number>
> = {
  forest: { north: 5, east: 7, south: 10, west: 7 },
  city: { north: 10, east: 35, south: 50, west: 35 },
  'full-sun': { north: 10, east: 70, south: 100, west: 70 },
}

export function getSolarLightPercent(
  environment: SolarEnvironment | undefined,
  orientation: SolarOrientation | undefined,
): number {
  return solarLightPercentByContext[environment ?? 'forest'][orientation ?? 'south']
}

const planningConfig: SimulationConfig = {
  profileName: 'Heltec Wireless Stick Lite V3 · Planung',
  detailMode: 'basic',
  networkMode: 'p2p',
  measurementIntervalMinutes: 5,
  sendIntervalMinutes: 30,
  baseLoadUa: 100,
  mcu: {
    activeCurrentMa: 40,
    deepSleepCurrentUa: 8,
    meshStandbyCurrentUa: 240,
    measurementDurationMs: 500,
    transmissionDurationMs: 1000,
  },
  radio: {
    txCurrentMa: 92,
    rxCurrentMa: 17,
    sleepCurrentUa: 0.6,
    rxAfterTxMs: 400,
    spreadingFactor: 9,
    bandwidthKhz: 125,
    codingRate: 5,
    preambleSymbols: 8,
    payloadBytes: 33,
    meshRxDutyPercent: 100,
    forwardedPacketsPerDay: 0,
  },
  sensors: [
    {
      id: 'bme680',
      name: 'BME680',
      quantity: 1,
      activeCurrentMa: 0.8,
      activeDurationMs: 150,
      sleepCurrentUa: 0.15,
      enabled: true,
    },
  ],
  battery: {
    capacityMah: 3000,
    usablePercent: 80,
    voltage: 3.7,
    selfDischargePercentMonth: 3,
  },
  solar: {
    panelPowerW: 1,
    peakSunHours: 2.17,
    lightPercent: 10,
    efficiencyPercent: 60,
    reserveFactor: 1.5,
    environment: 'forest',
    orientation: 'south',
  },
}

const optimizedConfig: SimulationConfig = {
  ...planningConfig,
  profileName: 'Heltec Wireless Stick Lite V3 · Optimiert',
  baseLoadUa: 20,
  radio: {
    ...planningConfig.radio,
    spreadingFactor: 7,
  },
}

const worstCaseConfig: SimulationConfig = {
  ...planningConfig,
  profileName: 'Heltec Wireless Stick Lite V3 · Schlechtfall',
  baseLoadUa: 1000,
  radio: {
    ...planningConfig.radio,
    txCurrentMa: 125,
    rxAfterTxMs: 1500,
    spreadingFactor: 12,
  },
}

export const presets: SimulationPreset[] = [
  {
    id: 'planning',
    label: planningConfig.profileName,
    description: 'ESP32-S3 + SX1262, 100 µA Board-Grundlast, SF9; Schätzwerte',
    config: planningConfig,
  },
  {
    id: 'optimized',
    label: optimizedConfig.profileName,
    description: 'ESP32-S3 + SX1262, 20 µA Board-Grundlast, SF7; Optimierungsziel',
    config: optimizedConfig,
  },
  {
    id: 'worst-case',
    label: worstCaseConfig.profileName,
    description: 'ESP32-S3 + SX1262, 1 mA Board-Grundlast, SF12, langes RX-Fenster; Schätzwerte',
    config: worstCaseConfig,
  },
]

export function cloneConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    mcu: { ...config.mcu },
    radio: { ...config.radio },
    sensors: config.sensors.map((sensor) => ({ ...sensor })),
    battery: { ...config.battery },
    solar: { ...config.solar },
  }
}

export function getDefaultConfig(): SimulationConfig {
  return cloneConfig(planningConfig)
}