import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

/**
 * Gluestack UI ships no shield icon — follows the same `createIcon` + svg
 * pattern as `MapPinIcon`, so it's theme-aware and sizeable via `Icon` props
 * exactly like the bundled icons. Used to signal GPS-integrity status
 * (genuine vs. mock location).
 */
export const ShieldIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <Path
      d="M12 3 4.5 6v6c0 5 3.2 8.4 7.5 9 4.3-.6 7.5-4 7.5-9V6z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
});
ShieldIcon.displayName = 'ShieldIcon';
