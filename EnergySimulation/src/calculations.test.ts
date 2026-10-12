import { describe, expect, it } from 'vitest'
import { calculateLoRaAirtimeMs, calculateSimulation } from './calculations'
import { getDefaultConfig } from './presets'

describe('calculateLoRaAirtimeMs', () => {
  it('matches the documented SF9 airtime', () => {
    const config = getDefaultConfig()

    expect(calculateLoRaAirtimeMs(config.radio)).toBeCloseTo(246.784, 3)
  })
})

describe('calculateSimulation', () => {
  it('stays close to the documented RAK4631 planning case', () => {
    const result = calculateSimulation(getDefaultConfig())

    expect(result.averageCurrentMa * 1000).toBeGreaterThan(73.5)
    expect(result.averageCurrentMa * 1000).toBeLessThan(75.5)
    expect(result.dailyChargeMah).toBeGreaterThan(1.76)
    expect(result.dailyChargeMah).toBeLessThan(1.82)
    expect(result.ownTransmissionsPerDay).toBe(48)
  })

  it('models continuous mesh reception as the dominant load', () => {
    const config = getDefaultConfig()
    config.networkMode = 'mesh'
    config.radio.meshRxDutyPercent = 100

    const result = calculateSimulation(config)

    expect(result.averageCurrentMa).toBeGreaterThan(17)
    expect(result.averageCurrentMa).toBeLessThan(17.2)
    expect(result.rxHoursPerDay).toBeGreaterThan(23.9)
  })

  it('reduces mesh consumption when synchronized RX windows are used', () => {
    const continuousConfig = getDefaultConfig()
    continuousConfig.networkMode = 'mesh'
    continuousConfig.radio.meshRxDutyPercent = 100
    const slottedConfig = getDefaultConfig()
    slottedConfig.networkMode = 'mesh'
    slottedConfig.radio.meshRxDutyPercent = 5

    const continuous = calculateSimulation(continuousConfig)
    const slotted = calculateSimulation(slottedConfig)

    expect(slotted.dailyChargeMah).toBeLessThan(
      continuous.dailyChargeMah * 0.1,
    )
    expect(slotted.warnings).toHaveLength(1)
  })

  it('updates the autonomy prediction when solar conditions change', () => {
    const config = getDefaultConfig()
    config.solar.panelPowerW = 0.01
    config.solar.lightPercent = 5
    const shaded = calculateSimulation(config)

    config.solar.lightPercent = 100
    const sunny = calculateSimulation(config)

    expect(shaded.projectedAutonomyDays).toBeGreaterThan(
      shaded.batteryAutonomyDays,
    )
    expect(sunny.projectedAutonomyDays).toBe(Infinity)
    expect(sunny.batteryAutonomyDays).toBe(shaded.batteryAutonomyDays)
  })

  it('scales solar yield with peak sun hours', () => {
    const config = getDefaultConfig()
    config.solar.panelPowerW = 1
    config.solar.lightPercent = 100
    config.solar.efficiencyPercent = 100
    config.solar.peakSunHours = 2
    const twoHours = calculateSimulation(config)

    config.solar.peakSunHours = 1
    const oneHour = calculateSimulation(config)

    expect(twoHours.solarYieldWhPerDay).toBe(2)
    expect(oneHour.solarYieldWhPerDay).toBe(1)
  })
})