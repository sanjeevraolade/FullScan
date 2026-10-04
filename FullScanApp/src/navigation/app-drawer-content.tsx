import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Avatar,
  AvatarFallbackText,
  Box,
  Button,
  ButtonIcon,
  ButtonText,
  ChevronRightIcon,
  Divider,
  HStack,
  Icon,
  Pressable,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { CaseListCache } from '@/features/cases';
import { LoggerService } from '@/infrastructure/logger';
import { logout } from '@/repositories/authentication-repository';
import { LogoutIcon } from '@/shared/components';
import { useSessionStore } from '@/store/session';
import { useReferenceDataStore } from '@/store/reference-data';
import { GeocodingService } from '@/infrastructure/geocoding';

import { ROUTE_NAMES } from './routes';
import type { RootStackParamList } from './routes';

const FILE_NAME = 'app-drawer-content.tsx';

interface DrawerMenuItem {
  readonly key: string;
  readonly labelKey: string;
  readonly onPress: () => void;
}

/**
 * Custom drawer content: field executive identity, a list of destinations,
 * and Logout pinned to the bottom. Registered as `drawerContent` on the
 * Drawer.Navigator in app-drawer-navigator.tsx.
 */
export function AppDrawerContent(props: DrawerContentComponentProps): ReactElement {
  const { navigation } = props;
  const { t } = useTranslation();
  const fieldExecutive = useSessionStore((state) => state.fieldExecutive);
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearReferenceData = useReferenceDataStore((state) => state.clearReferenceData);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  LoggerService.info(`${FILE_NAME}: AppDrawerContent: rendering`);
  // Identity fields (name/email) are PII and never logged — only presence.
  LoggerService.info(`${FILE_NAME}: AppDrawerContent: identity section state resolved`, {
    hasFieldExecutive: fieldExecutive !== null,
    hasNotice: noticeKey !== null,
  });

  const handleCaseListPress = (): void => {
    LoggerService.info(`${FILE_NAME}: AppDrawerContent.handleCaseListPress: navigating to case list`);
    setNoticeKey(null);
    navigation.navigate(ROUTE_NAMES.CASE_LIST);
    navigation.closeDrawer();
  };

  const handleComingSoonPress = (itemKey: string): void => {
    LoggerService.info(`${FILE_NAME}: AppDrawerContent.handleComingSoonPress: destination not built yet`, {
      itemKey,
    });
    setNoticeKey('drawer.items.comingSoon');
  };

  const menuItems: DrawerMenuItem[] = [
    { key: 'caseList', labelKey: 'drawer.items.caseList', onPress: handleCaseListPress },
    {
      key: 'profile',
      labelKey: 'drawer.items.profile',
      onPress: () => {
        LoggerService.info(`${FILE_NAME}: AppDrawerContent: profile item pressed`);
        handleComingSoonPress('profile');
      },
    },
    {
      key: 'settings',
      labelKey: 'drawer.items.settings',
      onPress: () => {
        LoggerService.info(`${FILE_NAME}: AppDrawerContent: settings item pressed`);
        handleComingSoonPress('settings');
      },
    },
  ];

  LoggerService.info(`${FILE_NAME}: AppDrawerContent: menu items built`, {
    itemCount: menuItems.length,
  });

  const handleLogoutPress = (): void => {
    LoggerService.info(`${FILE_NAME}: AppDrawerContent.handleLogoutPress: logging out`);
    // Session hygiene: the persisted token is cleared alongside in-memory
    // state so it can't be replayed after logout.
    void logout();
    clearSession();
    // In-memory copy only — the persisted master-data cache is kept on
    // purpose: it isn't per-user (`/master-data` is unauthenticated), and
    // keeping it is what saves the download on the next login.
    clearReferenceData();
    // Cached case coordinates are derived from candidate addresses, so they
    // don't outlive the session on a shared field device.
    GeocodingService.clearCache();
    // Same for the in-memory case-list pages: candidate names and addresses.
    CaseListCache.clear();
    // `.replace()` rather than `.reset()` — swaps "Main" for "Login" at the
    // same stack index so a subsequent back-button press can't return to an
    // authenticated screen post-logout, without needing a full state reset.
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (!rootNavigation) {
      LoggerService.warn(
        `${FILE_NAME}: AppDrawerContent.handleLogoutPress: no parent navigator, cannot return to login`,
      );
    } else {
      LoggerService.info(
        `${FILE_NAME}: AppDrawerContent.handleLogoutPress: session cleared, replacing stack with login`,
      );
    }
    rootNavigation?.replace(ROUTE_NAMES.LOGIN);
  };

  return (
    <Box flex={1} bg="$backgroundLight0" sx={{ _dark: { bg: '$backgroundDark950' } }}>
      <DrawerContentScrollView
        {...props}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        testID="drawer-content"
      >
        <VStack space="xs" px="$4" pt="$4" pb="$4" testID="drawer-identity-section">
          <Avatar size="lg" bg="$primary500">
            <AvatarFallbackText>{fieldExecutive?.name ?? ''}</AvatarFallbackText>
          </Avatar>
          <Text
            size="md"
            fontWeight="$semibold"
            color="$textLight900"
            sx={{ _dark: { color: '$textDark0' } }}
            testID="drawer-field-executive-name"
          >
            {fieldExecutive?.name ?? ''}
          </Text>
          <Text
            size="sm"
            color="$textLight500"
            sx={{ _dark: { color: '$textDark400' } }}
            testID="drawer-field-executive-email"
          >
            {fieldExecutive?.email ?? ''}
          </Text>
        </VStack>

        <Divider />

        <VStack pt="$2" testID="drawer-menu-section">
          {menuItems.map((item) => {
            LoggerService.info(`${FILE_NAME}: AppDrawerContent: rendering menu item`, {
              itemKey: item.key,
            });

            return (
              <Pressable
                key={item.key}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
                testID={`drawer-item-${item.key}`}
              >
                <HStack justifyContent="space-between" alignItems="center" px="$4" py="$3">
                  <Text size="md" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
                    {t(item.labelKey)}
                  </Text>
                  <Icon
                    as={ChevronRightIcon}
                    size="sm"
                    color="$textLight400"
                    sx={{ _dark: { color: '$textDark500' } }}
                  />
                </HStack>
              </Pressable>
            );
          })}

          {noticeKey ? (
            <Box px="$4" pt="$1">
              <Alert action="info" testID="drawer-notice">
                <AlertIcon as={AlertCircleIcon} mr="$2" />
                <AlertText size="xs">{t(noticeKey)}</AlertText>
              </Alert>
            </Box>
          ) : null}
        </VStack>
      </DrawerContentScrollView>

      <Box
        px="$4"
        pb="$6"
        pt="$3"
        borderTopWidth={1}
        borderTopColor="$borderLight200"
        sx={{ _dark: { borderTopColor: '$borderDark800' } }}
      >
        <Button
          variant="outline"
          action="negative"
          onPress={handleLogoutPress}
          accessibilityLabel={t('drawer.actions.logout')}
          testID="drawer-logout-button"
        >
          <ButtonIcon as={LogoutIcon} mr="$2" />
          <ButtonText>{t('drawer.actions.logout')}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
