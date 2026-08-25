import React from 'react';
import type { ReactElement } from 'react';
import { HStack, Icon, Image, Pressable, MenuIcon, SearchIcon, Text } from '@gluestack-ui/themed';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FilterIcon } from '@/shared/components';
import type { DrawerParamList, ROUTE_NAMES } from '@/navigation';

const FILE_NAME = 'case-list-nav-bar.tsx';
const LOGO_SIZE = 28;

export interface CaseListNavBarProps {
  readonly onToggleSearch: () => void;
  readonly onFilterPress: () => void;
}

/**
 * Brand navigation bar shown at the top of the case list, right after
 * login: app logo/name on the left, search and filter affordances on the
 * right. Drawer navigation is reached via the field executive identity row
 * below (`CaseListHeader`), not from here.
 */
export function CaseListNavBar({ onToggleSearch, onFilterPress }: CaseListNavBarProps): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList, typeof ROUTE_NAMES.CASE_LIST>>();

  LoggerService.info(`${FILE_NAME}: CaseListNavBar: rendering`);

  const handleToggleSearch = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListNavBar.handleToggleSearch: pressed`);
    onToggleSearch();
  };

  const handleFilterPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListNavBar.handleFilterPress: pressed`);
    onFilterPress();
  };

  const handleMenuPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListNavBar.handleMenuPress: opening drawer`);
    navigation.openDrawer();
  };


  return (
    <HStack
      bg="$backgroundLight0"
      borderBottomWidth="$1"
      borderColor="$borderLight200"
      alignItems="center"
      justifyContent="space-between"
      px="$4"
      py="$3"
      sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$borderDark700' } }}
      testID="case-list-nav-bar"
    >
      <HStack space="sm" alignItems="center">
        <Pressable
          onPress={handleMenuPress}
          accessibilityRole="button"
          accessibilityLabel={t('caseList.navBar.menuLabel')}
          testID="case-list-menu-button"
        >
          <Icon as={MenuIcon} size="lg" sx={{ _dark: { color: '$textDark300' } }} />
        </Pressable>
        <Image
          source={require('@/shared/assets/images/icon_72.png')}
          alt={t('login.logoAlt')}
          accessibilityLabel={t('login.logoAlt')}
          resizeMode="contain"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
        />
        <Text size="lg" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
          {t('common.appName')}
        </Text>
      </HStack>

      <HStack space="lg" alignItems="center">
        <Pressable
          onPress={handleToggleSearch}
          accessibilityLabel={t('caseList.header.searchLabel')}
          testID="case-list-search-toggle"
        >
          <Icon as={SearchIcon} size="lg" color="$textLight700" sx={{ _dark: { color: '$textDark300' } }} />
        </Pressable>
        <Pressable
          onPress={handleFilterPress}
          accessibilityLabel={t('caseList.header.filterLabel')}
          testID="case-list-filter-button"
        >
          <Icon as={FilterIcon} size="lg" color="$textLight700" sx={{ _dark: { color: '$textDark300' } }} />
        </Pressable>
      </HStack>
    </HStack>
  );
}
