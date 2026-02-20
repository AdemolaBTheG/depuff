import Shimmer from '@/components/shimmer';
import { Theme } from '@/constants/Theme';
import { useAnalyzeFaceMutation } from '@/hooks/useBridgeApi';
import { BridgeApiError } from '@/services/bridge-api';
import {
  hapticError,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  startAnalyzingHaptic,
  stopAllAppHaptics,
  stopAnalyzingHaptic,
} from '@/utils/haptics';
import { persistScanResult } from '@/utils/scan-intake';
import { useIsFocused } from '@react-navigation/native';
import { Canvas, FillType, Path, rect, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCameraDevice,
  useCameraPermission,
  type Frame,
  type Camera as VisionCamera,
} from 'react-native-vision-camera';
import {
  Camera as FaceCamera,
  type Face,
  type FrameFaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';

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

function parseError(error: unknown): string {
  if (error instanceof BridgeApiError) {
    const serverError =
      typeof error.body === 'object' &&
      error.body !== null &&
      'error' in error.body &&
      typeof (error.body as { error?: unknown }).error === 'string'
        ? (error.body as { error: string }).error
        : null;
    return serverError ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unable to analyze this scan.';
}

type FaceGuideOverlayProps = {
  guideState: 'idle' | 'warning' | 'ready' | 'error';
};

function getGuideFrame(width: number, height: number) {
  const guideWidth = Math.min(width * 0.82, 390);
  const guideHeight = guideWidth * 1.28;
  const guideX = (width - guideWidth) / 2;
  const guideY = Math.max(96, (height - guideHeight) / 2 - 36);
  return { guideWidth, guideHeight, guideX, guideY };
}

function FaceGuideOverlay({ guideState }: FaceGuideOverlayProps) {
  const { width, height } = useWindowDimensions();

  const { guideWidth, guideHeight, guideX, guideY } = getGuideFrame(width, height);

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
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const cameraRef = useRef<VisionCamera | null>(null);
  const captureInFlightRef = useRef(false);
  const stableFramesRef = useRef(0);
  const capturedUriRef = useRef<string | null>(null);
  const recaptureBlockedUntilRef = useRef(0);

  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gate, setGate] = useState<QualityGateState>(INITIAL_GATE_STATE);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const analyzeFaceMutation = useAnalyzeFaceMutation();
  const supportsFlashCapture = Boolean(device?.hasFlash);
  const supportsTorch = Boolean(device?.hasTorch);
  const canUseFlashControl = supportsFlashCapture || supportsTorch;

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

  const clearCapture = useCallback(() => {
    capturedUriRef.current = null;
    stableFramesRef.current = 0;
    setCaptureError(null);
    setGate(INITIAL_GATE_STATE);
    setCapturedImageUri(null);
    setCapturedAt(null);
    setAnalysisError(null);
  }, []);

  const handleRetake = useCallback(() => {
    hapticSelection();
    recaptureBlockedUntilRef.current = Date.now() + 1200;
    clearCapture();
  }, [clearCapture]);

  const isAnalyzing = analyzeFaceMutation.isPending || isPersisting;
  const flashIconName = flashEnabled ? ('bolt.fill' as const) : ('bolt.slash' as const);

  useEffect(() => {
    if (!canUseFlashControl && flashEnabled) {
      setFlashEnabled(false);
    }
  }, [canUseFlashControl, flashEnabled]);

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: 'Face Scan',
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      unstable_headerLeftItems: () => [
        {
          type: 'button' as const,
          label: 'Back',
          icon: { type: 'sfSymbol' as const, name: 'chevron.left' as const },
          tintColor: Theme.colors.textPrimary,
          onPress: () => router.back(),
        },
      ],
    }),
    [router]
  );

  const analyzeCapturedImage = useCallback(async () => {
    if (!capturedImageUri || isAnalyzing) return;
    setAnalysisError(null);
    hapticImpact('light');

    const createdAt = capturedAt ?? new Date().toISOString();

    try {
      const result = await analyzeFaceMutation.mutateAsync({
        imageUri: capturedImageUri,
        timestamp: createdAt,
        locale: 'en',
        metadata: {
          is_morning: true,
          last_water_intake_ml: 0,
        },
      });

      setIsPersisting(true);
      await persistScanResult({
        imageUri: capturedImageUri,
        createdAt,
        result,
      });
      stopAnalyzingHaptic();
      hapticSuccess();
      router.push({
        pathname: '/(scan)/result',
        params: {
          imageUri: capturedImageUri,
          capturedAt: createdAt,
          result: encodeURIComponent(JSON.stringify(result)),
        },
      });
    } catch (error) {
      stopAnalyzingHaptic();
      setAnalysisError(parseError(error));
      hapticError();
    } finally {
      setIsPersisting(false);
    }
  }, [analyzeFaceMutation, capturedAt, capturedImageUri, isAnalyzing, router]);

  useEffect(() => {
    if (!isFocused) return;
    clearCapture();
  }, [isFocused, clearCapture]);

  useEffect(() => {
    if (!capturedImageUri || !isAnalyzing) {
      stopAnalyzingHaptic();
      return;
    }

    startAnalyzingHaptic();
    return () => {
      stopAnalyzingHaptic();
    };
  }, [capturedImageUri, isAnalyzing]);

  useEffect(
    () => () => {
      stopAllAppHaptics();
    },
    []
  );

  const autoCapture = useCallback(async () => {
    if (captureInFlightRef.current || capturedUriRef.current) return;

    captureInFlightRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);

    try {
      const photo = await cameraRef.current?.takePhoto({
        flash: flashEnabled && supportsFlashCapture ? 'on' : 'off',
      });

      if (!photo?.path) {
        throw new Error('No photo path returned from camera');
      }

      const uri = normalizeFileUri(photo.path);
      capturedUriRef.current = uri;
      setCapturedImageUri(uri);
      setCapturedAt(new Date().toISOString());
      hapticImpact('medium');
    } catch (error) {
      stableFramesRef.current = 0;
      setCaptureError(error instanceof Error ? error.message : 'Failed to capture image');
      hapticError();
    } finally {
      setIsCapturing(false);
      captureInFlightRef.current = false;
    }
  }, [flashEnabled, supportsFlashCapture]);

  const handleFacesDetected = useCallback(
    async (faces: Face[], frame: Frame) => {
      if (capturedImageUri) return;

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
      const isRecaptureBlocked = Date.now() < recaptureBlockedUntilRef.current;

      let guidance = 'Hold steady...';
      if (!faceCountOk) guidance = 'Keep only one face in frame';
      else if (!distanceOk) guidance = faceRatio < MIN_FACE_RATIO ? 'Move closer' : 'Move slightly back';
      else if (!poseOk) guidance = 'Look straight ahead';
      else if (ready && !isRecaptureBlocked) guidance = 'Locked. Capturing...';

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

      if (ready && !isCapturing && !capturedUriRef.current && !isRecaptureBlocked) {
        await autoCapture();
      }
    },
    [autoCapture, capturedImageUri, isCapturing]
  );

  return (
    <View style={styles.container}>

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
            isActive={isFocused && !capturedImageUri}
            photo={true}
            enableZoomGesture={!capturedImageUri}
            torch={flashEnabled && supportsTorch ? 'on' : 'off'}
            faceDetectionOptions={faceDetectionOptions}
            faceDetectionCallback={handleFacesDetected}
          />
          {capturedImageUri ? (
            <Shimmer style={styles.previewImageOverlay}>
              <Image
                source={{ uri: capturedImageUri }}
                contentFit="cover"
                transition={220}
                recyclingKey={capturedImageUri}
                style={styles.previewImageOverlay}
              />
              {isAnalyzing ? (
                <Shimmer.Overlay width="38%" duration={1400} repeatDelay={120} overlayAngle={12}>
                  <View style={styles.imageShimmerTrack}>
                    <View style={styles.imageShimmerEdge} />
                    <View style={styles.imageShimmerCenter} />
                    <View style={styles.imageShimmerEdge} />
                  </View>
                </Shimmer.Overlay>
              ) : null}
            </Shimmer>
          ) : (
            <FaceGuideOverlay guideState={guideState} />
          )}

          <View style={styles.overlay}>
            {capturedImageUri ? (
              <>
               

                <View style={[styles.previewActionsContainer, { paddingBottom: insets.bottom + 10 }]}>
                  <View style={styles.previewActions}>
                    <PressableScale
                      style={[
                        styles.previewActionItem,
                        styles.actionButton,
                        styles.secondaryButton,
                        isAnalyzing ? styles.disabledButton : null,
                      ]}
                      onPress={isAnalyzing ? undefined : handleRetake}
                    >
                      <Text style={styles.secondaryButtonLabel}>Retake</Text>
                    </PressableScale>
                    <PressableScale
                      style={[
                        styles.previewActionItem,
                        styles.actionButton,
                        styles.primaryButton,
                        isAnalyzing ? styles.disabledButton : null,
                      ]}
                      onPress={isAnalyzing ? undefined : analyzeCapturedImage}
                    >
                      {isAnalyzing ? (
                        <ActivityIndicator size="small" color={Theme.colors.foundation} />
                      ) : (
                        <Text style={styles.primaryButtonLabel}>Analyze</Text>
                      )}
                    </PressableScale>
                  </View>
                </View>
              </>
            ) : (
              <>
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
              </>
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
  previewImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageShimmerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  imageShimmerEdge: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  imageShimmerCenter: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  previewStatusCard: {
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  previewActionsContainer: {
    width: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  previewActionItem: {
    flex: 1,
  },
  actionButton: {
  
    borderRadius: 24, 
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  secondaryButton: {
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
  },
  primaryButtonLabel: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonLabel: {
    color: Theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
 
  previewError: {
    color: Theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
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
  analyzingDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    overflow: 'hidden',
  },
  analyzingDotBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Theme.colors.glass2,
  },
  analyzingDotOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  statusText: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
