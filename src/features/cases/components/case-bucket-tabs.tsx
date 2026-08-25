import React from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { CaseBucket } from '@/domain/case';

import { CASE_LIST_BUCKETS } from '../hooks/use-case-list';
import { Tabs, TabsTab, TabsTabList, TabsTabTitle } from '@gluestack-ui/themed';

const FILE_NAME = 'case-bucket-tabs.tsx';

const BUCKET_LABEL_KEYS: Record<CaseBucket, string> = {
  new: 'caseList.tabs.new',
  pending: 'caseList.tabs.pending',
  beyondTat: 'caseList.tabs.beyondTat',
  completed: 'caseList.tabs.completed',
};

export interface CaseBucketTabsProps {
  readonly selectedBucket: CaseBucket;
  readonly bucketCounts: Record<CaseBucket, number>;
  readonly onSelectBucket: (bucket: CaseBucket) => void;
}

/**
 * Segmented control for New / Pending / Beyond TAT / Completed, built on
 * Gluestack's `Tabs` primitive (a plain `View`-based `TabsTabList`, not a
 * `ScrollView`). Selection is driven entirely by `selectedBucket` /
 * `onSelectBucket`: `Tabs`' own active-tab tracking is positional
 * ("tab-0".."tab-3") and only seeds itself once on mount, so it isn't a
 * source of truth here — `Tabs`/`TabsTab` are used purely as the
 * pressable/layout primitives, with selected styling computed from the
 * `selectedBucket` prop on every render.
 */
export function CaseBucketTabs({
  selectedBucket,
  bucketCounts,
  onSelectBucket,
}: CaseBucketTabsProps): ReactElement {
  const { t } = useTranslation();

  return (
    <Tabs>
      <TabsTabList flexDirection="row" w="$full" px="$4" py="$2" gap="$2" accessibilityRole="tablist">
        {CASE_LIST_BUCKETS.map((bucket) => {
          const isSelected = bucket === selectedBucket;
          const label = t(BUCKET_LABEL_KEYS[bucket]);

          const handlePress = (): void => {
            LoggerService.info(`${FILE_NAME}: CaseBucketTabs.handlePress: tab pressed`, { bucket });
            onSelectBucket(bucket);
          };

          return (
            <TabsTab
              key={bucket}
              onPress={handlePress}
              flex={1}
              h="$9"
              alignItems="center"
              justifyContent="center"
              px="$2"
              rounded="$full"
              bg={isSelected ? '$primary500' : '$backgroundLight100'}
              sx={{ _dark: { bg: isSelected ? '$primary500' : '$backgroundDark800' } }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={label}
              testID={`case-bucket-tab-${bucket}`}
            >
              <TabsTabTitle
                fontSize="$sm"
                fontWeight="$medium"
                numberOfLines={1}
                adjustsFontSizeToFit
                color={isSelected ? '$textLight0' : '$textLight700'}
                sx={{ _dark: { color: isSelected ? '$textDark0' : '$textDark300' } }}
              >
                {label} ({bucketCounts[bucket]})
              </TabsTabTitle>
            </TabsTab>
          );
        })}
      </TabsTabList>
    </Tabs>
  );
}
