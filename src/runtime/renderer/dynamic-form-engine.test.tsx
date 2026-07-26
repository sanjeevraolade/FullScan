import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRendererJSON, ReactTestRendererNode } from 'react-test-renderer';

import { LocalizationEngine } from '@/localization';
import { VerificationRuntimeEngine } from '@/runtime/engine';
import { WidgetRegistry } from '@/runtime/registry';
import { ThemeEngine, ThemeProvider } from '@/theme';
import { registerBuiltInWidgets } from '@/widgets';

import { ScreenRenderer } from './screen-renderer';

function findByType(
  node: ReactTestRendererNode | ReactTestRendererNode[] | null,
  type: string,
): ReactTestRendererJSON | null {
  if (node === null || typeof node === 'string') {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (node.type === type) {
    return node;
  }
  return findByType(node.children, type);
}

/**
 * End-to-end proof for the "Hello Runtime" sprint goal: Configuration Engine
 * -> Verification Runtime Engine -> Widget Registry -> Dynamic Form Engine
 * (ScreenRenderer) -> registered widget, all through the same public APIs
 * a real screen would use. No `App.tsx`/navigation involved — see
 * src/runtime/renderer/README.md.
 */
describe('Dynamic Form Engine pipeline', () => {
  let engine: VerificationRuntimeEngine;
  let activeTree: ReactTestRenderer.ReactTestRenderer | undefined;

  beforeEach(async () => {
    engine = new VerificationRuntimeEngine();
    await engine.initialize();
  });

  afterEach(() => {
    act(() => {
      activeTree?.unmount();
    });
    activeTree = undefined;
    engine.dispose();
  });

  it('renders the configuration-defined screen through the registered widget, themed', () => {
    registerBuiltInWidgets(engine.getWidgetRegistry());
    const screen = engine.getScreen('runtime-preview');
    expect(screen).toBeDefined();

    act(() => {
      activeTree = ReactTestRenderer.create(
        <ThemeProvider>
          {screen ? <ScreenRenderer screen={screen} registry={engine.getWidgetRegistry()} /> : null}
        </ThemeProvider>,
      );
    });

    const textNode = findByType(activeTree?.toJSON() ?? null, 'Text');

    expect(textNode?.children).toEqual(['Hello Runtime']);
    // Proves styling came from the Theme Engine, not a literal in the widget.
    expect(textNode?.props['style']).toBeTruthy();
    expect(ThemeEngine.getTokens().primary).toBeTruthy();
  });

  it('re-renders the same configuration in the active language', async () => {
    registerBuiltInWidgets(engine.getWidgetRegistry());
    const screen = engine.getScreen('runtime-preview');
    if (!screen) {
      throw new Error('sample-configuration.json must define the runtime-preview screen');
    }

    await LocalizationEngine.setLanguage('te');

    act(() => {
      activeTree = ReactTestRenderer.create(
        <ThemeProvider>
          <ScreenRenderer screen={screen} registry={engine.getWidgetRegistry()} />
        </ThemeProvider>,
      );
    });

    const textNode = findByType(activeTree?.toJSON() ?? null, 'Text');
    expect(textNode?.children).toEqual(['హలో రన్‌టైమ్']);

    await LocalizationEngine.setLanguage('en');
  });

  it('never hardcodes the widget — an unresolved type renders nothing instead of throwing', () => {
    const screen = engine.getScreen('runtime-preview');
    if (!screen) {
      throw new Error('sample-configuration.json must define the runtime-preview screen');
    }
    const emptyRegistry = new WidgetRegistry();
    emptyRegistry.initialize();

    expect(() => {
      act(() => {
        activeTree = ReactTestRenderer.create(
          <ThemeProvider>
            <ScreenRenderer screen={screen} registry={emptyRegistry} />
          </ThemeProvider>,
        );
      });
    }).not.toThrow();

    expect(findByType(activeTree?.toJSON() ?? null, 'Text')).toBeNull();
  });
});
