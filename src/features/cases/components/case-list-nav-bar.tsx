import React from 'react';
import type { ReactElement } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { HStack, Icon, Image, MenuIcon, Pressable, Text } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { DrawerParamList } from '@/navigation/routes';

const FILE_NAME = 'case-list-nav-bar.tsx';
const LOGO_SIZE = 28;

/**
 * Brand navigation bar shown at the top of the case list, right after
 * login. Fixed dark-gray background — unlike the rest of the screen it
 * does not flip with light/dark theme, the same way a branded app bar
 * wouldn't in most apps.
 */
export function CaseListNavBar(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList, typeof ROUTE_NAMES.CASE_LIST>>();

  LoggerService.info(`${FILE_NAME}: CaseListNavBar: rendering`);

  const handleMenuPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListNavBar.handleMenuPress: opening drawer`);
    navigation.openDrawer();
  };

  return (
    <HStack bg="$secondary800" alignItems="center" space="sm" px="$4" py="$3" testID="case-list-nav-bar">
      <Pressable
        onPress={handleMenuPress}
        accessibilityRole="button"
        accessibilityLabel={t('caseList.navBar.menuLabel')}
        testID="case-list-menu-button"
      >
        <Icon as={MenuIcon} size="lg" color="$textDark0" />
      </Pressable>
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
