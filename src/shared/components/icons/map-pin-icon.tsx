import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Circle, Path } from 'react-native-svg';

/**
 * Gluestack UI ships no location/map-pin icon — this follows the exact
 * pattern its own bundled icons use (`createIcon` + svg primitives), so it
 * behaves identically to e.g. `SearchIcon` (theme-aware, sizeable via `Icon`
 * props).
 */
export const MapPinIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
    </>
  ),
});
MapPinIcon.displayName = 'MapPinIcon';
