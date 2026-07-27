import React, { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { ScrollView, VStack } from '@gluestack-ui/themed';

import type { ScreenAction } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';
import { ValidationEngine } from '@/runtime/validation';

import { ActionBar } from './action-bar';
import type { ScreenRendererProps } from './dynamic-form-engine.types';
import type { FormStateContextValue } from './form-state';
import { FormStateContext } from './form-state';
import { SectionRenderer } from './section-renderer';

const FILE_NAME = 'screen-renderer.tsx';
const SUPPORTED_ROOT_LAYOUTS = new Set<string>(['vertical', 'scroll']);

/**
 * `validateScreen` is a pure function of its arguments (see
 * src/runtime/validation/README.md), so one module-level instance is enough
 * — no per-runtime state to isolate.
 */
const validationEngine = new ValidationEngine();

/**
 * Rendering pipeline entry point (docs/04-Runtime/03-Dynamic-Form-Engine.md §7):
 * Screen Definition -> Layout -> Section Renderer -> Widget Resolver -> Widget Registry.
 * Only `vertical`/`scroll` layouts are implemented so far; any other declared
 * layout logs a warning and falls back to `vertical` rather than failing the
 * screen, per the schema's "unknown properties ignored for forward
 * compatibility" rule.
 */
export function ScreenRenderer({ screen, registry, onAction }: ScreenRendererProps): ReactElement {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((widgetId: string, value: string) => {
    LoggerService.info(`${FILE_NAME}: ScreenRenderer.setValue: field value changed`, { widgetId });
    setValues((previous) => ({ ...previous, [widgetId]: value }));
  }, []);

  const formStateValue = useMemo<FormStateContextValue>(
    () => ({ values, errors, setValue }),
    [values, errors, setValue],
  );

  const handleAction = useCallback(
    (action: ScreenAction) => {
      LoggerService.info(`${FILE_NAME}: ScreenRenderer.handleAction: action triggered`, {
        screenId: screen.screenId,
        action,
      });
      if (action === 'submit') {
        const validationErrors = validationEngine.validateScreen(screen, values);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) {
          LoggerService.warn(`${FILE_NAME}: ScreenRenderer.handleAction: submit blocked by validation errors`, {
            screenId: screen.screenId,
            errorCount: Object.keys(validationErrors).length,
          });
          return;
        }
      }
      onAction?.(action);
    },
    [screen, values, onAction],
  );

  LoggerService.info(`${FILE_NAME}: ScreenRenderer: rendering screen`, {
    screenId: screen.screenId,
    layout: screen.layout,
  });

  if (!SUPPORTED_ROOT_LAYOUTS.has(screen.layout)) {
    LoggerService.warn(`${FILE_NAME}: Unsupported screen layout, falling back to vertical`, {
      screenId: screen.screenId,
      layout: screen.layout,
    });
  }

  const sortedSections = [...screen.sections]
    .filter((section) => section.visible !== false)
    .sort((a, b) => a.order - b.order);

  const content = (
    <FormStateContext.Provider value={formStateValue}>
      <VStack space="md">
        {sortedSections.map((section) => (
          <SectionRenderer key={section.sectionId} section={section} registry={registry} />
        ))}
        <ActionBar screenId={screen.screenId} actions={screen.actions ?? []} onAction={handleAction} />
      </VStack>
    </FormStateContext.Provider>
  );

  return screen.layout === 'scroll' ? <ScrollView>{content}</ScrollView> : content;
}
