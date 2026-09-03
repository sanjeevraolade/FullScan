import React, { useLayoutEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Box,
  Button,
  ButtonText,
  HStack,
  Icon,
  Image,
  MenuIcon,
  Pressable,
  RefreshControl,
  SearchIcon,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { DrawerParamList, RootStackParamList } from '@/navigation/routes';
import { FilterIcon } from '@/shared/components';
import type { Case, CaseBucket } from '@/domain/case';

import { CaseBucketTabs } from '../components/case-bucket-tabs';
import { CaseCard } from '../components/case-card';
import { CaseListHeader } from '../components/case-list-header';
import { useCaseList } from '../hooks/use-case-list';

const LOGO_SIZE = 28;

const FILE_NAME = 'case-list-screen.tsx';

/**
 * Case List is a Drawer screen (see app-drawer-navigator.tsx) nested inside
 * the root stack's "Main" route, so navigating to Case Details — a sibling
 * of Main on the root stack, not a drawer screen — needs both navigators'
 * navigation props composed together.
 */
type CaseListNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, typeof ROUTE_NAMES.CASE_LIST>,
  NativeStackNavigationProp<RootStackParamList>
>;

function isAcceptableBucket(bucket: CaseBucket): boolean {
  const isAcceptable = bucket === 'new';
  LoggerService.info(`${FILE_NAME}: isAcceptableBucket: evaluated bucket`, {
    bucket,
    isAcceptable,
  });
  return isAcceptable;
}

function isCallableBucket(bucket: CaseBucket): boolean {
  const isCallable = bucket === 'pending' || bucket === 'beyondTat';
  LoggerService.info(`${FILE_NAME}: isCallableBucket: evaluated bucket`, { bucket, isCallable });
  return isCallable;
}

/**
 * Landing page shown right after login: the field executive's assigned
 * cases, grouped into New / Pending / Beyond TAT / Completed. Presentation
 * only — data fetching, filtering and the Accept action all live in
 * `useCaseList`.
 */
export function CaseListScreen(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<CaseListNavigationProp>();
  const {
    selectedBucket,
    selectBucket,
    bucketCounts,
    visibleCases,
    searchQuery,
    setSearchQuery,
    isLoading,
    isRefreshing,
    loadError,
    refresh,
    acceptingCaseId,
    acceptCase,
  } = useCaseList();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  LoggerService.info(`${FILE_NAME}: CaseListScreen: rendering`, { selectedBucket });

  const handleToggleSearch = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleToggleSearch: toggling search bar`);
    setIsSearchVisible((previous) => {
      LoggerService.info(`${FILE_NAME}: CaseListScreen.handleToggleSearch: search bar visibility`, {
        isSearchVisible: !previous,
      });
      return !previous;
    });
  };

  const handleFilterPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleFilterPress: filters not implemented yet`);
    setNoticeKey('caseList.header.filterComingSoon');
  };

  const handleCallPress = (caseId: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleCallPress: masked calling not implemented yet`, {
      caseId,
    });
    setNoticeKey('caseList.actions.callComingSoon');
  };

  const handleMenuPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleMenuPress: opening drawer`);
    navigation.openDrawer();
  };

  const handleCasePress = (caseItem: Case): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleCasePress: opening case details`, {
      caseId: caseItem.id,
    });
    navigation.navigate(ROUTE_NAMES.CASE_DETAILS, { caseId: caseItem.id });
  };

  const renderCase = ({ item }: { item: Case }): ReactElement => {
    // Candidate/client names are PII — only the case id and bucket are logged.
    LoggerService.info(`${FILE_NAME}: renderCase: rendering case card`, {
      caseId: item.id,
      bucket: item.bucket,
      isAccepting: acceptingCaseId === item.id,
    });
    return (
      <CaseCard
        caseItem={item}
        onPress={handleCasePress}
        onAccept={isAcceptableBucket(item.bucket) ? acceptCase : undefined}
        isAccepting={acceptingCaseId === item.id}
        onCall={isCallableBucket(item.bucket) ? handleCallPress : undefined}
      />
    );
  };

  useLayoutEffect(() => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen: header effect running`);
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerLeft: () => (
        <Pressable
          onPress={handleMenuPress}
          accessibilityRole="button"
          accessibilityLabel={t('caseList.navBar.menuLabel')}
          testID="case-list-menu-button"
        >
          <Icon as={MenuIcon} size="lg" color="$textLight700" sx={{ _dark: { color: '$textDark300' } }} ml="$4" />
        </Pressable>
      ),
      headerTitle: () => (
        <HStack space="sm" alignItems="center">
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
      ),
      headerRight: () => (
        <HStack space="lg" alignItems="center" mr="$4">
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
      ),
    });
  }, [navigation, t]);

  if (isLoading) {
    LoggerService.info(`${FILE_NAME}: CaseListScreen: rendering loading state`);
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" accessibilityLabel={t('caseList.loading')} testID="case-list-loading-spinner" />
      </Box>
    );
  }

  if (loadError) {
    LoggerService.warn(`${FILE_NAME}: CaseListScreen: rendering load-error state`, { loadError });
    return (
      <Box flex={1} justifyContent="center" alignItems="center" p="$5">
        <VStack space="md" alignItems="center">
          <Alert action="error" testID="case-list-error-alert">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t(`caseList.errors.${loadError}`)}</AlertText>
          </Alert>
          <Button onPress={refresh} accessibilityLabel={t('caseList.actions.retry')} testID="case-list-retry-button">
            <ButtonText>{t('caseList.actions.retry')}</ButtonText>
          </Button>
        </VStack>
      </Box>
    );
  }

  LoggerService.info(`${FILE_NAME}: CaseListScreen: rendering case list`, {
    selectedBucket,
    visibleCount: visibleCases.length,
    isSearchVisible,
    searchQueryLength: searchQuery.trim().length,
    isRefreshing,
    hasNotice: noticeKey !== null,
    isEmpty: visibleCases.length === 0,
  });

  return (
    <Box flex={1}>
      <CaseListHeader isSearchVisible={isSearchVisible} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />

      <CaseBucketTabs selectedBucket={selectedBucket} bucketCounts={bucketCounts} onSelectBucket={selectBucket} />

      {noticeKey ? (
        <Box px="$4" pb="$2">
          <Alert action="info" testID="case-list-notice">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t(noticeKey)}</AlertText>
          </Alert>
        </Box>
      ) : null}

      <FlatList
        data={visibleCases}
        keyExtractor={(item) => item.id}
        renderItem={renderCase}
        contentContainerStyle={{ paddingTop: 16, gap: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <Box flex={1} justifyContent="center" alignItems="center" py="$10">
            <Text size="sm" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
              {t('caseList.empty')}
            </Text>
          </Box>
        }
        testID="case-list"
      />
    </Box>
  );
}
