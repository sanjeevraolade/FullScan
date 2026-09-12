import React from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Box,
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
  CheckCircleIcon,
  HStack,
  Icon,
  Pressable,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { DirectionsIcon, MapPinIcon, RefreshIcon } from '@/shared/components';
import type { GeoCoordinates } from '@/core/types';
import { resolveDistanceDisplayValue } from '@/core/utils';
import type { DistanceMethod } from '@/infrastructure/distance';
import type { GeocodingFailureReason } from '@/infrastructure/geocoding';

import type { CaseGeoFenceStatus } from '../hooks/use-case-geo-fence';

const FILE_NAME = 'case-location-section.tsx';

export interface CaseLocationSectionProps {
  readonly address: string;
  /** Null until the case's location is known — the coordinates chip stays hidden rather than showing 0,0. */
  readonly caseCoordinates: GeoCoordinates | null;
  readonly geoFenceStatus: CaseGeoFenceStatus;
  readonly distanceMeters: number | null;
  readonly distanceMethod: DistanceMethod | null;
  readonly radiusMeters: number | null;
  readonly isCaseLocationFromCache: boolean;
  readonly unresolvedReason: GeocodingFailureReason | null;
  readonly remainingAttempts: number;
  readonly canForceProceed: boolean;
  /** True once the user has consented to proceed without satisfying the geo-fence. */
  readonly isGeoFenceBypassed: boolean;
  readonly isBusy: boolean;
  readonly onGetDirections: () => void;
  readonly onRecalculate: () => void;
  readonly onForceProceedPress: () => void;
}

/** Maps a geocoding failure to the copy that tells the user what to do about it. */
function toUnresolvedMessageKey(reason: GeocodingFailureReason | null): string {
  LoggerService.info(`${FILE_NAME}: toUnresolvedMessageKey: mapping unresolved reason`, { reason });
  switch (reason) {
    case 'offline':
      LoggerService.warn(`${FILE_NAME}: toUnresolvedMessageKey: offline reason`);
      return 'caseDetails.geoFence.unresolvedOffline';
    case 'not_found':
      LoggerService.warn(`${FILE_NAME}: toUnresolvedMessageKey: address not found reason`);
      return 'caseDetails.geoFence.unresolvedNotFound';
    case 'not_configured':
      LoggerService.warn(`${FILE_NAME}: toUnresolvedMessageKey: geocoding not configured reason`);
      return 'caseDetails.geoFence.unresolvedNotConfigured';
    case 'invalid_address':
      LoggerService.warn(`${FILE_NAME}: toUnresolvedMessageKey: invalid address reason`);
      return 'caseDetails.geoFence.unresolvedInvalidAddress';
    default:
      LoggerService.warn(`${FILE_NAME}: toUnresolvedMessageKey: falling back to generic reason`, {
        reason,
      });
      return 'caseDetails.geoFence.unresolvedGeneric';
  }
}

/**
 * Section 2 — the target address, the "get directions" link, and the
 * geo-fence verdict that gates everything below it on the Case Details
 * screen.
 *
 * Presentation only: it renders whatever `useCaseGeoFence` reports and calls
 * back for recalculation/force-proceed. Green means the field executive is
 * inside the configured radius; red means the sections below stay hidden until
 * they either get closer (Recalculate) or knowingly bypass the requirement.
 */
export function CaseLocationSection({
  address,
  caseCoordinates,
  geoFenceStatus,
  distanceMeters,
  distanceMethod,
  radiusMeters,
  isCaseLocationFromCache,
  unresolvedReason,
  remainingAttempts,
  canForceProceed,
  isGeoFenceBypassed,
  isBusy,
  onGetDirections,
  onRecalculate,
  onForceProceedPress,
}: CaseLocationSectionProps): ReactElement {
  const { t } = useTranslation();

  const isWithinFence = geoFenceStatus === 'inside';
  const isBlocked =
    geoFenceStatus === 'outside' ||
    geoFenceStatus === 'case_location_unresolved' ||
    geoFenceStatus === 'error';

  LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering`, {
    geoFenceStatus,
    distanceMethod,
    isGeoFenceBypassed,
  });

  const handlePress = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection.handlePress: location link tapped`);
    onGetDirections();
  };

  const handleRecalculate = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection.handleRecalculate: recalculate tapped`, {
      remainingAttempts,
    });
    onRecalculate();
  };

  const handleForceProceed = (): void => {
    LoggerService.warn(
      `${FILE_NAME}: CaseLocationSection.handleForceProceed: proceed without distance tapped`,
    );
    onForceProceedPress();
  };

  // Which single verdict arm the render commits to — the address itself is never logged.
  if (caseCoordinates) {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering coordinates chip branch`, {
      latitude: caseCoordinates.latitude,
      longitude: caseCoordinates.longitude,
    });
  } else {
    LoggerService.info(
      `${FILE_NAME}: CaseLocationSection: coordinates chip hidden — case location unknown`,
    );
  }

  if (isBusy) {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering busy branch`, {
      geoFenceStatus,
      isResolvingCaseLocation: geoFenceStatus === 'resolving_case_location',
    });
  } else if (geoFenceStatus === 'awaiting_location') {
    LoggerService.warn(`${FILE_NAME}: CaseLocationSection: rendering awaiting-location branch`);
  } else if (geoFenceStatus === 'configuration_unavailable') {
    LoggerService.warn(
      `${FILE_NAME}: CaseLocationSection: rendering configuration-unavailable branch — retry only, no bypass`,
    );
  } else if (isWithinFence) {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering inside-fence success branch`, {
      distanceMeters,
      radiusMeters,
    });
  } else if (isBlocked) {
    LoggerService.warn(`${FILE_NAME}: CaseLocationSection: rendering blocked branch`, {
      geoFenceStatus,
      distanceMeters,
      radiusMeters,
      remainingAttempts,
      canForceProceed,
    });
    if (geoFenceStatus === 'outside') {
      LoggerService.warn(`${FILE_NAME}: CaseLocationSection: blocked because outside radius`, {
        distanceMeters,
        radiusMeters,
      });
    } else {
      LoggerService.warn(`${FILE_NAME}: CaseLocationSection: blocked because case location unresolved`, {
        geoFenceStatus,
        unresolvedReason,
      });
    }
    if (!canForceProceed && remainingAttempts > 0) {
      LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering remaining-attempts hint`, {
        remainingAttempts,
      });
    }
    if (canForceProceed && !isGeoFenceBypassed) {
      LoggerService.warn(`${FILE_NAME}: CaseLocationSection: rendering force-proceed button branch`, {
        remainingAttempts,
      });
    }
  } else {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering neutral branch — no verdict yet`, {
      geoFenceStatus,
    });
  }

  if (isGeoFenceBypassed) {
    LoggerService.warn(`${FILE_NAME}: CaseLocationSection: rendering bypass-active notice branch`);
  }

  if (isCaseLocationFromCache) {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering cached-case-location note branch`);
  }

  if (distanceMethod) {
    LoggerService.info(`${FILE_NAME}: CaseLocationSection: rendering distance-method note branch`, {
      distanceMethod,
    });
  }

  /*
   * Metres below a kilometre, kilometres above it — a distance outside the
   * fence is often kilometre-scale, where a raw metre count reads badly.
   * Only the label changes: the measured value stays in metres everywhere.
   */
  const distanceDisplay = distanceMeters === null ? null : resolveDistanceDisplayValue(distanceMeters);
  const distanceLabel =
    distanceDisplay === null
      ? null
      : t(
          distanceDisplay.unit === 'kilometers'
            ? 'caseDetails.location.distanceKilometers'
            : 'caseDetails.location.distanceMeters',
          { distance: distanceDisplay.value },
        );

  LoggerService.info(`${FILE_NAME}: CaseLocationSection: resolved distance label`, {
    hasDistanceLabel: distanceLabel !== null,
    distanceMeters,
    distanceUnit: distanceDisplay?.unit ?? null,
    distanceValue: distanceDisplay?.value ?? null,
  });

  return (
    <Box
      bg="$backgroundLight0"
      borderWidth="$1"
      borderColor={isWithinFence ? '$success500' : isBlocked ? '$error500' : '$borderLight200'}
      borderRadius="$2xl"
      p="$4"
      sx={{
        _dark: {
          bg: '$backgroundDark900',
          borderColor: isWithinFence ? '$success600' : isBlocked ? '$error600' : '$borderDark700',
        },
      }}
      testID="case-details-location-section"
    >
      <VStack space="sm">
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space="xs" alignItems="center">
            <Icon as={MapPinIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
            <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
              {t('caseDetails.location.title')}
            </Text>
          </HStack>
          {caseCoordinates ? (
            <Box bg="$backgroundLight100" px="$2" py="$0.5" borderRadius="$sm" sx={{ _dark: { bg: '$backgroundDark800' } }}>
              <Text size="2xs" fontFamily="$mono" fontWeight="$bold" color="$textLight600" sx={{ _dark: { color: '$textDark300' } }}>
                {t('caseDetails.location.coordinates', {
                  latitude: caseCoordinates.latitude,
                  longitude: caseCoordinates.longitude,
                })}
              </Text>
            </Box>
          ) : null}
        </HStack>

        <Pressable
          onPress={handlePress}
          bg="$primary50"
          borderWidth="$1"
          borderColor="$primary200"
          borderRadius="$xl"
          p="$3"
          sx={{ _dark: { bg: '$primary950', borderColor: '$primary800' } }}
          accessibilityRole="button"
          accessibilityLabel={t('caseDetails.location.getDirections')}
          testID="case-details-location-link"
        >
          <HStack space="sm" alignItems="center">
            <Text flex={1} size="sm" fontWeight="$medium" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
              {address}
            </Text>
            <Icon
              as={DirectionsIcon}
              size="md"
              color="$primary600"
              sx={{ _dark: { color: '$primary300' } }}
              testID="case-details-directions-icon"
            />
          </HStack>
        </Pressable>

        {isBusy ? (
          <HStack
            space="sm"
            alignItems="center"
            bg="$backgroundLight50"
            borderRadius="$xl"
            px="$3"
            py="$3"
            sx={{ _dark: { bg: '$backgroundDark800' } }}
            testID="case-details-geo-fence-loading"
          >
            <Spinner size="small" />
            <VStack flex={1}>
              <Text size="sm" fontWeight="$bold" color="$textLight800" sx={{ _dark: { color: '$textDark100' } }}>
                {t(
                  geoFenceStatus === 'resolving_case_location'
                    ? 'caseDetails.geoFence.resolvingLocation'
                    : 'caseDetails.geoFence.findingDistance',
                )}
              </Text>
              <Text size="2xs" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }}>
                {t('caseDetails.geoFence.findingDistanceHint')}
              </Text>
            </VStack>
          </HStack>
        ) : null}

        {!isBusy && geoFenceStatus === 'awaiting_location' ? (
          <Alert action="warning" testID="case-details-geo-fence-awaiting-location">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.geoFence.awaitingLocation')}</AlertText>
          </Alert>
        ) : null}

        {!isBusy && geoFenceStatus === 'configuration_unavailable' ? (
          <VStack space="sm">
            <Alert action="error" testID="case-details-geo-fence-configuration-error">
              <AlertIcon as={AlertCircleIcon} mr="$2" />
              <AlertText>{t('caseDetails.geoFence.configurationUnavailable')}</AlertText>
            </Alert>
            {/*
              Retry re-fetches the settings as well as the location, so a
              failed post-login config fetch isn't a dead end. There is
              deliberately no Force Proceed here: without a radius there is no
              requirement to knowingly bypass.
            */}
            <Button
              variant="outline"
              action="secondary"
              size="sm"
              borderRadius="$lg"
              onPress={handleRecalculate}
              accessibilityLabel={t('caseList.actions.retry')}
              testID="case-details-configuration-retry-button"
            >
              <ButtonIcon as={RefreshIcon} mr="$2" />
              <ButtonText>{t('caseList.actions.retry')}</ButtonText>
            </Button>
          </VStack>
        ) : null}

        {!isBusy && isWithinFence ? (
          <Alert action="success" testID="case-details-gps-banner">
            <AlertIcon as={CheckCircleIcon} mr="$2" />
            <AlertText>
              {t('caseDetails.location.gpsMatch', { distance: distanceLabel ?? '' })}
            </AlertText>
          </Alert>
        ) : null}

        {!isBusy && isBlocked ? (
          <VStack space="sm">
            <Alert action="error" testID="case-details-gps-banner">
              <AlertIcon as={AlertCircleIcon} mr="$2" />
              <AlertText>
                {geoFenceStatus === 'outside'
                  ? t('caseDetails.geoFence.outside', {
                      distance: distanceLabel ?? '',
                      radius: radiusMeters ?? 0,
                    })
                  : t(toUnresolvedMessageKey(unresolvedReason))}
              </AlertText>
            </Alert>

            <Button
              variant="outline"
              action="secondary"
              size="sm"
              borderRadius="$lg"
              onPress={handleRecalculate}
              isDisabled={isBusy}
              accessibilityLabel={t('caseDetails.geoFence.recalculate')}
              testID="case-details-recalculate-button"
            >
              {isBusy ? <ButtonSpinner mr="$2" /> : <ButtonIcon as={RefreshIcon} mr="$2" />}
              <ButtonText>{t('caseDetails.geoFence.recalculate')}</ButtonText>
            </Button>

            {!canForceProceed && remainingAttempts > 0 ? (
              <Text
                size="2xs"
                textAlign="center"
                color="$textLight500"
                sx={{ _dark: { color: '$textDark400' } }}
                testID="case-details-remaining-attempts"
              >
                {t('caseDetails.geoFence.remainingAttempts', { count: remainingAttempts })}
              </Text>
            ) : null}

            {canForceProceed && !isGeoFenceBypassed ? (
              <Button
                action="negative"
                variant="solid"
                size="sm"
                borderRadius="$lg"
                onPress={handleForceProceed}
                accessibilityLabel={t('caseDetails.geoFence.forceProceed')}
                testID="case-details-force-proceed-button"
              >
                <ButtonText>{t('caseDetails.geoFence.forceProceed')}</ButtonText>
              </Button>
            ) : null}
          </VStack>
        ) : null}

        {isGeoFenceBypassed ? (
          <Alert action="warning" testID="case-details-geo-fence-bypass-notice">
            <AlertIcon as={AlertCircleIcon} mr="$2" />
            <AlertText>{t('caseDetails.geoFence.bypassActive')}</AlertText>
          </Alert>
        ) : null}

        {isCaseLocationFromCache ? (
          <Text
            size="2xs"
            color="$textLight500"
            sx={{ _dark: { color: '$textDark400' } }}
            testID="case-details-cached-location-note"
          >
            {t('caseDetails.geoFence.cachedCaseLocation')}
          </Text>
        ) : null}

        {distanceMethod ? (
          <Text
            size="2xs"
            color="$textLight500"
            sx={{ _dark: { color: '$textDark400' } }}
            testID="case-details-distance-method"
          >
            {t(
              distanceMethod === 'directions'
                ? 'caseDetails.geoFence.methodDirections'
                : 'caseDetails.geoFence.methodLocal',
            )}
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
}
