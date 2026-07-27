import React from 'react';
import type { ReactElement } from 'react';
import { VStack } from '@gluestack-ui/themed';

import type { WidgetComponent, WidgetDefinition } from '@/contracts';
import { LoggerService } from '@/infrastructure/logger';

import type { SectionRendererProps } from './dynamic-form-engine.types';
import { useFormField } from './form-state';

const FILE_NAME = 'section-renderer.tsx';

interface ConnectedWidgetProps {
  readonly Component: WidgetComponent;
  readonly definition: WidgetDefinition;
}

/**
 * One component per widget instance so `useFormField` (a hook) can be called
 * unconditionally per iteration, per the Rules of Hooks — it can't be called
 * directly inside `.map()`.
 */
function ConnectedWidget({ Component, definition }: ConnectedWidgetProps): ReactElement {
  const { value, error, onChange } = useFormField(definition.widgetId);

  return <Component definition={definition} value={value} error={error} onChange={onChange} />;
}

/**
 * Resolves each widget through the Widget Registry rather than a switch
 * statement (Open/Closed). An unresolved type is skipped — the registry
 * already logs the miss — so one bad widget never fails the whole screen.
 */
export function SectionRenderer({ section, registry }: SectionRendererProps): ReactElement {
  LoggerService.info(`${FILE_NAME}: SectionRenderer: rendering section`, { sectionId: section.sectionId });
  const sortedWidgets = [...section.widgets]
    .filter((widget) => widget.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <VStack space="sm">
      {sortedWidgets.map((widget) => {
        const WidgetComponent = registry.resolve(widget.type);
        if (!WidgetComponent) {
          LoggerService.warn(`${FILE_NAME}: SectionRenderer: skipping widget, no component resolved`, {
            sectionId: section.sectionId,
            widgetId: widget.widgetId,
            type: widget.type,
          });
        }
        return WidgetComponent ? (
          <ConnectedWidget key={widget.widgetId} Component={WidgetComponent} definition={widget} />
        ) : null;
      })}
    </VStack>
  );
}
