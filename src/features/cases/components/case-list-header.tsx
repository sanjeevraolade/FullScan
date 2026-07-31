import React from 'react';
import type { ReactElement } from 'react';
import {
  Avatar,
  AvatarFallbackText,
  HStack,
  Input,
  InputField,
  InputIcon,
  InputSlot,
  Pressable,
  SearchIcon,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FilterIcon } from '@/shared/components';
import type { FieldExecutive } from '@/domain/field-executive';

const FILE_NAME = 'case-list-header.tsx';

export interface CaseListHeaderProps {
  readonly fieldExecutive: FieldExecutive | null;
  readonly isSearchVisible: boolean;
  readonly onToggleSearch: () => void;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onFilterPress: () => void;
}

/** Field executive identity + search/filter affordances for the case list. */
export function CaseListHeader({
  fieldExecutive,
  isSearchVisible,
  onToggleSearch,
  searchQuery,
  onSearchQueryChange,
  onFilterPress,
}: CaseListHeaderProps): ReactElement {
  const { t } = useTranslation();

  const handleToggleSearch = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListHeader.handleToggleSearch: pressed`);
    onToggleSearch();
  };

  const handleFilterPress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseListHeader.handleFilterPress: pressed`);
    onFilterPress();
  };

  return (
    <VStack space="sm" px="$4" pt="$4" pb="$2">
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space="sm" alignItems="center" flex={1}>
          <Avatar size="md" bg="$primary500">
            <AvatarFallbackText>{fieldExecutive?.name ?? ''}</AvatarFallbackText>
          </Avatar>
          <VStack>
            <Text size="md" fontWeight="$semibold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
              {fieldExecutive?.name ?? t('caseList.header.loadingName')}
            </Text>
            <Text size="xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
              {fieldExecutive?.role ?? ''}
            </Text>
          </VStack>
        </HStack>

        <HStack space="lg">
          <Pressable
            onPress={handleToggleSearch}
            accessibilityLabel={t('caseList.header.searchLabel')}
            testID="case-list-search-toggle"
          >
            <SearchIcon size="lg" color="$textLight700" sx={{ _dark: { color: '$textDark300' } }} />
          </Pressable>
          <Pressable
            onPress={handleFilterPress}
            accessibilityLabel={t('caseList.header.filterLabel')}
            testID="case-list-filter-button"
          >
            <FilterIcon size="lg" color="$textLight700" sx={{ _dark: { color: '$textDark300' } }} />
          </Pressable>
        </HStack>
      </HStack>

      {isSearchVisible ? (
        <Input>
          <InputSlot pl="$3">
            <InputIcon as={SearchIcon} />
          </InputSlot>
          <InputField
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            placeholder={t('caseList.header.searchPlaceholder')}
            accessibilityLabel={t('caseList.header.searchPlaceholder')}
            testID="case-list-search-input"
          />
        </Input>
      ) : null}
    </VStack>
  );
}
