import { describe, it, expect, vi } from 'vitest'
import { ProviderRegistry, ProviderDefinition } from './provider-registry'

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry()
    const mockProvider: ProviderDefinition = {
      id: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      resolveKey: () => 'sk-test-key',
      supportsToolCalling: true,
    }

    registry.register(mockProvider)
    expect(registry.get('anthropic')).toBe(mockProvider)
    expect(registry.get('google')).toBeUndefined()
  })

  it('lists all registered providers', () => {
    const registry = new ProviderRegistry()
    const p1: ProviderDefinition = { id: 'p1', displayName: 'P1', baseUrl: 'b1', resolveKey: () => 'k1', supportsToolCalling: true }
    const p2: ProviderDefinition = { id: 'p2', displayName: 'P2', baseUrl: 'b2', resolveKey: () => 'k2', supportsToolCalling: true }

    registry.register(p1)
    registry.register(p2)
    expect(registry.list()).toContain(p1)
    expect(registry.list()).toContain(p2)
    expect(registry.list().length).toBe(2)
  })

  it('filters authenticated providers', () => {
    const registry = new ProviderRegistry()
    const authP: ProviderDefinition = { id: 'auth', displayName: 'Auth', baseUrl: 'b1', resolveKey: () => 'key', supportsToolCalling: true }
    const unauthP: ProviderDefinition = { id: 'unauth', displayName: 'Unauth', baseUrl: 'b2', resolveKey: () => null, supportsToolCalling: true }

    registry.register(authP)
    registry.register(unauthP)

    const authenticated = registry.listAuthenticated()
    expect(authenticated).toContain(authP)
    expect(authenticated).not.toContain(unauthP)
    expect(authenticated.length).toBe(1)
  })

  it('updates provider definition on re-registration', () => {
    const registry = new ProviderRegistry()
    const p1: ProviderDefinition = { id: 'p1', displayName: 'P1', baseUrl: 'b1', resolveKey: () => 'k1', supportsToolCalling: true }
    const p1Updated: ProviderDefinition = { ...p1, displayName: 'P1 Updated' }

    registry.register(p1)
    registry.register(p1Updated)
    expect(registry.get('p1')?.displayName).toBe('P1 Updated')
  })
})
