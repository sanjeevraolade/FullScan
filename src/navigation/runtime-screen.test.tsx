import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { ReactTestRendererJSON, ReactTestRendererNode } from 'react-test-renderer';

import { VerificationRuntimeEngine } from '@/runtime/engine';
import { ThemeProvider } from '@/theme';
import { registerBuiltInWidgets } from '@/widgets';

import { RuntimeScreen } from './runtime-screen';

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

describe('RuntimeScreen', () => {
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

  it('resolves the screenId through the Runtime Engine and renders it', () => {
    act(() => {
      activeTree = ReactTestRenderer.create(
        <ThemeProvider>
          <RuntimeScreen screenId="login" runtimeEngine={engine} />
        </ThemeProvider>,
      );
    });

    const textNode = findByType(activeTree?.toJSON() ?? null, 'Text');
    expect(textNode?.children).toEqual(['Welcome to FullScan']);
  });

  it('renders a user-friendly fallback instead of crashing on an unknown screenId', () => {
    act(() => {
      activeTree = ReactTestRenderer.create(
        <ThemeProvider>
          <RuntimeScreen screenId="does-not-exist" runtimeEngine={engine} />
        </ThemeProvider>,
      );
    });

    const textNode = findByType(activeTree?.toJSON() ?? null, 'Text');
    expect(textNode?.children).toEqual(['This screen is not available. Please contact your administrator.']);
  });
});
