import type {
  EnergyComponent,
  RadioConfig,
  SimulationConfig,
  SimulationResult,
} from './types'

const DAY_SECONDS = 86_400
const MINUTES_PER_DAY = 1_440
const DAYS_PER_MONTH = 30.4375

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function chargeToEnergy(chargeMah: number, voltage: number): number {
  return (chargeMah / 1000) * voltage
}

export function calculateLoRaAirtimeMs(radio: RadioConfig): number {
  const spreadingFactor = Math.min(12, Math.max(5, radio.spreadingFactor))
  const bandwidthHz = positive(radio.bandwidthKhz, 125) * 1000
  const symbolSeconds = 2 ** spreadingFactor / bandwidthHz
  const lowDataRateOptimization = symbolSeconds > 0.016 ? 1 : 0
  const payloadBytes = nonNegative(radio.payloadBytes)
  const codingRate = Math.min(8, Math.max(5, radio.codingRate))
  const numerator = 8 * payloadBytes - 4 * spreadingFactor + 44
  const denominator = 4 * (spreadingFactor - 2 * lowDataRateOptimization)
  const payloadSymbols =
    8 + Math.max(Math.ceil(numerator / denominator) * codingRate, 0)
  const preambleSymbols = nonNegative(radio.preambleSymbols) + 4.25

  return (preambleSymbols + payloadSymbols) * symbolSeconds * 1000
}

function calculateBatteryAutonomyDays(
  usableCapacityMah: number,
  dailyLoadMah: number,
  selfDischargePercentMonth: number,
): number {
  if (usableCapacityMah <= 0) return 0
  if (dailyLoadMah <= 0 && selfDischargePercentMonth <= 0) return Infinity

  const monthlyFraction = Math.min(
    0.999,
    nonNegative(selfDischargePercentMonth) / 100,
  )
  if (monthlyFraction === 0) return usableCapacityMah / dailyLoadMah

  const dailyDecay = -Math.log(1 - monthlyFraction) / DAYS_PER_MONTH
  if (dailyLoadMah === 0) return 1 / dailyDecay

  return Math.log1p((dailyDecay * usableCapacityMah) / dailyLoadMah) / dailyDecay
}

export function calculateSimulation(config: SimulationConfig): SimulationResult {
  const voltage = positive(config.battery.voltage, 3.7)
  const measurementInterval = positive(config.measurementIntervalMinutes, 5)
  const sendInterval = positive(config.sendIntervalMinutes, 30)
  const measurementEvents = MINUTES_PER_DAY / measurementInterval
  const ownTransmissions = MINUTES_PER_DAY / sendInterval
  const forwardedPackets =
    config.networkMode === 'mesh'
      ? nonNegative(config.radio.forwardedPacketsPerDay)
      : 0
  const totalTransmissions = ownTransmissions + forwardedPackets
  const warnings: string[] = []

  let sensorChargeMas = 0
  for (const sensor of config.sensors) {
    if (!sensor.enabled) continue
    const quantity = nonNegative(sensor.quantity)
    const activeSeconds = Math.min(
      DAY_SECONDS,
      (measurementEvents * nonNegative(sensor.activeDurationMs)) / 1000,
    )
    const sleepSeconds = DAY_SECONDS - activeSeconds
    sensorChargeMas +=
      quantity *
      (nonNegative(sensor.activeCurrentMa) * activeSeconds +
        (nonNegative(sensor.sleepCurrentUa) / 1000) * sleepSeconds)

    if (
      (measurementEvents * nonNegative(sensor.activeDurationMs)) / 1000 >
      DAY_SECONDS
    ) {
      warnings.push(`${sensor.name}: Aktivzeit überschreitet 24 Stunden.`)
    }
  }

  const mcuActiveSecondsRaw =
    (measurementEvents * nonNegative(config.mcu.measurementDurationMs) +
      totalTransmissions * nonNegative(config.mcu.transmissionDurationMs)) /
    1000
  const mcuActiveSeconds = Math.min(DAY_SECONDS, mcuActiveSecondsRaw)
  const mcuRestSeconds = DAY_SECONDS - mcuActiveSeconds
  const mcuRestCurrentMa =
    config.networkMode === 'p2p'
      ? nonNegative(config.mcu.deepSleepCurrentUa) / 1000
      : nonNegative(config.mcu.meshStandbyCurrentUa) / 1000
  const mcuChargeMas =
    nonNegative(config.mcu.activeCurrentMa) * mcuActiveSeconds +
    mcuRestCurrentMa * mcuRestSeconds

  if (mcuActiveSecondsRaw > DAY_SECONDS) {
    warnings.push('Die berechnete µC-Aktivzeit überschreitet 24 Stunden.')
  }

  const airtimeMs = calculateLoRaAirtimeMs(config.radio)
  const txSeconds = Math.min(
    DAY_SECONDS,
    (totalTransmissions * airtimeMs) / 1000,
  )
  const radioTimeAfterTx = DAY_SECONDS - txSeconds
  const rxSeconds =
    config.networkMode === 'p2p'
      ? Math.min(
          radioTimeAfterTx,
          (totalTransmissions * nonNegative(config.radio.rxAfterTxMs)) / 1000,
        )
      : Math.min(
          radioTimeAfterTx,
          (DAY_SECONDS *
            Math.min(100, nonNegative(config.radio.meshRxDutyPercent))) /
            100,
        )
  const radioSleepSeconds = Math.max(
    0,
    DAY_SECONDS - txSeconds - rxSeconds,
  )
  const radioChargeMas =
    nonNegative(config.radio.txCurrentMa) * txSeconds +
    nonNegative(config.radio.rxCurrentMa) * rxSeconds +
    (nonNegative(config.radio.sleepCurrentUa) / 1000) * radioSleepSeconds
  const baseChargeMas =
    (nonNegative(config.baseLoadUa) / 1000) * DAY_SECONDS

  const rawComponents = [
    {
      id: 'base' as const,
      label: 'Grundlast',
      chargeMah: baseChargeMas / 3600,
      color: '#73806f',
    },
    {
      id: 'mcu' as const,
      label: 'Mikrocontroller',
      chargeMah: mcuChargeMas / 3600,
      color: '#176b68',
    },
    {
      id: 'radio' as const,
      label: 'Funk',
      chargeMah: radioChargeMas / 3600,
      color: '#d2643f',
    },
    {
      id: 'sensors' as const,
      label: 'Sensoren',
      chargeMah: sensorChargeMas / 3600,
      color: '#d5a326',
    },
  ]
  const dailyChargeMah = rawComponents.reduce(
    (total, component) => total + component.chargeMah,
    0,
  )
  const dailyEnergyWh = chargeToEnergy(dailyChargeMah, voltage)
  const components: EnergyComponent[] = rawComponents.map((component) => ({
    ...component,
    energyWh: chargeToEnergy(component.chargeMah, voltage),
    sharePercent:
      dailyChargeMah > 0 ? (component.chargeMah / dailyChargeMah) * 100 : 0,
  }))

  const usableCapacityMah =
    nonNegative(config.battery.capacityMah) *
    (Math.min(100, nonNegative(config.battery.usablePercent)) / 100)
  const batteryAutonomyDays = calculateBatteryAutonomyDays(
    usableCapacityMah,
    dailyChargeMah,
    config.battery.selfDischargePercentMonth,
  )

  const solarYieldWhPerDay =
    nonNegative(config.solar.panelPowerW) *
    nonNegative(config.solar.peakSunHours) *
    (Math.min(100, nonNegative(config.solar.lightPercent)) / 100) *
    (Math.min(100, nonNegative(config.solar.efficiencyPercent)) / 100)
  const solarChargeMahPerDay = (solarYieldWhPerDay / voltage) * 1000
  const projectedAutonomyDays =
    solarChargeMahPerDay >= dailyChargeMah
      ? Infinity
      : calculateBatteryAutonomyDays(
          usableCapacityMah,
          dailyChargeMah - solarChargeMahPerDay,
          config.battery.selfDischargePercentMonth,
        )
  const solarDenominator =
    nonNegative(config.solar.peakSunHours) *
    (Math.min(100, nonNegative(config.solar.lightPercent)) / 100) *
    (Math.min(100, nonNegative(config.solar.efficiencyPercent)) / 100)
  const requiredPanelPowerW =
    solarDenominator > 0
      ? (dailyEnergyWh * positive(config.solar.reserveFactor, 1)) /
        solarDenominator
      : Infinity
  const txDutyPercent = (txSeconds / DAY_SECONDS) * 100

  if (txDutyPercent > 1) {
    warnings.push('Die tägliche Sendezeit liegt über 1 % Airtime.')
  }
  if (
    config.networkMode === 'mesh' &&
    config.radio.meshRxDutyPercent < 100
  ) {
    warnings.push(
      'RX-Zeitschlitze benötigen Protokollunterstützung und eine ausreichend genaue Synchronisation.',
    )
  }
  if (solarDenominator === 0) {
    warnings.push('Ohne Licht oder Wirkungsgrad kann keine Panelgröße berechnet werden.')
  }

  return {
    averageCurrentMa: dailyChargeMah / 24,
    dailyChargeMah,
    dailyEnergyWh,
    measurementEventsPerDay: measurementEvents,
    ownTransmissionsPerDay: ownTransmissions,
    totalTransmissionsPerDay: totalTransmissions,
    airtimeMs,
    txAirtimeSecondsPerDay: txSeconds,
    txDutyPercent,
    rxHoursPerDay: rxSeconds / 3600,
    batteryAutonomyDays,
    projectedAutonomyDays,
    solarYieldWhPerDay,
    solarCoveragePercent:
      dailyEnergyWh > 0 ? (solarYieldWhPerDay / dailyEnergyWh) * 100 : 100,
    solarBalanceWhPerDay: solarYieldWhPerDay - dailyEnergyWh,
    requiredPanelPowerW,
    components,
    warnings,
  }
}