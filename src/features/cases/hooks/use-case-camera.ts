import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  usePreviewOutput,
} from 'react-native-vision-camera';
import type { CameraDevice, CameraPhotoOutput, CameraPreviewOutput } from 'react-native-vision-camera';

import { LoggerService } from '@/infrastructure/logger';
import { composeWatermarkedPhoto } from '@/infrastructure/camera';
import { LocationService } from '@/infrastructure/location';
import type { DeviceLocation } from '@/infrastructure/location';
import type { CapturedPhotoEvidence } from '@/domain/case';

const FILE_NAME = 'use-case-camera.ts';
const WATERMARK_BAR_HEIGHT_RATIO = 0.22;

export type CaseCameraLocationErrorKey = 'permissionDenied' | 'unavailable';
export type CaseCameraCaptureErrorKey = 'cameraNotReady' | 'mockLocationDetected' | 'captureFailed';

export interface UseCaseCameraResult {
  readonly device: CameraDevice | undefined;
  readonly previewOutput: CameraPreviewOutput;
  readonly photoOutput: CameraPhotoOutput;
  readonly hasCameraPermission: boolean;
  readonly requestCameraPermission: () => Promise<boolean>;
  readonly location: DeviceLocation | null;
  readonly isMockLocationDetected: boolean;
  readonly locationErrorKey: CaseCameraLocationErrorKey | null;
  readonly isCapturing: boolean;
  readonly captureErrorKey: CaseCameraCaptureErrorKey | null;
  /** Photos captured so far in this camera visit — cleared only by unmounting the screen. */
  readonly sessionPhotos: readonly CapturedPhotoEvidence[];
  readonly capturePhoto: (
    watermarkViewRef: RefObject<View | null>,
    documentTypeCode: string,
  ) => Promise<CapturedPhotoEvidence | null>;
}

/**
 * Orchestrates the geotagged evidence camera: camera/location permissions, a
 * live location watch for the on-screen overlay, and photo capture + burning
 * the watermark into the saved file. Presentation lives in
 * `CaseCameraScreen` — this hook owns no JSX.
 */
export function useCaseCamera(): UseCaseCameraResult {
  LoggerService.info(`${FILE_NAME}: useCaseCamera: hook invoked`);
  const device = useCameraDevice('back');
  const previewOutput = usePreviewOutput();
  const photoOutput = usePhotoOutput();
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();

  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [locationErrorKey, setLocationErrorKey] = useState<CaseCameraLocationErrorKey | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureErrorKey, setCaptureErrorKey] = useState<CaseCameraCaptureErrorKey | null>(null);
  const [sessionPhotos, setSessionPhotos] = useState<readonly CapturedPhotoEvidence[]>([]);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    LoggerService.info(`${FILE_NAME}: useCaseCamera: location watch effect running`);
    let isMounted = true;

    LocationService.requestPermission()
      .then((permissionStatus) => {
        if (!isMounted) {
          LoggerService.info(
            `${FILE_NAME}: useCaseCamera: permission resolved after unmount — ignoring`,
          );
          return;
        }
        LoggerService.info(`${FILE_NAME}: useCaseCamera: location permission resolved`, {
          permissionStatus,
        });
        if (permissionStatus !== 'granted') {
          LoggerService.warn(`${FILE_NAME}: useCaseCamera: location permission denied`);
          setLocationErrorKey('permissionDenied');
          return;
        }

        LoggerService.info(`${FILE_NAME}: useCaseCamera: starting location watch`);
        watchIdRef.current = LocationService.watchLocation(
          (nextLocation) => {
            if (isMounted) {
              LoggerService.info(`${FILE_NAME}: useCaseCamera: location update received`, {
                accuracyMeters: nextLocation.accuracyMeters,
                isMockLocation: nextLocation.isMockLocation,
              });
              setLocation(nextLocation);
              setLocationErrorKey(null);
            } else {
              LoggerService.info(
                `${FILE_NAME}: useCaseCamera: location update after unmount — ignoring`,
              );
            }
          },
          () => {
            if (isMounted) {
              LoggerService.warn(`${FILE_NAME}: useCaseCamera: location watch reported failure`);
              setLocationErrorKey('unavailable');
            } else {
              LoggerService.info(
                `${FILE_NAME}: useCaseCamera: location watch failure after unmount — ignoring`,
              );
            }
          },
        );
      })
      .catch((error: unknown) => {
        LoggerService.error(`${FILE_NAME}: useCaseCamera: location permission request failed`, {
          message: error instanceof Error ? error.message : String(error),
        });
        if (isMounted) {
          setLocationErrorKey('unavailable');
        }
      });

    return () => {
      LoggerService.info(`${FILE_NAME}: useCaseCamera: cleaning up location watch`, {
        hasActiveWatch: watchIdRef.current !== null,
      });
      isMounted = false;
      if (watchIdRef.current !== null) {
        LocationService.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const capturePhoto = useCallback(
    async (
      watermarkViewRef: RefObject<View | null>,
      documentTypeCode: string,
    ): Promise<CapturedPhotoEvidence | null> => {
      LoggerService.info(`${FILE_NAME}: capturePhoto: requested`, {
        documentTypeCode,
        hasDevice: device !== undefined,
        hasCameraPermission,
        hasLocationFix: location !== null,
      });

      if (!device || !hasCameraPermission) {
        LoggerService.warn(`${FILE_NAME}: capturePhoto: camera not ready`);
        setCaptureErrorKey('cameraNotReady');
        return null;
      }

      if (!location) {
        LoggerService.warn(`${FILE_NAME}: capturePhoto: no location fix yet`);
        setCaptureErrorKey('cameraNotReady');
        return null;
      }

      if (location.isMockLocation) {
        LoggerService.warn(`${FILE_NAME}: capturePhoto: blocked — mock location detected`);
        setCaptureErrorKey('mockLocationDetected');
        return null;
      }

      setIsCapturing(true);
      setCaptureErrorKey(null);
      LoggerService.info(`${FILE_NAME}: capturePhoto: capture started`);

      try {
        const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
        LoggerService.info(`${FILE_NAME}: capturePhoto: capture completed`);

        const photoImage = await photo.toImageAsync();
        const watermarkOverlayPngPath = await captureRef(watermarkViewRef, { format: 'png', result: 'tmpfile' });
        LoggerService.info(`${FILE_NAME}: capturePhoto: metadata generated`);

        const finalFilePath = await composeWatermarkedPhoto({
          photo: photoImage,
          watermarkOverlayPngPath,
          barHeightRatio: WATERMARK_BAR_HEIGHT_RATIO,
        });
        photo.dispose();
        LoggerService.info(`${FILE_NAME}: capturePhoto: attachment stored`);

        const evidence: CapturedPhotoEvidence = {
          filePath: finalFilePath,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracyMeters,
          isMockLocation: location.isMockLocation,
          capturedAt: new Date(),
          documentTypeCode,
        };
        // File paths of evidence are never logged — only the metadata shape.
        LoggerService.info(`${FILE_NAME}: capturePhoto: evidence assembled`, {
          documentTypeCode,
          accuracyMeters: evidence.accuracyMeters,
          isMockLocation: evidence.isMockLocation,
        });
        setSessionPhotos((previousPhotos) => {
          LoggerService.info(`${FILE_NAME}: capturePhoto: appending to session photos`, {
            previousCount: previousPhotos.length,
          });
          return [...previousPhotos, evidence];
        });
        return evidence;
      } catch (error) {
        LoggerService.error(`${FILE_NAME}: capturePhoto: capture failed`, {
          message: error instanceof Error ? error.message : String(error),
        });
        setCaptureErrorKey('captureFailed');
        return null;
      } finally {
        LoggerService.info(`${FILE_NAME}: capturePhoto: capture settled`, { documentTypeCode });
        setIsCapturing(false);
      }
    },
    [device, hasCameraPermission, location, photoOutput],
  );

  return {
    device,
    previewOutput,
    photoOutput,
    hasCameraPermission,
    requestCameraPermission,
    location,
    isMockLocationDetected: location?.isMockLocation ?? false,
    locationErrorKey,
    isCapturing,
    captureErrorKey,
    sessionPhotos,
    capturePhoto,
  };
}
