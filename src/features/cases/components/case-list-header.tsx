import React from 'react';
import type { ReactElement } from 'react';
import { Input, InputField, InputIcon, InputSlot, SearchIcon, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'case-list-header.tsx';

export interface CaseListHeaderProps {
  readonly isSearchVisible: boolean;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
}

/** Search affordance shown below the nav bar when search is toggled on. */
export function CaseListHeader({ isSearchVisible, searchQuery, onSearchQueryChange }: CaseListHeaderProps): ReactElement {
  const { t } = useTranslation();

  // The query itself is never logged — it can contain candidate details.
  LoggerService.info(`${FILE_NAME}: CaseListHeader: rendering`, {
    isSearchVisible,
    searchQueryLength: searchQuery.length,
  });

  if (isSearchVisible) {
    LoggerService.info(`${FILE_NAME}: CaseListHeader: rendering search input branch`);
  } else {
    LoggerService.info(`${FILE_NAME}: CaseListHeader: rendering collapsed branch — search hidden`);
  }

  const handleSearchQueryChange = (query: string): void => {
    LoggerService.info(`${FILE_NAME}: CaseListHeader.handleSearchQueryChange: query changed`, {
      queryLength: query.length,
    });
    onSearchQueryChange(query);
  };

  return (
    <VStack space="sm" px="$4" pt="$4" pb="$2">
      {isSearchVisible ? (
        <Input>
          <InputSlot pl="$3">
            <InputIcon as={SearchIcon} />
          </InputSlot>
          <InputField
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
            placeholder={t('caseList.header.searchPlaceholder')}
            accessibilityLabel={t('caseList.header.searchPlaceholder')}
            testID="case-list-search-input"
          />
        </Input>
      ) : null}
    </VStack>
  );
}
