import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Circle, Path } from 'react-native-svg';

/**
 * Gluestack UI ships no person/candidate icon — this follows the exact
 * pattern its own bundled icons use (`createIcon` + svg primitives), so it
 * behaves identically to e.g. `SearchIcon` (theme-aware, sizeable via `Icon`
 * props).
 */
export const PersonIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    </>
  ),
});
PersonIcon.displayName = 'PersonIcon';
