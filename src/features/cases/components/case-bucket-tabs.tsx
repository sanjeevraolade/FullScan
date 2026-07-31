import React from 'react';
import type { ReactElement } from 'react';
import { config } from '@gluestack-ui/config';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ThemeEngine } from '@/theme';
import type { CaseBucket } from '@/domain/case';

import { CASE_LIST_BUCKETS } from '../hooks/use-case-list';

const FILE_NAME = 'case-bucket-tabs.tsx';
const TAB_BORDER_RADIUS = 999;

const BUCKET_LABEL_KEYS: Record<CaseBucket, string> = {
  new: 'caseList.tabs.new',
  pending: 'caseList.tabs.pending',
  beyondTat: 'caseList.tabs.beyondTat',
  completed: 'caseList.tabs.completed',
};

/**
 * Deliberately plain React Native styling, not Gluestack's styled
 * Pressable/Box: two rounds of fixes targeting Gluestack's `sx`/pseudo-state
 * resolution (`:hover`/`:active` variants colliding with a conditionally
 * switched `bg` prop) didn't stop the *selected* tab from ballooning and
 * overlapping its neighbors. Sidestepping that resolution path entirely
 * removes the bug class outright — plain View/Text/Pressable have no such
 * machinery. Colors still come from the same Gluestack config tokens (no
 * new hex literals), just read directly instead of through a styled prop.
 */
const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: TAB_BORDER_RADIUS,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

interface TabColors {
  readonly selectedBg: string;
  readonly unselectedBg: string;
  readonly selectedText: string;
  readonly unselectedText: string;
}

function resolveTabColors(): TabColors {
  const isDark = ThemeEngine.getResolvedMode() === 'dark';
  return {
    selectedBg: config.tokens.colors.primary500,
    unselectedBg: isDark ? config.tokens.colors.backgroundDark800 : config.tokens.colors.backgroundLight100,
    selectedText: isDark ? config.tokens.colors.textDark0 : config.tokens.colors.textLight0,
    unselectedText: isDark ? config.tokens.colors.textDark300 : config.tokens.colors.textLight700,
  };
}

export interface CaseBucketTabsProps {
  readonly selectedBucket: CaseBucket;
  readonly bucketCounts: Record<CaseBucket, number>;
  readonly onSelectBucket: (bucket: CaseBucket) => void;
}

/** Horizontal segmented control for New / Pending / Beyond TAT / Completed. */
export function CaseBucketTabs({
  selectedBucket,
  bucketCounts,
  onSelectBucket,
}: CaseBucketTabsProps): ReactElement {
  const { t } = useTranslation();
  const colors = resolveTabColors();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        {CASE_LIST_BUCKETS.map((bucket) => {
          const isSelected = bucket === selectedBucket;

          const handlePress = (): void => {
            LoggerService.info(`${FILE_NAME}: CaseBucketTabs.handlePress: tab pressed`, { bucket });
            onSelectBucket(bucket);
          };

          return (
            <Pressable
              key={bucket}
              onPress={handlePress}
              style={[styles.tab, { backgroundColor: isSelected ? colors.selectedBg : colors.unselectedBg }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(BUCKET_LABEL_KEYS[bucket])}
              testID={`case-bucket-tab-${bucket}`}
            >
              <Text style={[styles.tabText, { color: isSelected ? colors.selectedText : colors.unselectedText }]}>
                {t(BUCKET_LABEL_KEYS[bucket])} ({bucketCounts[bucket]})
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
