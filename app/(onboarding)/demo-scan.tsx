import { Theme } from '@/constants/Theme';
import { Button as AndroidButton } from '@expo/ui/jetpack-compose';
import { Button, Host, Text as IOSText } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  frame,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useIsFocused } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { PressableScale } from 'pressto';
import { usePostHog } from 'posthog-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, type Camera as VisionCamera } from 'react-native-vision-camera';

const TOTAL_STEPS = 10;
const STEP_INDEX = 6;

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export default function OnboardingDemoScanScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const isFocused = useIsFocused();
  const isIOS = process.env.EXPO_OS === 'ios';
  const cameraRef = useRef<VisionCamera | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);

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
      setIsPermissionDenied(!granted);
    } catch (error) {
      posthog?.capture('Onboarding Demo Camera Permission Result', {
        granted: false,
        error_message: error instanceof Error ? error.message : 'unknown_error',
      });
      setIsPermissionDenied(true);
    }
  }, [posthog, requestPermission]);

  const handleOpenSettings = useCallback(async () => {
    posthog?.capture('Onboarding Demo Camera Settings Opened');
    try {
      await Linking.openSettings();
    } catch (error) {
      posthog?.capture('Onboarding Demo Camera Settings Failed', {
        error_message: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }, [posthog]);

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
        <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.permissionContent}>
            <View style={styles.lightProgressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            <View style={styles.permissionHero}>
              <View style={styles.permissionIconWrap}>
                <View style={styles.permissionIconLensOuter}>
                  <View style={styles.permissionIconLensInner} />
                </View>
              </View>
              <Text selectable style={styles.permissionTitle}>
                {t('onboarding.demoScan.permissionTitle')}
              </Text>
              <Text selectable style={styles.permissionSubtitle}>
                {t('onboarding.demoScan.permissionSubtitle')}
              </Text>
            </View>

            <View style={styles.permissionCard}>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.permissionPoint.instant', {
                    defaultValue: 'Capture takes just a few seconds.',
                  })}
                </Text>
              </View>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.permissionPoint.private', {
                    defaultValue: 'Your camera is only used to generate your preview.',
                  })}
                </Text>
              </View>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.permissionPoint.skip', {
                    defaultValue: 'You can skip now and enable it later.',
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.permissionFooter}>
            {isIOS ? (
              <Host matchContents useViewportSizeMeasurement style={{ alignSelf: 'center' }}>
                <Button
                  onPress={() => void handleRequestPermission()}
                  modifiers={[
                    buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
                    tint(Theme.colors.accent),
                    controlSize('regular'),
                  ]}
                >
                  <IOSText
                    modifiers={[
                      font({ size: 17, weight: 'medium' }),
                      padding({ horizontal: 12, vertical: 6 }),
                      frame({ width: width * 0.84 }),
                    ]}
                  >
                    {t('common.enableCamera')}
                  </IOSText>
                </Button>
              </Host>
            ) : (
              <View style={{ width: width * 0.84, alignSelf: 'center' }}>
                <AndroidButton onPress={() => void handleRequestPermission()} color={Theme.colors.accent}>
                  {t('common.enableCamera')}
                </AndroidButton>
              </View>
            )}

            <Pressable onPress={() => handleSkip('permission')} style={styles.skipWrap}>
              <Text selectable style={styles.skipTextDark}>
                {t('common.skipForNow')}
              </Text>
            </Pressable>
            {isPermissionDenied ? (
              <Pressable onPress={() => void handleOpenSettings()} style={styles.openSettingsWrap}>
                <Text selectable style={styles.openSettingsText}>
                  {t('common.openSettings', { defaultValue: 'Open Settings' })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : !device ? (
        <View style={[styles.centered, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.permissionContent}>
            <View style={styles.lightProgressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>

            <View style={styles.permissionHero}>
              <View style={[styles.permissionIconWrap, styles.unavailableIconWrap]}>
                <View style={styles.permissionIconLensOuter}>
                  <View style={styles.permissionIconLensInner} />
                </View>
                <View style={styles.unavailableIconSlash} />
              </View>
              <Text selectable style={styles.permissionTitle}>
                {t('onboarding.demoScan.unavailableTitle')}
              </Text>
              <Text selectable style={styles.permissionSubtitle}>
                {t('onboarding.demoScan.unavailableSubtitle')}
              </Text>
            </View>

            <View style={styles.permissionCard}>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.unavailablePoint.preview', {
                    defaultValue: 'You can still continue to see your personalized preview flow.',
                  })}
                </Text>
              </View>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.unavailablePoint.compatibility', {
                    defaultValue: 'Face scan capture requires a supported front camera.',
                  })}
                </Text>
              </View>
              <View style={styles.permissionPoint}>
                <View style={styles.permissionPointDot} />
                <Text selectable style={styles.permissionPointText}>
                  {t('onboarding.demoScan.unavailablePoint.later', {
                    defaultValue: 'You can try scanning later on a compatible device.',
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.permissionFooter}>
            {isIOS ? (
              <Host matchContents useViewportSizeMeasurement style={{ alignSelf: 'center' }}>
                <Button
                  onPress={() => handleSkip('camera_unavailable')}
                  modifiers={[
                    buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
                    tint(Theme.colors.accent),
                    controlSize('regular'),
                  ]}
                >
                  <IOSText
                    modifiers={[
                      font({ size: 17, weight: 'medium' }),
                      padding({ horizontal: 12, vertical: 6 }),
                      frame({ width: width * 0.84 }),
                    ]}
                  >
                    {t('onboarding.demoScan.continueToPreview')}
                  </IOSText>
                </Button>
              </Host>
            ) : (
              <View style={{ width: width * 0.84, alignSelf: 'center' }}>
                <AndroidButton onPress={() => handleSkip('camera_unavailable')} color={Theme.colors.accent}>
                  {t('onboarding.demoScan.continueToPreview')}
                </AndroidButton>
              </View>
            )}
          </View>
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
  permissionCard: {
    marginTop: 24,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    boxShadow: '0 14px 34px rgba(15,23,42,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  permissionContent: {
    width: '100%',
  },
  permissionFooter: {
    width: '100%',
    marginTop: 'auto',
  },
  permissionHero: {
    alignItems: 'center',
    marginTop: 24,
  },
  permissionIconLensInner: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: Theme.colors.accent,
  },
  permissionIconLensOuter: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Theme.colors.accent}1A`,
  },
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Theme.colors.accent}17`,
    borderWidth: 1,
    borderColor: `${Theme.colors.accent}30`,
  },
  permissionPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionPointDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Theme.colors.accent,
  },
  permissionPointText: {
    flex: 1,
    color: 'rgba(0,0,0,0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  permissionSubtitle: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.62)',
    fontSize: 15,
    lineHeight: 21,
  },
  permissionTitle: {
    marginTop: 20,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
  },
  openSettingsText: {
    color: Theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  openSettingsWrap: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  unavailableIconSlash: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: Theme.colors.accent,
    position: 'absolute',
    transform: [{ rotate: '-36deg' }],
  },
  unavailableIconWrap: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderColor: 'rgba(244,63,94,0.24)',
  },
});
