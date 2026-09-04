import React from 'react';
import type { ReactElement } from 'react';

import { LoggerService } from '@/infrastructure/logger';
import { RootNavigator } from '@/navigation';
import { LocationGuard } from '@/shared/components';
import { useLocationReadinessMonitor } from '@/store/location';
import { useSessionStore } from '@/store/session';

import { AppSafeArea } from './AppSafeArea';

const FILE_NAME = 'ApplicationShell.tsx';

/**
 * Composes the app shell: safe area + the navigation stack (screen
 * registration/route typing lives in src/navigation, per
 * fullscan-navigation). Login is the stack's initial route — see
 * src/navigation/root-navigator.tsx for why it's the only route so far.
 *
 * Excludes the `top` edge: React Navigation's native stack/drawer headers
 * already consume the top safe-area inset for screens that have one
 * (Case List, Case Details); reserving it here too would double-pad them.
 * Login has no native header, so it applies its own top inset directly.
 *
 * Location enforcement is anchored here rather than per-screen so a blocked
 * device is blocked everywhere at once: the monitor evaluates readiness the
 * moment a session exists (`Login Success → Load mobileAppSettings →
 * Validate Location → App Ready`) and again on every app resume, and
 * `LocationGuard` renders the persistent bottom banner plus the interaction
 * blocker. Both are inert before login so the Login screen stays usable.
 */
export function ApplicationShell(): ReactElement {
  const isAuthenticated = useSessionStore((state) => {
    LoggerService.info(`${FILE_NAME}: ApplicationShell: evaluating session state `, { fieldExecutive: state.fieldExecutive });
    // Identity only — never the session token or the executive's details.
    const hasFieldExecutive = state.fieldExecutive !== null;
    LoggerService.info(`${FILE_NAME}: ApplicationShell: session selector evaluated`, {
      hasFieldExecutive,
    });
    return hasFieldExecutive;
  });
  useLocationReadinessMonitor(isAuthenticated);

  LoggerService.info(`${FILE_NAME}: ApplicationShell: rendering root navigator`, {
    isAuthenticated,
  });

  if (isAuthenticated) {
    LoggerService.info(
      `${FILE_NAME}: ApplicationShell: session present — location readiness monitoring and enforcement are active`,
    );
  } else {
    LoggerService.info(
      `${FILE_NAME}: ApplicationShell: no session — location enforcement stays inert so Login remains usable`,
    );
  }

  return (
    <AppSafeArea edges={['left', 'right', 'bottom']}>
      <LocationGuard isEnforced={isAuthenticated}>
        <RootNavigator />
      </LocationGuard>
    </AppSafeArea>
  );
}
