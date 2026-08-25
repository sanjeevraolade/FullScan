import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

/**
 * Gluestack UI ships no house/home icon — follows the same `createIcon` +
 * svg pattern as `MapPinIcon`, so it's theme-aware and sizeable via `Icon`
 * props exactly like the bundled icons.
 */
export const HomeIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M3 10.5 12 3l9 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 9.5V20a1 1 0 0 0 1 1h4v-5a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v5h4a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});
HomeIcon.displayName = 'HomeIcon';
