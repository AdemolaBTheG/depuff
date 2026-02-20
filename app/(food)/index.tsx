import Shimmer from '@/components/shimmer';
import { Theme } from '@/constants/Theme';
import { useAnalyzeFoodMutation } from '@/hooks/useBridgeApi';
import { BridgeApiError } from '@/services/bridge-api';
import { useFoodAnalysisStore } from '@/stores/foodAnalysisStore';
import { hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, type Camera as VisionCamera } from 'react-native-vision-camera';

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function toErrorMessage(error: unknown): string {
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
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to capture image.';
}

export default function FoodIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const cameraRef = useRef<VisionCamera | null>(null);
  const hasHydratedFromPendingRef = useRef(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const analyzeFoodMutation = useAnalyzeFoodMutation();
  const pendingAnalysis = useFoodAnalysisStore((state) => state.pendingAnalysis);
  const setPendingAnalysis = useFoodAnalysisStore((state) => state.setPendingAnalysis);
  const clearPendingAnalysis = useFoodAnalysisStore((state) => state.clearPendingAnalysis);

  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const isAnalyzing = analyzeFoodMutation.isPending;
  const isBusy = isCapturing || isAnalyzing || isPickingImage;
  const supportsFlashCapture = Boolean(device?.hasFlash);
  const supportsTorch = Boolean(device?.hasTorch);
  const canUseFlashControl = supportsFlashCapture || supportsTorch;
  const flashIconName = flashEnabled ? ('bolt.fill' as const) : ('bolt.slash' as const);

  useEffect(() => {
    if (!canUseFlashControl && flashEnabled) {
      setFlashEnabled(false);
    }
  }, [canUseFlashControl, flashEnabled]);

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: 'Log Food',
      headerTransparent: true,
      headerTintColor: Theme.colors.textPrimary,
      headerBackButtonDisplayMode: 'minimal' as const,
      unstable_headerRightItems: () => [
        ...(canUseFlashControl
          ? [
              {
                type: 'button' as const,
                label: flashEnabled ? 'Flash Off' : 'Flash On',
                icon: { type: 'sfSymbol' as const, name: flashIconName },
                tintColor: Theme.colors.accent,
                onPress: () => {
                  hapticSelection();
                  setFlashEnabled((current) => !current);
                },
              },
            ]
          : []),
      ],
    }),
    [canUseFlashControl, flashEnabled, flashIconName]
  );

  const handleCapture = useCallback(async () => {
    if (isCapturing || !cameraRef.current) return;

    setIsCapturing(true);
    setCaptureError(null);
    hasHydratedFromPendingRef.current = true;
    clearPendingAnalysis();
    hapticImpact('light');

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: flashEnabled && supportsFlashCapture ? 'on' : 'off',
      });

      if (!photo?.path) {
        throw new Error('No image path returned by camera');
      }

      setCapturedImageUri(normalizeFileUri(photo.path));
      hapticSuccess();
    } catch (error) {
      setCaptureError(toErrorMessage(error));
      hapticError();
    } finally {
      setIsCapturing(false);
    }
  }, [clearPendingAnalysis, flashEnabled, isCapturing, supportsFlashCapture]);

  const handleRetake = useCallback(() => {
    hapticSelection();
    hasHydratedFromPendingRef.current = true;
    setCaptureError(null);
    setCapturedImageUri(null);
    clearPendingAnalysis();
  }, [clearPendingAnalysis]);

  const handlePickFromLibrary = useCallback(async () => {
    if (isBusy) return;
    hapticSelection();
    setCaptureError(null);
    hasHydratedFromPendingRef.current = true;
    clearPendingAnalysis();
    setIsPickingImage(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is required to choose an image.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        selectionLimit: 1,
      });

      if (result.canceled || result.assets.length === 0) return;
      const pickedUri = result.assets[0]?.uri;
      if (!pickedUri) {
        throw new Error('No image selected.');
      }

      setCapturedImageUri(pickedUri.includes('://') ? pickedUri : normalizeFileUri(pickedUri));
      hapticSuccess();
    } catch (error) {
      setCaptureError(toErrorMessage(error));
      hapticError();
    } finally {
      setIsPickingImage(false);
    }
  }, [clearPendingAnalysis, isBusy]);

  const handleAnalyzeCapturedImage = useCallback(async () => {
    if (!capturedImageUri || isAnalyzing) return;

    setCaptureError(null);
    hapticImpact('light');
    const capturedAt = new Date().toISOString();

    try {
      const result = await analyzeFoodMutation.mutateAsync({
        imageUri: capturedImageUri,
        timestamp: capturedAt,
        locale: 'en',
      });

      setPendingAnalysis({
        imageUri: capturedImageUri,
        capturedAt,
        result,
      });
      hapticSuccess();
      router.push('/(food)/result' as never);
    } catch (error) {
      setCaptureError(toErrorMessage(error));
      hapticError();
    }
  }, [analyzeFoodMutation, capturedImageUri, isAnalyzing, router, setPendingAnalysis]);

  useEffect(() => {
    if (hasHydratedFromPendingRef.current) return;
    if (!capturedImageUri && pendingAnalysis?.imageUri) {
      setCapturedImageUri(pendingAnalysis.imageUri);
      hasHydratedFromPendingRef.current = true;
    }
  }, [capturedImageUri, pendingAnalysis]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={screenOptions} />

      {!hasPermission ? (
        <View style={styles.centeredState}>
          <Text selectable style={styles.title}>
            Camera Access Needed
          </Text>
          <Text selectable style={styles.subtitle}>
            Allow camera access to capture your food and estimate sodium.
          </Text>
          <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={requestPermission}>
            <Text selectable style={styles.primaryButtonLabel}>
              Grant Access
            </Text>
          </Pressable>
        </View>
      ) : !device ? (
        <View style={styles.centeredState}>
          <Text selectable style={styles.title}>
            Camera Unavailable
          </Text>
          <Text selectable style={styles.subtitle}>
            No compatible back camera was found on this device.
          </Text>
        </View>
      ) : (
        <>
          {capturedImageUri ? (
            <Shimmer style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri: capturedImageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={220}
                recyclingKey={capturedImageUri}
              />
              {isAnalyzing ? (
                <Shimmer.Overlay width="40%" duration={1200} repeatDelay={90} overlayAngle={12}>
                  <View style={styles.imageShimmerTrack}>
                    <View style={styles.imageShimmerEdge} />
                    <View style={styles.imageShimmerCenter} />
                    <View style={styles.imageShimmerEdge} />
                  </View>
                </Shimmer.Overlay>
              ) : null}
            </Shimmer>
          ) : (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isFocused && !capturedImageUri}
              photo={true}
              enableZoomGesture={!capturedImageUri}
              torch={flashEnabled && supportsTorch ? 'on' : 'off'}
            />
          )}

          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 12 }]}>
            {captureError ? (
              <Text selectable style={styles.errorText}>
                {captureError}
              </Text>
            ) : null}

            {capturedImageUri ? (
              <View style={styles.actionsRow}>
                <PressableScale
                  style={[ styles.actionButton, styles.secondaryButton, isBusy ? styles.disabledButton : null]}
                  onPress={isBusy ? undefined : handleRetake}
                >
                  <Text selectable style={styles.secondaryButtonLabel}>
                    Retake
                  </Text>
                </PressableScale>
                <PressableScale
                  style={[ styles.actionButton, styles.primaryButton, isBusy ? styles.disabledButton : null]}
                  onPress={isBusy ? undefined : () => void handleAnalyzeCapturedImage()}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator size="small" color={Theme.colors.foundation} />
                  ) : (
                    <Text selectable style={styles.primaryButtonLabel}>
                      Analyze
                    </Text>
                  )}
                </PressableScale>
              </View>
            ) : (
              <View style={styles.captureContainer}>
                <View style={styles.captureControlsRow}>
                  <PressableScale
                    style={[styles.galleryButton, isBusy ? styles.disabledButton : null]}
                    onPress={isBusy ? undefined : () => void handlePickFromLibrary()}
                  >
                    <Ionicons name="images-outline" size={22} color="#FFFFFF" />
                  </PressableScale>
                <PressableScale
                  style={[
                    styles.shutterButton,
                    isBusy ? styles.disabledButton : null,
                  ]}
                  onPress={isBusy ? undefined : () => void handleCapture()}
                >
                  <Ionicons name="radio-button-on" size={78} color="#FFFFFF" />
                </PressableScale>
                  <View style={styles.captureSpacer} />
                </View>
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
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    gap: 10,
  },
  errorText: {
    alignSelf: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.danger,
    backgroundColor: Theme.colors.glass1,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },

  captureContainer: {
    gap: 8,
    alignItems: 'center',
  },
  captureControlsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  captureSpacer: {
    width: 46,
    height: 46,
  },
  shutterButton: {
    width: 82,
    height: 82,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {

    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 12,
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
});
