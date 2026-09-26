/**
 * Manual Jest mock — react-native-vision-camera creates its native
 * "CameraFactory" HybridObject (via react-native-nitro-modules) as a
 * top-level side effect of importing the package, which throws under Jest's
 * Node environment (no on-device TurboModule host). Auto-applied for every
 * test since this file lives in the root __mocks__ directory. Only the
 * surface `useCaseCamera`/`CaseCameraScreen` actually call is stubbed —
 * tests that exercise camera behaviour mock this module themselves with
 * richer per-test return values.
 */
module.exports = {
  Camera: () => null,
  useCameraDevice: jest.fn(() => undefined),
  useCameraPermission: jest.fn(() => ({ hasPermission: false, requestPermission: jest.fn() })),
  usePhotoOutput: jest.fn(() => ({ capturePhoto: jest.fn(), capturePhotoToFile: jest.fn() })),
  usePreviewOutput: jest.fn(() => ({})),
};
