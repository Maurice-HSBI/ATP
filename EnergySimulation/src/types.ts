export type NetworkMode = 'p2p' | 'mesh'
export type DetailMode = 'basic' | 'advanced'
export type SolarEnvironment = 'forest' | 'city' | 'full-sun'
export type SolarOrientation = 'north' | 'east' | 'south' | 'west'

export interface SensorConfig {
  id: string
  name: string
  quantity: number
  activeCurrentMa: number
  activeDurationMs: number
  sleepCurrentUa: number
  enabled: boolean
}

export interface McuConfig {
  activeCurrentMa: number
  deepSleepCurrentUa: number
  meshStandbyCurrentUa: number
  measurementDurationMs: number
  transmissionDurationMs: number
}

export interface RadioConfig {
  txCurrentMa: number
  rxCurrentMa: number
  sleepCurrentUa: number
  rxAfterTxMs: number
  spreadingFactor: number
  bandwidthKhz: number
  codingRate: number
  preambleSymbols: number
  payloadBytes: number
  meshRxDutyPercent: number
  forwardedPacketsPerDay: number
}

export interface BatteryConfig {
  capacityMah: number
  usablePercent: number
  voltage: number
  selfDischargePercentMonth: number
}

export interface SolarConfig {
  panelPowerW: number
  peakSunHours: number
  lightPercent: number
  efficiencyPercent: number
  reserveFactor: number
  environment: SolarEnvironment
  orientation: SolarOrientation
}

export interface SimulationConfig {
  profileName: string
  detailMode: DetailMode
  networkMode: NetworkMode
  measurementIntervalMinutes: number
  sendIntervalMinutes: number
  baseLoadUa: number
  mcu: McuConfig
  radio: RadioConfig
  sensors: SensorConfig[]
  battery: BatteryConfig
  solar: SolarConfig
}

export interface EnergyComponent {
  id: 'base' | 'mcu' | 'radio' | 'sensors'
  label: string
  chargeMah: number
  energyWh: number
  sharePercent: number
  color: string
}

export interface SimulationResult {
  averageCurrentMa: number
  dailyChargeMah: number
  dailyEnergyWh: number
  measurementEventsPerDay: number
  ownTransmissionsPerDay: number
  totalTransmissionsPerDay: number
  airtimeMs: number
  txAirtimeSecondsPerDay: number
  txDutyPercent: number
  rxHoursPerDay: number
  batteryAutonomyDays: number
  projectedAutonomyDays: number
  solarYieldWhPerDay: number
  solarCoveragePercent: number
  solarBalanceWhPerDay: number
  requiredPanelPowerW: number
  components: EnergyComponent[]
  warnings: string[]
}

export interface SimulationPreset {
  id: string
  label: string
  description: string
  config: SimulationConfig
}