import React from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { CaseBucket } from '@/domain/case';

import { CASE_LIST_BUCKETS } from '../hooks/use-case-list';
import type { CaseBucketBadgeCounts } from '../hooks/use-case-list';
import { Tabs, TabsTab, TabsTabList, TabsTabTitle } from '@gluestack-ui/themed';

const FILE_NAME = 'case-bucket-tabs.tsx';

const BUCKET_LABEL_KEYS: Record<CaseBucket, string> = {
  new: 'caseList.tabs.new',
  pending: 'caseList.tabs.pending',
  beyondTat: 'caseList.tabs.beyondTat',
  completed: 'caseList.tabs.completed',
};

/** Each bucket keeps a consistent semantic colour: filled when selected, a light tint of the same colour otherwise. */
const BUCKET_COLOR_TOKENS: Record<CaseBucket, { selectedBg: string; unselectedBg: string; selectedText: string; unselectedText: string }> = {
  new: { selectedBg: '$primary500', unselectedBg: '$primary50', selectedText: '$textLight0', unselectedText: '$primary500' },
  pending: { selectedBg: '$warning500', unselectedBg: '$warning50', selectedText: '$textLight0', unselectedText: '$warning500' },
  beyondTat: { selectedBg: '$error500', unselectedBg: '$error50', selectedText: '$textLight0', unselectedText: '$error500' },
  completed: { selectedBg: '$success500', unselectedBg: '$success50', selectedText: '$textLight0', unselectedText: '$success500' },
};

export interface CaseBucketTabsProps {
  readonly selectedBucket: CaseBucket;
  /** `null` for a tab with no trustworthy number yet — it shows its label alone. */
  readonly badgeCounts: CaseBucketBadgeCounts;
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
  badgeCounts,
  onSelectBucket,
}: CaseBucketTabsProps): ReactElement {
  const { t } = useTranslation();

  LoggerService.info(`${FILE_NAME}: CaseBucketTabs: rendering`, {
    selectedBucket,
    badgeCounts,
  });

  return (
    <Tabs>
      <TabsTabList flexDirection="row" w="$full" px="$4" py="$2" gap="$2" accessibilityRole="tablist">
        {CASE_LIST_BUCKETS.map((bucket) => {
          const isSelected = bucket === selectedBucket;
          const label = t(BUCKET_LABEL_KEYS[bucket]);
          const colors = BUCKET_COLOR_TOKENS[bucket];
          const badgeCount = badgeCounts[bucket];
          const title =
            badgeCount === null
              ? label
              : t('caseList.tabs.labelWithCount', { label, count: badgeCount });

          LoggerService.info(`${FILE_NAME}: CaseBucketTabs: rendering bucket tab`, {
            bucket,
            isSelected,
            badgeCount,
          });

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
              rounded="$md"
              bg={isSelected ? colors.selectedBg : colors.unselectedBg}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={title}
              testID={`case-bucket-tab-${bucket}`}
            >
              <TabsTabTitle
                fontSize="$sm"
                fontWeight="$semibold"
                numberOfLines={1}
                adjustsFontSizeToFit
                color={isSelected ? colors.selectedText : colors.unselectedText}
              >
                {title}
              </TabsTabTitle>
            </TabsTab>
          );
        })}
      </TabsTabList>
    </Tabs>
  );
}
