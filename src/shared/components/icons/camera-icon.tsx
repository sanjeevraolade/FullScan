import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Circle, Path } from 'react-native-svg';

/**
 * Gluestack UI ships no camera icon — follows the same `createIcon` + svg
 * pattern as `MapPinIcon`, so it's theme-aware and sizeable via `Icon` props
 * exactly like the bundled icons.
 */
export const CameraIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M4 8a2 2 0 0 1 2-2h1.17a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 11.318 3h1.364a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.83 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
    </>
  ),
});
CameraIcon.displayName = 'CameraIcon';
