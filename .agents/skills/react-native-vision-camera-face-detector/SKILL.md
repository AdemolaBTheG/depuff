---
name: react-native-vision-camera-face-detector
description: Add real-time and static-image face detection in Expo/React Native apps using react-native-vision-camera-face-detector with Vision Camera. Use when tasks mention MLKit face detection, camera face tracking, landmarks/contours/classification, frame processors, or scan overlays.
version: 1.0.0
license: MIT
---

# React Native Vision Camera Face Detector

## References

- `./references/quickstart.md` -- install, setup, usage templates, options, and troubleshooting

## Core Constraints

- Requires `react-native-vision-camera`.
- Add `react-native-worklets-core/plugin` to `babel.config.js` for frame-processor flows.
- Face detection is CPU heavy; run asynchronous frame detection with `runAsync` when using frame processors.
- If using `useFaceDetector`, call `stopListeners()` on cleanup/unmount.
- Minimum OS guidance from package docs:
  - Android SDK 26+
  - iOS 15.5+

## Setup Workflow

1. Install package:

```bash
yarn add react-native-vision-camera-face-detector
```

2. Ensure Babel plugin exists:
   - `react-native-worklets-core/plugin` in `babel.config.js`
   - Keep it compatible with existing worklets/reanimated plugin ordering in project.

3. Rebuild native artifacts after install/plugin changes:
   - Expo managed with native code: `npx expo prebuild` then iOS/Android build.
   - Bare app: reinstall pods/gradle as needed.

4. Request camera permission before camera render.

5. Pick one integration path:
   - Recommended callback API (`Camera` from this package with `faceDetectionCallback`).
   - Frame processor API (`useFaceDetector` + Vision Camera frame processor).

6. For gallery/file images, use static `detectFaces`.

## API Selection Rules

- Use recommended callback API when you only need face results, not custom frame-processor chains.
- Use frame processor API when you need to combine multiple processors or custom worklet pipelines.
- Use static image API for face detection in picked images or previously captured photos.

## Performance Rules

- Prefer `performanceMode: 'fast'` unless product requirements need higher precision.
- Do not combine contour mode and tracking unless necessary (usually only one prominent face with contours).
- Avoid synchronous heavy work on the JS thread for per-frame face results.
- Keep detection options stable (`useRef`) to avoid frequent detector reconfiguration.

## Verification Checklist

- Camera permission flow works for denied/authorized states.
- Real-time detection callback receives faces on expected camera (`front`/`back`).
- If using frame processors, no "Regular javascript function cannot be shared" worklet errors.
- `stopListeners()` is called on unmount (frame-processor path).
- Static-image `detectFaces` works for `require`, `file://`, `content://`, and object `{ uri }` sources.
- App remains responsive while detecting faces continuously.

