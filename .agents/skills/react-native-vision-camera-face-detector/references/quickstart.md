# Vision Camera Face Detector Quickstart

## Install

```bash
yarn add react-native-vision-camera-face-detector
```

## Required Babel Setup

Add `react-native-worklets-core/plugin` in `babel.config.js` (required for frame-processor integrations).

## Recommended Real-Time API (Simpler)

```tsx
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Frame, useCameraDevice } from 'react-native-vision-camera';
import {
  Camera,
  Face,
  FaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';

export default function FaceScreen() {
  const device = useCameraDevice('front');
  const options = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'none',
    minFaceSize: 0.15,
    trackingEnabled: false,
    cameraFacing: 'front',
  }).current;

  useEffect(() => {
    Camera.requestCameraPermission();
  }, []);

  function onFacesDetected(faces: Face[], frame: Frame) {
    console.log('faces', faces.length, frame.toString());
  }

  if (!device) return <Text>No Device</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        faceDetectionCallback={onFacesDetected}
        faceDetectionOptions={options}
      />
    </View>
  );
}
```

## Frame Processor API (Advanced)

Use this when combining detectors/processors and asynchronous worklet chains.

```tsx
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Camera,
  runAsync,
  useCameraDevice,
  useFrameProcessor,
} from 'react-native-vision-camera';
import {
  Face,
  FaceDetectionOptions,
  useFaceDetector,
} from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';

export default function FaceProcessorScreen() {
  const device = useCameraDevice('front');
  const options = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    cameraFacing: 'front',
  }).current;

  const { detectFaces, stopListeners } = useFaceDetector(options);

  useEffect(() => {
    Camera.requestCameraPermission();
    return () => stopListeners();
  }, [stopListeners]);

  const onFaces = Worklets.createRunOnJS((faces: Face[]) => {
    console.log('faces detected', faces.length);
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAsync(frame, () => {
        'worklet';
        const faces = detectFaces(frame);
        onFaces(faces);
      });
    },
    [detectFaces, onFaces]
  );

  if (!device) return <Text>No Device</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />
    </View>
  );
}
```

## Static Image Face Detection

```ts
import { detectFaces, ImageFaceDetectionOptions } from 'react-native-vision-camera-face-detector';

const options: ImageFaceDetectionOptions = {
  performanceMode: 'accurate',
  landmarkMode: 'all',
  contourMode: 'all',
  classificationMode: 'all',
};

const fromAsset = await detectFaces({ image: require('./assets/photo.jpg'), options });
const fromFile = await detectFaces({ image: 'file:///storage/emulated/0/Download/pic.jpg', options });
const fromContentUri = await detectFaces({ image: { uri: 'content://media/external/images/media/12345' }, options });

console.log(fromAsset.length, fromFile.length, fromContentUri.length);
```

## Face Detection Options

### Common

- `performanceMode`: `fast | accurate` (default `fast`)
- `landmarkMode`: `none | all` (default `none`)
- `contourMode`: `none | all` (default `none`)
- `classificationMode`: `none | all` (default `none`)
- `minFaceSize`: number ratio, default `0.15`
- `trackingEnabled`: boolean, default `false`

### Frame Processor Specific

- `cameraFacing`: `front | back` (default `front`)
- `autoMode`: boolean (default `false`)
- `windowWidth`: number, required when `autoMode: true`
- `windowHeight`: number, required when `autoMode: true`

### Static Image Input

- `image`: `require(...) | string uri | { uri: string }`

## Known Issues

- Android black screen issues can occur with Skia frame processor on some devices.
- Workarounds exist but may affect drawing orientation.
- Track upstream issues:
  - `mrousavy/react-native-vision-camera#3362`
  - `mrousavy/react-native-vision-camera#3034`
  - `mrousavy/react-native-vision-camera#2951`

## Troubleshooting

- `Regular javascript function cannot be shared...`:
  - Ensure worklet configuration/plugins are correct.
- `compileDebugKotlin` failures:
  - Usually gradle cache/build environment issue; clean caches and rebuild.
- Missing detections or unstable performance:
  - Lower feature load (disable contours/classifications/tracking), prefer `fast`, and run asynchronously.

