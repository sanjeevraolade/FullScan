import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createRef } from 'react';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { LocationService } from '@/infrastructure/location';
import type { DeviceLocation } from '@/infrastructure/location';
import { composeWatermarkedPhoto } from '@/infrastructure/camera';

import { useCaseCamera } from './use-case-camera';

// Explicit factories — both real modules import native-backed libraries
// (`@react-native-community/geolocation`, `react-native-nitro-image`) that
// aren't linked in the Jest environment, so even `jest.mock`'s auto-mock
// (which still requires the real module to infer its shape) would fail.
jest.mock('@/infrastructure/location', () => ({
  LocationService: {
    requestPermission: jest.fn(),
    watchLocation: jest.fn(),
    clearWatch: jest.fn(),
  },
}));
jest.mock('@/infrastructure/camera', () => ({
  composeWatermarkedPhoto: jest.fn(),
}));

const mockCapturePhoto = jest.fn();
const mockUseCameraDevice = jest.fn();
const mockUseCameraPermission = jest.fn();

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: (...args: unknown[]) => mockUseCameraDevice(...args),
  useCameraPermission: () => mockUseCameraPermission(),
  usePhotoOutput: () => ({ capturePhoto: mockCapturePhoto }),
  usePreviewOutput: () => ({}),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('/tmp/watermark-overlay.png'),
}));

function buildLocation(overrides: Partial<DeviceLocation> = {}): DeviceLocation {
  return {
    latitude: 17.4452,
    longitude: 78.3821,
    accuracyMeters: 4.2,
    isMockLocation: false,
    capturedAt: new Date('2026-08-26T09:00:00.000Z'),
    source: 'fresh',
    ...overrides,
  };
}

describe('useCaseCamera', () => {
  let onLocationCallback: (location: DeviceLocation) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCameraDevice.mockReturnValue({ id: 'back-camera' });
    mockUseCameraPermission.mockReturnValue({ hasPermission: true, requestPermission: jest.fn() });
    jest.mocked(LocationService.requestPermission).mockResolvedValue('granted');
    jest.mocked(LocationService.watchLocation).mockImplementation((onLocation) => {
      onLocationCallback = onLocation;
      return 1;
    });
    jest.mocked(composeWatermarkedPhoto).mockResolvedValue('/tmp/final-evidence.jpg');
  });

  it('starts a location watch once permission is granted and exposes the live fix', async () => {
    const { result } = await renderHook(() => useCaseCamera());

    await waitFor(() => expect(LocationService.watchLocation).toHaveBeenCalled());

    await act(async () => {
      onLocationCallback(buildLocation());
    });

    await waitFor(() => expect(result.current.location?.latitude).toBe(17.4452));
    expect(result.current.isMockLocationDetected).toBe(false);
    expect(result.current.locationErrorKey).toBeNull();
  });

  it('surfaces a permissionDenied error when location permission is refused', async () => {
    jest.mocked(LocationService.requestPermission).mockResolvedValue('denied');

    const { result } = await renderHook(() => useCaseCamera());

    await waitFor(() => expect(result.current.locationErrorKey).toBe('permissionDenied'));
    expect(LocationService.watchLocation).not.toHaveBeenCalled();
  });

  it('captures a photo and returns evidence stamped with the current location', async () => {
    const disposablePhoto = { toImageAsync: jest.fn().mockResolvedValue({}), dispose: jest.fn() };
    mockCapturePhoto.mockResolvedValue(disposablePhoto);

    const { result } = await renderHook(() => useCaseCamera());
    await waitFor(() => expect(LocationService.watchLocation).toHaveBeenCalled());
    await act(async () => onLocationCallback(buildLocation()));
    await waitFor(() => expect(result.current.location).not.toBeNull());

    const watermarkRef = createRef<View>() as RefObject<View | null>;
    let evidence: Awaited<ReturnType<typeof result.current.capturePhoto>> = null;
    await act(async () => {
      evidence = await result.current.capturePhoto(watermarkRef, 'house_photo_1');
    });

    expect(evidence).toMatchObject({
      filePath: '/tmp/final-evidence.jpg',
      latitude: 17.4452,
      longitude: 78.3821,
      isMockLocation: false,
      documentTypeCode: 'house_photo_1',
    });
    expect(disposablePhoto.dispose).toHaveBeenCalled();
  });

  it('accumulates every capture in sessionPhotos across repeated shutter presses', async () => {
    const disposablePhoto = { toImageAsync: jest.fn().mockResolvedValue({}), dispose: jest.fn() };
    mockCapturePhoto.mockResolvedValue(disposablePhoto);
    jest
      .mocked(composeWatermarkedPhoto)
      .mockResolvedValueOnce('/tmp/evidence-1.jpg')
      .mockResolvedValueOnce('/tmp/evidence-2.jpg');

    const { result } = await renderHook(() => useCaseCamera());
    await waitFor(() => expect(LocationService.watchLocation).toHaveBeenCalled());
    await act(async () => onLocationCallback(buildLocation()));
    await waitFor(() => expect(result.current.location).not.toBeNull());

    const watermarkRef = createRef<View>() as RefObject<View | null>;
    await act(async () => {
      await result.current.capturePhoto(watermarkRef, 'house_photo_1');
    });
    await act(async () => {
      await result.current.capturePhoto(watermarkRef, 'house_photo_1');
    });

    expect(result.current.sessionPhotos).toHaveLength(2);
    expect(result.current.sessionPhotos.map((photo) => photo.filePath)).toEqual([
      '/tmp/evidence-1.jpg',
      '/tmp/evidence-2.jpg',
    ]);
  });

  it('blocks capture and reports mockLocationDetected when the location is mocked', async () => {
    const { result } = await renderHook(() => useCaseCamera());
    await waitFor(() => expect(LocationService.watchLocation).toHaveBeenCalled());
    await act(async () => onLocationCallback(buildLocation({ isMockLocation: true })));
    await waitFor(() => expect(result.current.isMockLocationDetected).toBe(true));

    const watermarkRef = createRef<View>() as RefObject<View | null>;
    let evidence: Awaited<ReturnType<typeof result.current.capturePhoto>> = null;
    await act(async () => {
      evidence = await result.current.capturePhoto(watermarkRef, 'house_photo_1');
    });

    expect(evidence).toBeNull();
    expect(result.current.captureErrorKey).toBe('mockLocationDetected');
    expect(mockCapturePhoto).not.toHaveBeenCalled();
  });
});
