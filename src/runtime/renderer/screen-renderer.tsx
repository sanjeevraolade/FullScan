import React from 'react';
import type { ReactElement } from 'react';
import { ScrollView, VStack } from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

import { ActionBar } from './action-bar';
import type { ScreenRendererProps } from './dynamic-form-engine.types';
import { SectionRenderer } from './section-renderer';

const SUPPORTED_ROOT_LAYOUTS = new Set<string>(['vertical', 'scroll']);

/**
 * Rendering pipeline entry point (docs/04-Runtime/03-Dynamic-Form-Engine.md §7):
 * Screen Definition -> Layout -> Section Renderer -> Widget Resolver -> Widget Registry.
 * Only `vertical`/`scroll` layouts are implemented so far; any other declared
 * layout logs a warning and falls back to `vertical` rather than failing the
 * screen, per the schema's "unknown properties ignored for forward
 * compatibility" rule.
 */
export function ScreenRenderer({ screen, registry, onAction }: ScreenRendererProps): ReactElement {
  if (!SUPPORTED_ROOT_LAYOUTS.has(screen.layout)) {
    LoggerService.warn('Unsupported screen layout, falling back to vertical', {
      screenId: screen.screenId,
      layout: screen.layout,
    });
  }

  const sortedSections = [...screen.sections]
    .filter((section) => section.visible !== false)
    .sort((a, b) => a.order - b.order);

  const content = (
    <VStack space="md">
      {sortedSections.map((section) => (
        <SectionRenderer key={section.sectionId} section={section} registry={registry} />
      ))}
      <ActionBar screenId={screen.screenId} actions={screen.actions ?? []} onAction={onAction} />
    </VStack>
  );

  return screen.layout === 'scroll' ? <ScrollView>{content}</ScrollView> : content;
}
