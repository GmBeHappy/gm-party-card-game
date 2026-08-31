import { describe, expect, it } from 'bun:test'
import { DEV_SESSION_SECRET, resolveSessionSecret } from '../src/config'

describe('the session secret', () => {
  it('falls back to the development value outside production', () => {
    expect(resolveSessionSecret({})).toBe(DEV_SESSION_SECRET)
    expect(resolveSessionSecret({ NODE_ENV: 'development' })).toBe(DEV_SESSION_SECRET)
  })

  it('uses a real secret wherever one is set', () => {
    expect(resolveSessionSecret({ SESSION_SECRET: 'abc123', NODE_ENV: 'production' })).toBe(
      'abc123',
    )
  })

  // Each of these boots a server whose seat tokens anyone could forge.
  it('refuses to start in production with no secret', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
  })

  it('refuses to start in production with an empty or blank secret', () => {
    expect(() => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: '' })).toThrow()
    expect(() => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: '   ' })).toThrow()
  })

  it('refuses to start in production with the committed development secret', () => {
    expect(() =>
      resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: DEV_SESSION_SECRET }),
    ).toThrow(/development default/)
  })
})
