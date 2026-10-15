import { describe, expect, it } from 'vitest'
import { getDefaultConfig, getSolarLightPercent, presets } from './presets'

describe('ESP32-S3 hardware presets', () => {
  it('uses the Heltec Wireless Stick Lite V3 planning assumptions by default', () => {
    const config = getDefaultConfig()

    expect(config.profileName).toBe('Heltec Wireless Stick Lite V3 · Planung')
    expect(config.networkMode).toBe('p2p')
    expect(config.baseLoadUa).toBe(100)
    expect(config.mcu.activeCurrentMa).toBe(40)
    expect(config.mcu.deepSleepCurrentUa).toBe(8)
    expect(config.mcu.meshStandbyCurrentUa).toBe(240)
    expect(config.mcu.measurementDurationMs).toBe(500)
    expect(config.radio.sleepCurrentUa).toBe(0.6)
  })

  it('offers only ESP32-S3 profiles with distinct board and radio assumptions', () => {
    expect(presets.map((preset) => preset.id)).toEqual([
      'planning', 'optimized', 'worst-case',
    ])
    for (const preset of presets) {
      expect(preset.label).toBe(preset.config.profileName)
      expect(preset.label).toContain('Heltec Wireless Stick Lite V3')
      expect(preset.config.mcu.activeCurrentMa).toBe(40)
    }
    expect(presets.map((preset) => preset.config.baseLoadUa)).toEqual([100, 20, 1000])
    expect(presets.map((preset) => preset.config.radio.spreadingFactor)).toEqual([9, 7, 12])
  })

  it('returns independent configurations without mutating the presets', () => {
    const config = getDefaultConfig()
    config.mcu.activeCurrentMa = 1
    config.radio.sleepCurrentUa = 0
    config.sensors[0].enabled = false

    const next = getDefaultConfig()
    expect(next.mcu.activeCurrentMa).toBe(40)
    expect(next.radio.sleepCurrentUa).toBe(0.6)
    expect(next.sensors[0].enabled).toBe(true)
  })
})

describe('solar presets', () => {
  it('matches the documented open-area and shaded cases', () => {
    expect(getSolarLightPercent('full-sun', 'south')).toBe(100)
    expect(getSolarLightPercent('full-sun', 'north')).toBe(10)
    expect(getSolarLightPercent('forest', 'south')).toBe(10)
    expect(getSolarLightPercent('forest', 'north')).toBe(5)
  })

  it('keeps the planning profile on the forest preset', () => {
    const config = getDefaultConfig()

    expect(config.solar.environment).toBe('forest')
    expect(config.solar.orientation).toBe('south')
    expect(config.solar.lightPercent).toBe(10)
  })

  it('falls back safely for legacy solar configurations', () => {
    expect(getSolarLightPercent(undefined, undefined)).toBe(10)
  })
})