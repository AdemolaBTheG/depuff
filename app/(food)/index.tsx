import { Theme } from '@/constants/Theme';
import Shimmer from '@/components/shimmer';
import { useAnalyzeFoodMutation } from '@/hooks/useBridgeApi';
import { BridgeApiError } from '@/services/bridge-api';
import { useFoodAnalysisStore } from '@/stores/foodAnalysisStore';
import { hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { Button as AndroidButton, Host as AndroidHost } from '@expo/ui/jetpack-compose';
import { Button as IOSButton, Host as IOSHost } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const analyzeFoodMutation = useAnalyzeFoodMutation();
  const pendingAnalysis = useFoodAnalysisStore((state) => state.pendingAnalysis);
  const setPendingAnalysis = useFoodAnalysisStore((state) => state.setPendingAnalysis);
  const clearPendingAnalysis = useFoodAnalysisStore((state) => state.clearPendingAnalysis);

  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const isAnalyzing = analyzeFoodMutation.isPending;
  const isBusy = isCapturing || isAnalyzing;

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: 'Log Food',
      headerTransparent: true,
      headerTintColor: Theme.colors.textPrimary,
      headerBackButtonDisplayMode: 'minimal' as const,
    }),
    []
  );

  const handleCapture = useCallback(async () => {
    if (isCapturing || !cameraRef.current) return;

    setIsCapturing(true);
    setCaptureError(null);
    clearPendingAnalysis();
    hapticImpact('light');

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
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
  }, [clearPendingAnalysis, isCapturing]);

  const handleRetake = useCallback(() => {
    hapticSelection();
    setCaptureError(null);
    setCapturedImageUri(null);
    clearPendingAnalysis();
  }, [clearPendingAnalysis]);

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
    if (!capturedImageUri && pendingAnalysis?.imageUri) {
      setCapturedImageUri(pendingAnalysis.imageUri);
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
                {process.env.EXPO_OS === 'ios' ? (
                  <>
                    <IOSHost style={styles.actionItem} matchContents useViewportSizeMeasurement>
                      <IOSButton
                        label="Retake"
                        role="cancel"
                        onPress={handleRetake}
                        modifiers={[
                          controlSize('large'),
                          tint('rgba(255,255,255,0.2)'),
                          buttonStyle('glassProminent'),
                        ]}
                      />
                    </IOSHost>
                    <IOSHost style={styles.actionItem} matchContents useViewportSizeMeasurement>
                      <IOSButton
                        label={isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        systemImage="sparkles"
                        onPress={() => void handleAnalyzeCapturedImage()}
                        modifiers={[
                          controlSize('large'),
                          tint(Theme.colors.accent),
                          buttonStyle('glassProminent'),
                        ]}
                      />
                    </IOSHost>
                  </>
                ) : process.env.EXPO_OS === 'android' ? (
                  <>
                    <AndroidHost style={styles.actionItem}>
                      <AndroidButton onPress={handleRetake} variant="borderless" disabled={isBusy}>
                        Retake
                      </AndroidButton>
                    </AndroidHost>
                    <AndroidHost style={styles.actionItem}>
                      <AndroidButton
                        onPress={() => void handleAnalyzeCapturedImage()}
                        disabled={isBusy}
                      >
                        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                      </AndroidButton>
                    </AndroidHost>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={[styles.actionItem, styles.actionButton, styles.secondaryButton]}
                      onPress={handleRetake}
                      disabled={isBusy}
                    >
                      <Text selectable style={styles.secondaryButtonLabel}>
                        Retake
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionItem, styles.actionButton, styles.primaryButton]}
                      onPress={() => void handleAnalyzeCapturedImage()}
                      disabled={isBusy}
                    >
                      <Text selectable style={styles.primaryButtonLabel}>
                        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.captureContainer}>
                <PressableScale
                  style={[
                    styles.shutterButton,
                    isBusy ? styles.disabledButton : null,
                  ]}
                  onPress={isBusy ? undefined : () => void handleCapture()}
                >
                  <Ionicons name="radio-button-on" size={78} color="#FFFFFF" />
                </PressableScale>
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
  actionItem: {
    minWidth: 136,
  },
  captureContainer: {
    gap: 8,
    alignItems: 'center',
  },
  shutterButton: {
    width: 82,
    height: 82,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    color: Theme.colors.foundation,
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
