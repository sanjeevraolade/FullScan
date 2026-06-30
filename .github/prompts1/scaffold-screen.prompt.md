---
description: "Scaffold a new React Native screen with navigation, location check, and offline support"
---

# Scaffold Screen

Create a new screen for the FullScanField mobile app.

## Input
- **Screen name**: ${input:screenName:Name of the screen (e.g., AssignmentDetail)}
- **Requires GPS**: ${input:requiresGps:Does this screen need location access? (yes/no)}
- **Requires camera**: ${input:requiresCamera:Does this screen need camera access? (yes/no)}

## Generate

1. `mobile/src/screens/${screenName}Screen.tsx` — screen component with:
   - SafeAreaView wrapper
   - Loading/error states
   - GPS permission check if required
   - Camera permission check if required
   - Navigation params typed

2. `mobile/src/screens/${screenName}Screen.test.tsx` — basic test with:
   - Render test
   - Navigation mock
   - Native module mocks if GPS/camera required

3. Update `mobile/src/navigation/` to add the new screen to the navigator

## Conventions
- Screen file exports default component
- Styles via `StyleSheet.create` at bottom
- Business logic in hooks/services, not in the screen
- Follow patterns in existing screens
