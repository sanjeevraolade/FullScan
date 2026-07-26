import React from 'react';
import type { ReactElement } from 'react';

import { ApplicationProvider } from './ApplicationProvider';
import { ApplicationShell } from './ApplicationShell';

export function Application(): ReactElement {
  return (
    <ApplicationProvider>
      <ApplicationShell />
    </ApplicationProvider>
  );
}
