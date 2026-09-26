import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'fingerprint-icon.tsx';

/**
 * Gluestack UI ships no fingerprint icon — follows the same `createIcon` +
 * svg pattern as `CameraIcon`/`ShieldIcon`, so it's theme-aware and sizeable
 * via `Icon` props exactly like the bundled icons. Shown on the Login screen
 * when the device's enrolled biometry is a fingerprint-style sensor.
 */
export const FingerprintIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M12 3a7 7 0 0 0-7 7v2c0 3 1 5.5 2.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 3a7 7 0 0 1 7 7v2c0 1.3-.15 2.5-.45 3.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 20a13 13 0 0 0 1.4-2.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M8 8.5a4 4 0 0 1 8 0v2.2c0 3.3-.9 6-2.4 8.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.5 8.3a1 1 0 0 1 2 0v2.4c0 3-.6 5.3-1.7 7.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});
FingerprintIcon.displayName = 'FingerprintIcon';

LoggerService.info(`${FILE_NAME}: FingerprintIcon: icon component defined`);
