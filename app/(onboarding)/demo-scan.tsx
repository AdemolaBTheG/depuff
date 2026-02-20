import { Theme } from '@/constants/Theme';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { PressableScale } from 'pressto';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, type Camera as VisionCamera } from 'react-native-vision-camera';

const TOTAL_STEPS = 10;
const STEP_INDEX = 6;

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export default function OnboardingDemoScanScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();
  const cameraRef = useRef<VisionCamera | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const supportsFlashCapture = Boolean(device?.hasFlash);
  const supportsTorch = Boolean(device?.hasTorch);
  const canUseFlashControl = supportsFlashCapture || supportsTorch;
  const progress = useMemo(() => (STEP_INDEX + 1) / TOTAL_STEPS, []);

  const handleSkip = useCallback((source: 'permission' | 'camera_unavailable' | 'camera_screen') => {
    void Haptics.selectionAsync();
    posthog?.capture('Onboarding Demo Scan Skipped', { source });
    router.replace('/(onboarding)/demo-preview');
  }, [posthog]);

  const handleRequestPermission = useCallback(async () => {
    posthog?.capture('Onboarding Demo Camera Permission Requested');
    try {
      const granted = await requestPermission();
      posthog?.capture('Onboarding Demo Camera Permission Result', {
        granted,
      });
    } catch (error) {
      posthog?.capture('Onboarding Demo Camera Permission Result', {
        granted: false,
        error_message: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }, [posthog, requestPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    setCaptureError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    posthog?.capture('Onboarding Demo Scan Capture Started', {
      flash_enabled: flashEnabled && supportsFlashCapture,
    });

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: flashEnabled && supportsFlashCapture ? 'on' : 'off',
      });
      const uri = normalizeFileUri(photo.path);
      posthog?.capture('Onboarding Demo Scan Capture Succeeded', {
        flash_enabled: flashEnabled && supportsFlashCapture,
      });
      router.push({
        pathname: '/(onboarding)/demo-preview',
        params: { imageUri: uri },
      });
    } catch (error) {
      posthog?.capture('Onboarding Demo Scan Capture Failed', {
        error_message: error instanceof Error ? error.message : 'unknown_error',
      });
      setCaptureError(error instanceof Error ? error.message : t('onboarding.demoScan.captureFailed'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCapturing(false);
    }
  }, [flashEnabled, isCapturing, posthog, supportsFlashCapture, t]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {!hasPermission ? (
        <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
          <View style={styles.lightProgressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text selectable style={styles.title}>
            {t('onboarding.demoScan.permissionTitle')}
          </Text>
          <Text selectable style={styles.subtitle}>
            {t('onboarding.demoScan.permissionSubtitle')}
          </Text>
          <PressableScale style={styles.primaryCta} onPress={() => void handleRequestPermission()}>
            <Text selectable style={styles.primaryCtaLabel}>
              {t('common.enableCamera')}
            </Text>
          </PressableScale>
          <Pressable onPress={() => handleSkip('permission')} style={styles.skipWrap}>
            <Text selectable style={styles.skipTextDark}>
              {t('common.skipForNow')}
            </Text>
          </Pressable>
        </View>
      ) : !device ? (
        <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
          <View style={styles.lightProgressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text selectable style={styles.title}>
            {t('onboarding.demoScan.unavailableTitle')}
          </Text>
          <Text selectable style={styles.subtitle}>
            {t('onboarding.demoScan.unavailableSubtitle')}
          </Text>
          <PressableScale style={styles.primaryCta} onPress={() => handleSkip('camera_unavailable')}>
            <Text selectable style={styles.primaryCtaLabel}>
              {t('onboarding.demoScan.continueToPreview')}
            </Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            photo
            enableZoomGesture
            torch={flashEnabled && supportsTorch ? 'on' : 'off'}
          />

          <View style={[styles.topOverlay, { paddingTop: insets.top + 16 }]}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <View style={styles.headerRow}>
              <Text selectable style={styles.cameraTitle}>
                {t('onboarding.demoScan.previewTitle')}
              </Text>
              <Pressable onPress={() => handleSkip('camera_screen')}>
                <Text selectable style={styles.skipText}>
                  {t('common.skip')}
                </Text>
              </Pressable>
            </View>
            <Text selectable style={styles.cameraSubtitle}>
              {t('onboarding.demoScan.cameraSubtitle')}
            </Text>
          </View>

          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 14 }]}>
            {captureError ? (
              <Text selectable style={styles.errorText}>
                {captureError}
              </Text>
            ) : null}
            <View style={styles.captureRow}>
              <PressableScale
                style={[styles.flashButton, !canUseFlashControl ? styles.flashButtonDisabled : null]}
                onPress={
                  canUseFlashControl
                    ? () => {
                        setFlashEnabled((prev) => !prev);
                        void Haptics.selectionAsync();
                      }
                    : undefined
                }>
                <Text selectable style={styles.flashButtonLabel}>
                  {flashEnabled ? t('onboarding.demoScan.flashOn') : t('onboarding.demoScan.flashOff')}
                </Text>
              </PressableScale>

              <PressableScale style={styles.captureButton} onPress={handleCapture}>
                {isCapturing ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </PressableScale>

              <View style={styles.flashButtonSpacer} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  cameraSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    marginTop: 6,
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  captureButton: {
    width: 74,
    height: 74,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.foundation,
  },
  errorText: {
    color: '#FFFFFF',
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  flashButton: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
  },
  flashButtonDisabled: {
    opacity: 0.45,
  },
  flashButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  flashButtonSpacer: {
    width: 92,
  },
  headerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lightProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  primaryCta: {
    marginTop: 28,
    backgroundColor: Theme.colors.accent,
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  primaryCtaLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  skipTextDark: {
    color: 'rgba(0,0,0,0.66)',
    fontSize: 14,
    fontWeight: '600',
  },
  skipWrap: {
    marginTop: 16,
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.62)',
    fontSize: 15,
    lineHeight: 21,
  },
  title: {
    marginTop: 48,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
  },
});
