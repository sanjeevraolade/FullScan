import React from 'react';
import type { ReactElement } from 'react';
import { VStack } from '@gluestack-ui/themed';

import type { SectionRendererProps } from './dynamic-form-engine.types';

/**
 * Resolves each widget through the Widget Registry rather than a switch
 * statement (Open/Closed). An unresolved type is skipped — the registry
 * already logs the miss — so one bad widget never fails the whole screen.
 */
export function SectionRenderer({ section, registry }: SectionRendererProps): ReactElement {
  const sortedWidgets = [...section.widgets]
    .filter((widget) => widget.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <VStack space="sm">
      {sortedWidgets.map((widget) => {
        const WidgetComponent = registry.resolve(widget.type);
        return WidgetComponent ? <WidgetComponent key={widget.widgetId} definition={widget} /> : null;
      })}
    </VStack>
  );
}
