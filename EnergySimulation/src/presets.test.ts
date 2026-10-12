import { describe, expect, it } from 'vitest'
import { getDefaultConfig, getSolarLightPercent } from './presets'

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