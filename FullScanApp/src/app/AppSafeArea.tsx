import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { Box } from '@gluestack-ui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'AppSafeArea.tsx';
const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export interface AppSafeAreaProps extends PropsWithChildren {
  /**
   * Edges to reserve inset padding for. Defaults to all four. Callers
   * wrapping a native-header screen (React Navigation's stack/drawer
   * headers already consume the top inset themselves) should exclude
   * `'top'` here to avoid double-padding it.
   */
  readonly edges?: readonly Edge[];
}

/**
 * Applies real safe-area insets (notch/status bar/home indicator) via
 * react-native-safe-area-context's SafeAreaView — Gluestack's own
 * SafeAreaView is deprecated in favour of this package (see its runtime
 * console warning).
 *
 * Background is Gluestack's `white` token, matching the native splash
 * screen exactly (`ios/FullScan/BootSplash.storyboard` and
 * `android/.../colors.xml`'s `bootsplash_background` are both `#FFFFFF`) so
 * there is no flash of a different color between splash-hide and first
 * paint. The splash asset has no dark-mode variant, so this intentionally
 * stays white regardless of color scheme until one is generated.
 */
export function AppSafeArea({ children, edges = ALL_EDGES }: AppSafeAreaProps): ReactElement {
  LoggerService.info(`${FILE_NAME}: AppSafeArea: rendering`, { edges });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      <Box flex={1} bg="$white">
        {children}
      </Box>
    </SafeAreaView>
  );
}
