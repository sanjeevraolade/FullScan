import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import type { WidgetDefinition } from '@/contracts';
import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { TextWidget } from './TextWidget';

const definition: WidgetDefinition = {
  widgetId: 'helloMessage',
  type: 'text',
  labelKey: 'runtimePreview.helloMessage',
};

type RenderedJson = ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | null;

let activeTree: ReactTestRenderer.ReactTestRenderer | undefined;

function renderWidget(): RenderedJson {
  act(() => {
    activeTree = ReactTestRenderer.create(
      <ThemeProvider>
        <TextWidget definition={definition} />
      </ThemeProvider>,
    );
  });
  return activeTree?.toJSON() ?? null;
}

describe('TextWidget', () => {
  beforeAll(async () => {
    await LocalizationEngine.initialize('en');
  });

  afterEach(() => {
    act(() => {
      activeTree?.unmount();
    });
    activeTree = undefined;
  });

  afterAll(() => {
    LocalizationEngine.dispose();
  });

  it('resolves its labelKey through the Localization Engine and renders via Gluestack Text', () => {
    const json = renderWidget();

    expect(json).toMatchObject({ type: 'Text', children: ['Hello Runtime'] });
  });

  it('re-renders with the label resolved in the active language', async () => {
    await LocalizationEngine.setLanguage('hi');

    const json = renderWidget();

    expect(json).toMatchObject({ type: 'Text', children: ['नमस्ते रनटाइम'] });

    await LocalizationEngine.setLanguage('en');
  });
});
