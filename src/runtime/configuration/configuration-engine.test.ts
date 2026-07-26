import { ConfigurationEngine } from './configuration-engine';

describe('ConfigurationEngine', () => {
  let engine: ConfigurationEngine;

  beforeEach(() => {
    engine = new ConfigurationEngine();
  });

  it('has no active configuration before initialize()', () => {
    expect(engine.getActiveConfiguration()).toBeUndefined();
  });

  it('activates the bundled sample configuration package on initialize()', async () => {
    await engine.initialize();

    const activeConfiguration = engine.getActiveConfiguration();

    expect(activeConfiguration?.configurationVersion).toBe('1.0.0');
    expect(activeConfiguration?.screens).toHaveLength(2);
  });

  it('resolves a screen definition by screenId', async () => {
    await engine.initialize();

    const screen = engine.getScreen('runtime-preview');

    expect(screen?.screenId).toBe('runtime-preview');
    expect(screen?.sections[0]?.widgets[0]?.labelKey).toBe('runtimePreview.helloMessage');
  });

  it('returns undefined for an unknown screenId', async () => {
    await engine.initialize();

    expect(engine.getScreen('does-not-exist')).toBeUndefined();
  });

  it('clears the active configuration on dispose', async () => {
    await engine.initialize();

    engine.dispose();

    expect(engine.getActiveConfiguration()).toBeUndefined();
  });
});
