import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRendererJSON, ReactTestRendererNode } from 'react-test-renderer';

import { VerificationRuntimeEngine } from '@/runtime/engine';
import { ThemeProvider } from '@/theme';
import { registerBuiltInWidgets } from '@/widgets';

import { RootNavigator } from './root-navigator';

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
 * Proves the missing piece this change adds: a real NavigationContainer +
 * native-stack now sits between the app shell and the Runtime, with Login
 * as the stack's initial route — not a hardcoded direct render.
 */
describe('RootNavigator', () => {
  let engine: VerificationRuntimeEngine;
  let activeTree: ReactTestRenderer.ReactTestRenderer | undefined;

  beforeEach(async () => {
    engine = new VerificationRuntimeEngine();
    await engine.initialize();
    registerBuiltInWidgets(engine.getWidgetRegistry());
  });

  afterEach(() => {
    act(() => {
      activeTree?.unmount();
    });
    activeTree = undefined;
    engine.dispose();
  });

  it('lands on the Login screen as the initial route', () => {
    act(() => {
      activeTree = ReactTestRenderer.create(
        <ThemeProvider>
          <RootNavigator runtimeEngine={engine} />
        </ThemeProvider>,
      );
    });

    const textNode = findByType(activeTree?.toJSON() ?? null, 'Text');
    expect(textNode?.children).toEqual(['Welcome to FullScan']);
  });
});
