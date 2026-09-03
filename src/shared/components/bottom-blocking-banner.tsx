import React from 'react';
import type { ComponentType, ReactElement } from 'react';
import {
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  HStack,
  Icon,
  Text,
  VStack,
} from '@gluestack-ui/themed';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'bottom-blocking-banner.tsx';

/** `error` is the red, unignorable variant; `warning` the amber one. */
export type BottomBlockingBannerTone = 'error' | 'warning';

export interface BottomBlockingBannerAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly isBusy?: boolean;
  readonly testID?: string;
}

export interface BottomBlockingBannerProps {
  readonly tone: BottomBlockingBannerTone;
  readonly message: string;
  /** Optional second line — the "why"/"how to fix" detail under the headline. */
  readonly detail?: string;
  /**
   * Any Gluestack `createIcon` component (or plain SVG component) to render
   * alongside the message. Typed loosely on purpose: Gluestack's own icon
   * components don't share one public prop type.
   */
  readonly icon?: ComponentType<Record<string, unknown>>;
  readonly primaryAction?: BottomBlockingBannerAction;
  readonly secondaryAction?: BottomBlockingBannerAction;
  readonly testID?: string;
}

const TONE_STYLES = {
  error: {
    backgroundColor: '$error600',
    darkBackgroundColor: '$error700',
    borderColor: '$error700',
    darkBorderColor: '$error600',
  },
  warning: {
    backgroundColor: '$warning600',
    darkBackgroundColor: '$warning700',
    borderColor: '$warning700',
    darkBorderColor: '$warning600',
  },
} as const;

/**
 * A persistent, full-width banner pinned to the bottom of the screen.
 *
 * Presentation only, and deliberately state-agnostic: the location-permission
 * and mock-location banners are both this component with different copy, and
 * any future blocking condition can reuse it. It stays visible until the
 * condition that mounted it clears — there is no dismiss affordance, on
 * purpose.
 */
export function BottomBlockingBanner({
  tone,
  message,
  detail,
  icon,
  primaryAction,
  secondaryAction,
  testID,
}: BottomBlockingBannerProps): ReactElement {
  const toneStyle = TONE_STYLES[tone];
  LoggerService.info(`${FILE_NAME}: BottomBlockingBanner: rendering`, { tone, testID });

  if (primaryAction || secondaryAction) {
    LoggerService.info(`${FILE_NAME}: BottomBlockingBanner: rendering action row`, {
      testID,
      hasIcon: Boolean(icon),
      hasDetail: Boolean(detail),
      hasPrimaryAction: Boolean(primaryAction),
      hasSecondaryAction: Boolean(secondaryAction),
      isPrimaryBusy: primaryAction?.isBusy === true,
      isSecondaryBusy: secondaryAction?.isBusy === true,
    });
  } else {
    LoggerService.info(`${FILE_NAME}: BottomBlockingBanner: rendering without actions`, {
      testID,
      hasIcon: Boolean(icon),
      hasDetail: Boolean(detail),
    });
  }

  return (
    <Box
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      bg={toneStyle.backgroundColor}
      borderTopWidth="$2"
      borderTopColor={toneStyle.borderColor}
      px="$4"
      pt="$3"
      pb="$4"
      sx={{
        _dark: { bg: toneStyle.darkBackgroundColor, borderTopColor: toneStyle.darkBorderColor },
      }}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      testID={testID}
    >
      <VStack space="sm">
        <HStack space="sm" alignItems="flex-start">
          {icon ? <Icon as={icon} size="md" color="$textLight0" mt="$0.5" /> : null}
          <VStack flex={1} space="xs">
            <Text size="sm" fontWeight="$bold" color="$textLight0">
              {message}
            </Text>
            {detail ? (
              <Text size="xs" color="$textLight0" opacity={0.9}>
                {detail}
              </Text>
            ) : null}
          </VStack>
        </HStack>

        {primaryAction || secondaryAction ? (
          <HStack space="sm">
            {primaryAction ? (
              <Button
                flex={1}
                size="sm"
                variant="solid"
                action="secondary"
                borderRadius="$lg"
                bg="$backgroundLight0"
                onPress={primaryAction.onPress}
                isDisabled={primaryAction.isBusy === true}
                accessibilityLabel={primaryAction.label}
                testID={primaryAction.testID}
              >
                {primaryAction.isBusy === true ? <ButtonSpinner mr="$2" /> : null}
                <ButtonText color="$textLight900">{primaryAction.label}</ButtonText>
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button
                flex={1}
                size="sm"
                variant="outline"
                action="secondary"
                borderRadius="$lg"
                borderColor="$backgroundLight0"
                onPress={secondaryAction.onPress}
                isDisabled={secondaryAction.isBusy === true}
                accessibilityLabel={secondaryAction.label}
                testID={secondaryAction.testID}
              >
                {secondaryAction.isBusy === true ? <ButtonSpinner mr="$2" /> : null}
                <ButtonText color="$textLight0">{secondaryAction.label}</ButtonText>
              </Button>
            ) : null}
          </HStack>
        ) : null}
      </VStack>
    </Box>
  );
}
