import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Circle, Path } from 'react-native-svg';

/**
 * Gluestack UI ships no clock icon — follows the same `createIcon` + svg
 * pattern as `MapPinIcon`, so it's theme-aware and sizeable via `Icon` props
 * exactly like the bundled icons.
 */
export const ClockIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <Path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
});
ClockIcon.displayName = 'ClockIcon';
