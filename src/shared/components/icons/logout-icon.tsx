import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Line, Path, Polyline } from 'react-native-svg';

/**
 * Gluestack UI ships no logout/sign-out icon — follows the same
 * `createIcon` + svg-primitives pattern as `FilterIcon` so it behaves
 * identically to a bundled icon (theme-aware, sizeable via `Icon` props).
 */
export const LogoutIcon = createIcon({
  viewBox: '0 0 24 24',
  path: [
    <Path
      key="door"
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />,
    <Polyline
      key="arrow"
      points="16 17 21 12 16 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />,
    <Line key="line" x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  ],
});
LogoutIcon.displayName = 'LogoutIcon';
