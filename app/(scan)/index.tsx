import { Theme } from '@/constants/Theme';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Canvas, FillType, Path, Skia, rect } from '@shopify/react-native-skia';
import {
  cancelAnimation,
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Camera as FaceCamera,
  type Face,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import {
  type Camera as VisionCamera,
  type Frame,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

const REQUIRED_STABLE_FRAMES = 8;
const STABLE_FRAME_DECAY = 2;
const MIN_FACE_RATIO = 0.42;
const MAX_FACE_RATIO = 0.92;
const MAX_YAW = 15;
const MAX_PITCH = 15;
const MAX_ROLL = 15;

type QualityGateState = {
  faceCount: number;
  faceRatio: number;
  yaw: number;
  pitch: number;
  roll: number;
  stableFrames: number;
  faceCountOk: boolean;
  distanceOk: boolean;
  poseOk: boolean;
  lightOk: boolean;
  ready: boolean;
  guidance: string;
};

const INITIAL_GATE_STATE: QualityGateState = {
  faceCount: 0,
  faceRatio: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  stableFrames: 0,
  faceCountOk: false,
  distanceOk: false,
  poseOk: false,
  lightOk: true,
  ready: false,
  guidance: 'Center your face in frame',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function toDailyDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

type FaceGuideOverlayProps = {
  guideState: 'idle' | 'warning' | 'ready' | 'error';
};

function FaceGuideOverlay({ guideState }: FaceGuideOverlayProps) {
  const { width, height } = useWindowDimensions();

  const guideWidth = Math.min(width * 0.82, 390);
  const guideHeight = guideWidth * 1.28;
  const guideX = (width - guideWidth) / 2;
  const guideY = Math.max(96, (height - guideHeight) / 2 - 36);

  const maskPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addRect(rect(0, 0, width, height));
    path.addOval(rect(guideX, guideY, guideWidth, guideHeight));
    path.setFillType(FillType.EvenOdd);
    return path;
  }, [guideHeight, guideWidth, guideX, guideY, height, width]);

  const ringPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addOval(rect(guideX, guideY, guideWidth, guideHeight));
    return path;
  }, [guideHeight, guideWidth, guideX, guideY]);

  const stateIndex = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    const indexMap = {
      idle: 0,
      warning: 1,
      ready: 2,
      error: 3,
    } as const;

    stateIndex.value = withTiming(indexMap[guideState], {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [guideState, stateIndex]);

  useEffect(() => {
    if (guideState === 'ready' || guideState === 'error') {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 180 });
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [guideState, pulse]);

  const animatedRingColor = useDerivedValue(() =>
    interpolateColor(
      stateIndex.value,
      [0, 1, 2, 3],
      [Theme.colors.textSecondary, Theme.colors.warning, Theme.colors.accent, Theme.colors.danger]
    )
  );

  const animatedRingStrokeWidth = useDerivedValue(() => 4 + pulse.value * 1.5);
  const animatedRingOpacity = useDerivedValue(() => {
    if (guideState === 'ready' || guideState === 'error') return 1;
    return 0.7 + pulse.value * 0.3;
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={maskPath} color="rgba(0, 0, 0, 0.56)" />
        <Path
          path={ringPath}
          color={animatedRingColor}
          opacity={animatedRingOpacity}
          style="stroke"
          strokeWidth={animatedRingStrokeWidth}
        />
      </Canvas>
    </View>
  );
}

export default function ScanIndexScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const cameraRef = useRef<VisionCamera | null>(null);
  const captureInFlightRef = useRef(false);
  const stableFramesRef = useRef(0);
  const capturedUriRef = useRef<string | null>(null);

  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gate, setGate] = useState<QualityGateState>(INITIAL_GATE_STATE);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const faceDetectionOptions = useMemo<FrameFaceDetectionOptions>(
    () => ({
      performanceMode: 'fast',
      contourMode: 'none',
      landmarkMode: 'none',
      classificationMode: 'none',
      minFaceSize: 0.12,
      trackingEnabled: true,
      cameraFacing: 'front',
      autoMode: false,
    }),
    []
  );

  const captureProgress = clamp(gate.stableFrames / REQUIRED_STABLE_FRAMES, 0, 1);
  const guideState = useMemo<'idle' | 'warning' | 'ready' | 'error'>(() => {
    if (captureError) return 'error';
    if (gate.ready) return 'ready';
    if (gate.faceCount === 0) return 'idle';
    if (!gate.faceCountOk || !gate.distanceOk || !gate.poseOk) return 'warning';
    return 'idle';
  }, [captureError, gate.distanceOk, gate.faceCount, gate.faceCountOk, gate.poseOk, gate.ready]);

  const autoCapture = useCallback(async () => {
    if (captureInFlightRef.current || capturedUriRef.current) return;

    captureInFlightRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);

    try {
      const photo = await cameraRef.current?.takePhoto({
        flash: flashEnabled ? 'on' : 'off',
      });

      if (!photo?.path) {
        throw new Error('No photo path returned from camera');
      }

      const uri = normalizeFileUri(photo.path);
      capturedUriRef.current = uri;
      router.push({
        pathname: '/(scan)/result',
        params: { capturedAt: toDailyDate(), imageUri: uri },
      });
    } catch (error) {
      stableFramesRef.current = 0;
      setCaptureError(error instanceof Error ? error.message : 'Failed to capture image');
    } finally {
      setIsCapturing(false);
      captureInFlightRef.current = false;
    }
  }, [flashEnabled, router]);

  const handleFacesDetected = useCallback(
    async (faces: Face[], frame: Frame) => {
      const faceCount = faces.length;
      const primaryFace = faces[0];

      if (!primaryFace) {
        stableFramesRef.current = Math.max(0, stableFramesRef.current - STABLE_FRAME_DECAY);
        setGate({
          ...INITIAL_GATE_STATE,
          stableFrames: stableFramesRef.current,
          guidance: 'Center your face in frame',
        });
        return;
      }

      const faceArea = Math.max(primaryFace.bounds.width, 0) * Math.max(primaryFace.bounds.height, 0);
      const frameArea = Math.max(frame.width * frame.height, 1);
      const faceRatio = faceArea / frameArea;

      const yaw = Math.abs(primaryFace.yawAngle ?? 0);
      const pitch = Math.abs(primaryFace.pitchAngle ?? 0);
      const roll = Math.abs(primaryFace.rollAngle ?? 0);

      const faceCountOk = faceCount === 1;
      const distanceOk = faceRatio >= MIN_FACE_RATIO && faceRatio <= MAX_FACE_RATIO;
      const poseOk = yaw <= MAX_YAW && pitch <= MAX_PITCH && roll <= MAX_ROLL;
      const lightOk = true;

      const frameReady = faceCountOk && distanceOk && poseOk && lightOk;
      stableFramesRef.current = frameReady
        ? Math.min(REQUIRED_STABLE_FRAMES, stableFramesRef.current + 1)
        : Math.max(0, stableFramesRef.current - STABLE_FRAME_DECAY);

      const ready = stableFramesRef.current >= REQUIRED_STABLE_FRAMES;

      let guidance = 'Hold steady...';
      if (!faceCountOk) guidance = 'Keep only one face in frame';
      else if (!distanceOk) guidance = faceRatio < MIN_FACE_RATIO ? 'Move closer' : 'Move slightly back';
      else if (!poseOk) guidance = 'Look straight ahead';
      else if (ready) guidance = 'Locked. Capturing...';

      setGate({
        faceCount,
        faceRatio,
        yaw,
        pitch,
        roll,
        stableFrames: stableFramesRef.current,
        faceCountOk,
        distanceOk,
        poseOk,
        lightOk,
        ready,
        guidance,
      });

      if (ready && !isCapturing && !capturedUriRef.current) {
        await autoCapture();
      }
    },
    [autoCapture, isCapturing]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Face Scan',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          unstable_headerLeftItems: () => [
            {
              type: 'button',
              label: 'Back',
              icon: { type: 'sfSymbol', name: 'chevron.left' },
              tintColor: Theme.colors.textPrimary,
              onPress: () => router.back(),
            },
          ],
          unstable_headerRightItems: () => [
            {
              type: 'button',
              label: flashEnabled ? 'Flash Off' : 'Flash On',
              icon: { type: 'sfSymbol', name: flashEnabled ? 'bolt.fill' : 'bolt.slash' },
              tintColor: Theme.colors.accent,
              onPress: () => setFlashEnabled((current) => !current),
            },
          ],
        }}
      />

      {!hasPermission ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Camera permission required</Text>
          <Text style={styles.subtitle}>
            Grant camera access to run your morning diagnostic intake scan.
          </Text>
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonLabel}>Grant Camera Access</Text>
          </Pressable>
        </View>
      ) : !device ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Front camera unavailable</Text>
          <Text style={styles.subtitle}>No compatible front camera device was found.</Text>
        </View>
      ) : (
        <>
          <FaceCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            photo={true}
            torch={flashEnabled ? 'on' : 'off'}
            faceDetectionOptions={faceDetectionOptions}
            faceDetectionCallback={handleFacesDetected}
          />
          <FaceGuideOverlay guideState={guideState} />

          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.guidance}>{gate.guidance}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${captureProgress * 100}%` }]} />
              </View>
              <Text style={styles.meta}>
                Faces {gate.faceCount} | Ratio {(gate.faceRatio * 100).toFixed(0)}% | Pose y
                {gate.yaw.toFixed(0)} p{gate.pitch.toFixed(0)} r{gate.roll.toFixed(0)}
              </Text>
            </View>

            {(isCapturing || captureError) && (
              <View style={styles.statusRow}>
                {isCapturing ? <ActivityIndicator color={Theme.colors.accent} /> : null}
                <Text style={styles.statusText}>
                  {isCapturing ? 'Capturing image...' : captureError ?? ''}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.foundation,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: Theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: Theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    backgroundColor: Theme.colors.accent,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonLabel: {
    color: Theme.colors.foundation,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  guidance: {
    color: Theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Theme.colors.glass2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  meta: {
    color: Theme.colors.textSecondary,
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusText: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
