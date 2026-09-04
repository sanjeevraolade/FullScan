import React, { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Box,
  Button,
  ButtonText,
  HStack,
  Icon,
  Image,
  Pressable,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';
import { Camera } from 'react-native-vision-camera';

import { LoggerService } from '@/infrastructure/logger';
import { ClockIcon, HomeIcon, MapPinIcon, ShieldIcon } from '@/shared/components';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';

import { useCaseCamera } from '../hooks/use-case-camera';

const FILE_NAME = 'case-camera-screen.tsx';

type CaseCameraRoute = RouteProp<RootStackParamList, typeof ROUTE_NAMES.CASE_CAMERA>;

function formatCoordinate(value: number): string {
  const formatted = value.toFixed(4);
  LoggerService.info(`${FILE_NAME}: formatCoordinate: formatted coordinate for watermark`, {
    formatted,
  });
  return formatted;
}

/**
 * Camera-only, live-geotagged evidence capture. The watermark bar rendered
 * here is also the exact view snapshotted (via `react-native-view-shot`) and
 * burned into the saved photo's pixels — see `useCaseCamera.capturePhoto`.
 */
export function CaseCameraScreen(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CaseCameraRoute>();
  const watermarkRef = useRef<View>(null);
  const {
    device,
    previewOutput,
    photoOutput,
    hasCameraPermission,
    requestCameraPermission,
    location,
    isMockLocationDetected,
    locationErrorKey,
    isCapturing,
    captureErrorKey,
    sessionPhotos,
    capturePhoto,
  } = useCaseCamera(params.caseId);

  LoggerService.info(`${FILE_NAME}: CaseCameraScreen: rendering`, {
    caseId: params.caseId,
    photoTagCode: params.photoTagCode,
    hasCameraPermission,
    hasDevice: device !== undefined,
    hasLocationFix: location !== null,
    isMockLocationDetected,
    isCapturing,
    sessionPhotoCount: sessionPhotos.length,
    existingPhotoCount: params.existingPhotos.length,
  });

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen: camera permission effect running`, {
      hasCameraPermission,
    });
    if (!hasCameraPermission) {
      LoggerService.info(`${FILE_NAME}: CaseCameraScreen: requesting camera permission`);
      requestCameraPermission();
    }
  }, [hasCameraPermission, requestCameraPermission]);

  const handleCancel = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen.handleCancel: capture cancelled`);
    navigation.goBack();
  };

  const handleCapture = async (): Promise<void> => {
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen.handleCapture: shutter pressed`);
    // Stays on this screen — capturePhoto appends to sessionPhotos, and the
    // field executive can keep shooting more for the same category before
    // returning them all to CaseDetails in one batch via handleDone.
    const evidence = await capturePhoto(watermarkRef, params.photoTagCode);
    if (evidence === null) {
      LoggerService.warn(`${FILE_NAME}: CaseCameraScreen.handleCapture: capture produced no evidence`, {
        caseId: params.caseId,
        photoTagCode: params.photoTagCode,
      });
      return;
    }
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen.handleCapture: capture succeeded`, {
      caseId: params.caseId,
      photoTagCode: params.photoTagCode,
    });
  };

  const handleDone = (): void => {
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen.handleDone: returning captured batch`, {
      count: sessionPhotos.length,
    });
    // Hand back the FULL set (whatever CaseDetails already had, plus this
    // session's captures) — CaseDetails treats params as its source of
    // truth rather than accumulating locally, so a partial/delta payload
    // here would silently drop everything captured before this visit.
    navigation.navigate(ROUTE_NAMES.CASE_DETAILS, {
      caseId: params.caseId,
      capturedPhotos: [
        ...params.existingPhotos,
        ...sessionPhotos.map((evidence) => ({
          filePath: evidence.filePath,
          latitude: evidence.latitude,
          longitude: evidence.longitude,
          accuracyMeters: evidence.accuracyMeters,
          isMockLocation: evidence.isMockLocation,
          capturedAtIso: evidence.capturedAt.toISOString(),
          documentTypeCode: evidence.documentTypeCode,
        })),
      ],
    });
  };

  if (!hasCameraPermission) {
    LoggerService.warn(`${FILE_NAME}: CaseCameraScreen: rendering permission-denied state`);
    return (
      <Box flex={1} bg="$backgroundDark950" justifyContent="center" alignItems="center" p="$6">
        <VStack space="md" alignItems="center">
          <Text color="$textDark0" textAlign="center">
            {t('caseDetails.camera.cameraPermissionDenied')}
          </Text>
          <Button onPress={requestCameraPermission} testID="case-camera-grant-permission-button">
            <ButtonText>{t('caseDetails.camera.grantPermission')}</ButtonText>
          </Button>
        </VStack>
      </Box>
    );
  }

  if (!device) {
    LoggerService.info(`${FILE_NAME}: CaseCameraScreen: rendering device-loading state`);
    return (
      <Box flex={1} bg="$backgroundDark950" justifyContent="center" alignItems="center">
        <Spinner size="large" color="$textDark0" accessibilityLabel={t('caseDetails.camera.loadingDevice')} />
      </Box>
    );
  }

  const isCaptureDisabled = isCapturing || isMockLocationDetected || !location;
  LoggerService.info(`${FILE_NAME}: CaseCameraScreen: rendering viewfinder`, {
    isCaptureDisabled,
    isCapturing,
    isMockLocationDetected,
    hasLocationFix: location !== null,
    hasLocationError: locationErrorKey !== null,
    hasCaptureError: captureErrorKey !== null,
    sessionPhotoCount: sessionPhotos.length,
  });

  return (
    <Box flex={1} bg="$backgroundDark950" p="$3" testID="case-camera-screen">
      <VStack flex={1} space="sm">
        <HStack
          justifyContent="space-between"
          alignItems="center"
          bg="$backgroundDark950"
          opacity={0.85}
          borderRadius="$md"
          p="$2"
        >
          <HStack space="xs" alignItems="center">
            <Box w={8} h={8} borderRadius="$full" bg="$error500" />
            <Text size="2xs" fontWeight="$bold" color="$success500">
              {t('caseDetails.camera.liveLabel')}
            </Text>
          </HStack>
          <Text size="2xs" color="$textDark400">
            {t('caseDetails.camera.galleryDisabled')}
          </Text>
        </HStack>

        {sessionPhotos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="case-camera-session-strip">
            <HStack space="xs">
              {sessionPhotos.map((photo) => {
                // Evidence file paths are never logged — only the tag.
                LoggerService.info(`${FILE_NAME}: CaseCameraScreen: rendering session thumbnail`, {
                  documentTypeCode: photo.documentTypeCode,
                });
                return (
                  <Image
                    key={photo.filePath}
                    source={{ uri: `file://${photo.filePath}` }}
                    accessibilityLabel={t('caseDetails.camera.sessionThumbnailLabel')}
                    w={40}
                    h={40}
                    borderRadius={8}
                    resizeMode="cover"
                  />
                );
              })}
            </HStack>
          </ScrollView>
        ) : null}

        <Box flex={1} my="$2" borderRadius="$xl" overflow="hidden" position="relative">
          <Camera
            style={{ flex: 1 }}
            device={device}
            outputs={[previewOutput, photoOutput]}
            isActive
            resizeMode="cover"
          />

          <Box
            position="absolute"
            top="$6"
            left="$6"
            right="$6"
            bottom="$20"
            borderWidth="$2"
            borderStyle="dashed"
            borderColor="$borderDark400"
            borderRadius="$lg"
            justifyContent="center"
            alignItems="center"
          >
            <VStack space="xs" alignItems="center">
              <Icon as={HomeIcon} size="xl" color="$textDark400" />
              <Text size="2xs" color="$textDark400" textAlign="center">
                {t('caseDetails.camera.viewfinderHint')}
              </Text>
            </VStack>
          </Box>

          <View
            ref={watermarkRef}
            collapsable={false}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <Box bg="$backgroundDark950" opacity={0.85} borderWidth="$1" borderColor="$borderDark700" p="$2">
              {locationErrorKey ? (
                <Text size="2xs" color="$error400" testID="case-camera-location-error">
                  {t(`caseDetails.camera.locationError.${locationErrorKey}`)}
                </Text>
              ) : location ? (
                <VStack space="xs">
                  <HStack space="xs" alignItems="center">
                    <Icon as={MapPinIcon} size="xs" color="$success400" />
                    <Text size="2xs" color="$success400" fontFamily="$mono">
                      {t('caseDetails.camera.geoCoordinates', {
                        latitude: formatCoordinate(location.latitude),
                        longitude: formatCoordinate(location.longitude),
                      })}
                    </Text>
                  </HStack>
                  <HStack space="xs" alignItems="center">
                    <Icon as={ClockIcon} size="xs" color="$success400" />
                    <Text size="2xs" color="$success400" fontFamily="$mono">
                      {t('caseDetails.camera.timestamp', { value: location.capturedAt.toLocaleString() })}
                    </Text>
                  </HStack>
                  <HStack space="xs" alignItems="center">
                    <Icon as={ShieldIcon} size="xs" color={isMockLocationDetected ? '$error400' : '$success400'} />
                    <Text
                      size="2xs"
                      color={isMockLocationDetected ? '$error400' : '$success400'}
                      fontFamily="$mono"
                      testID="case-camera-mock-status"
                    >
                      {t(
                        isMockLocationDetected
                          ? 'caseDetails.camera.mockGpsDetected'
                          : 'caseDetails.camera.mockGpsClear',
                        { accuracy: location.accuracyMeters.toFixed(1) },
                      )}
                    </Text>
                  </HStack>
                </VStack>
              ) : (
                <Text size="2xs" color="$textDark400">
                  {t('caseDetails.camera.acquiringLocation')}
                </Text>
              )}
            </Box>
          </View>
        </Box>

        {captureErrorKey ? (
          <Text size="xs" color="$error400" textAlign="center" testID="case-camera-capture-error">
            {t(`caseDetails.camera.captureError.${captureErrorKey}`)}
          </Text>
        ) : null}

        <HStack justifyContent="space-around" alignItems="center" pt="$1">
          <Pressable onPress={handleCancel} accessibilityLabel={t('caseDetails.camera.cancel')} testID="case-camera-cancel-button">
            <Text size="sm" color="$textDark300">
              {t('caseDetails.camera.cancel')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCapture}
            disabled={isCaptureDisabled}
            opacity={isCaptureDisabled ? 0.4 : 1}
            w={64}
            h={64}
            borderRadius="$full"
            borderWidth="$4"
            borderColor="$textDark0"
            bg="$error600"
            justifyContent="center"
            alignItems="center"
            accessibilityLabel={t('caseDetails.camera.capture')}
            testID="case-camera-capture-button"
          >
            {isCapturing ? (
              <Spinner color="$textDark0" />
            ) : (
              <Box w={16} h={16} borderRadius="$full" bg="$textDark0" />
            )}
          </Pressable>

          <Pressable
            onPress={handleDone}
            disabled={sessionPhotos.length === 0}
            opacity={sessionPhotos.length === 0 ? 0.4 : 1}
            accessibilityLabel={t('caseDetails.camera.done')}
            testID="case-camera-done-button"
          >
            <Text size="sm" fontWeight="$bold" color="$success400">
              {t('caseDetails.camera.done', { count: sessionPhotos.length })}
            </Text>
          </Pressable>
        </HStack>
      </VStack>
    </Box>
  );
}
