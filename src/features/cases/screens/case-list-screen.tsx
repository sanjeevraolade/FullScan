import React, { useState } from 'react';
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
  RefreshControl,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { DrawerParamList, RootStackParamList } from '@/navigation/routes';
import type { Case, CaseBucket } from '@/domain/case';

import { CaseBucketTabs } from '../components/case-bucket-tabs';
import { CaseCard } from '../components/case-card';
import { CaseListHeader } from '../components/case-list-header';
import { CaseListNavBar } from '../components/case-list-nav-bar';
import { useCaseList } from '../hooks/use-case-list';

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
  return bucket === 'new';
}

function isCallableBucket(bucket: CaseBucket): boolean {
  return bucket === 'pending' || bucket === 'beyondTat';
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
    setIsSearchVisible((previous) => !previous);
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

  const handleCasePress = (caseItem: Case): void => {
    LoggerService.info(`${FILE_NAME}: CaseListScreen.handleCasePress: opening case details`, {
      caseId: caseItem.id,
    });
    navigation.navigate(ROUTE_NAMES.CASE_DETAILS, {
      caseId: caseItem.id,
      caseRef: caseItem.caseRef,
      candidateName: caseItem.candidateName,
      clientName: caseItem.clientName,
    });
  };

  const renderCase = ({ item }: { item: Case }): ReactElement => (
    <CaseCard
      caseItem={item}
      onPress={handleCasePress}
      onAccept={isAcceptableBucket(item.bucket) ? acceptCase : undefined}
      isAccepting={acceptingCaseId === item.id}
      onCall={isCallableBucket(item.bucket) ? handleCallPress : undefined}
    />
  );

  if (isLoading) {
    return (
      <Box flex={1}>
        <CaseListNavBar onToggleSearch={handleToggleSearch} onFilterPress={handleFilterPress} />
        <Box flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" accessibilityLabel={t('caseList.loading')} testID="case-list-loading-spinner" />
        </Box>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box flex={1}>
        <CaseListNavBar onToggleSearch={handleToggleSearch} onFilterPress={handleFilterPress} />
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
      </Box>
    );
  }

  return (
    <Box flex={1}>
      <CaseListNavBar onToggleSearch={handleToggleSearch} onFilterPress={handleFilterPress} />
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
