# Camera Service

Photo and video capture abstraction using react-native-vision-camera.

## Responsibility

- Camera initialization
- Photo capture
- Video recording
- Flash control
- Camera switching (front/back)
- Frame processing

## Rules

- Camera captures must be tamper-proof.
- All captures pass through the Attachment Engine for metadata embedding.
- Must handle camera permission denial gracefully.
