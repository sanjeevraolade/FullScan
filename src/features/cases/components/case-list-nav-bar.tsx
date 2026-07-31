import React from 'react';
import type { ReactElement } from 'react';
import { HStack, Image, Text } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

const LOGO_SIZE = 28;

/**
 * Brand navigation bar shown at the top of the case list, right after
 * login. Fixed dark-gray background — unlike the rest of the screen it
 * does not flip with light/dark theme, the same way a branded app bar
 * wouldn't in most apps.
 */
export function CaseListNavBar(): ReactElement {
  const { t } = useTranslation();

  return (
    <HStack bg="$secondary800" alignItems="center" space="sm" px="$4" py="$3" testID="case-list-nav-bar">
      <Image
        source={require('@/shared/assets/images/icon_72.png')}
        alt={t('login.logoAlt')}
        accessibilityLabel={t('login.logoAlt')}
        resizeMode="contain"
        width={LOGO_SIZE}
        height={LOGO_SIZE}
      />
      <Text size="lg" fontWeight="$semibold" color="$textDark0">
        {t('common.appName')}
      </Text>
    </HStack>
  );
}
