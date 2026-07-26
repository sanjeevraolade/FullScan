import type { WidgetComponentProps } from '@/contracts';

import { WidgetRegistry } from './widget-registry';

function StubComponent(_props: WidgetComponentProps): null {
  return null;
}

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry();
    registry.initialize();
  });

  it('resolves a widget component after registration', () => {
    registry.register('text', () => StubComponent);

    expect(registry.isRegistered('text')).toBe(true);
    expect(registry.resolve('text')).toBe(StubComponent);
  });

  it('logs and returns undefined for an unresolved widget type', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const resolved = registry.resolve('camera');

    expect(resolved).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[FullScan] Widget type is not registered',
      { type: 'camera' },
    );

    warnSpy.mockRestore();
  });

  it('clears registrations on dispose', () => {
    registry.register('text', () => StubComponent);

    registry.dispose();

    expect(registry.isRegistered('text')).toBe(false);
  });
});
