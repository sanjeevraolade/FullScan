import React from 'react';
import type { ReactElement } from 'react';
import { Input, InputField, InputIcon, InputSlot, SearchIcon, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

export interface CaseListHeaderProps {
  readonly isSearchVisible: boolean;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
}

/** Search affordance shown below the nav bar when search is toggled on. */
export function CaseListHeader({ isSearchVisible, searchQuery, onSearchQueryChange }: CaseListHeaderProps): ReactElement {
  const { t } = useTranslation();

  return (
    <VStack space="sm" px="$4" pt="$4" pb="$2">
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
