import Shimmer from '@/components/shimmer';
import { PAYWALL_ROUTE, FREE_DAILY_FOOD_ANALYSES } from '@/constants/gating';
import { Theme } from '@/constants/Theme';
import { foodLogs } from '@/db/schema';
import { useAnalyzeFoodMutation } from '@/hooks/useBridgeApi';
import { toDailyDate } from '@/hooks/useDayStatus';
import { BridgeApiError, type BridgeLocale } from '@/services/bridge-api';
import { useSubscription } from '@/context/SubscriptionContext';
import { useDbStore } from '@/stores/dbStore';
import { useFoodAnalysisStore } from '@/stores/foodAnalysisStore';
import { hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { sql } from 'drizzle-orm';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { PressableScale } from 'pressto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, type Camera as VisionCamera } from 'react-native-vision-camera';
import { usePostHog } from 'posthog-react-native';

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
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
  return fallbackMessage;
}

function toBridgeLocale(locale: string): BridgeLocale {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('fr')) return 'fr';
  if (normalized.startsWith('de')) return 'de';
  if (normalized.startsWith('it')) return 'it';
  if (normalized.startsWith('nl')) return 'nl';
  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('ja') || normalized.startsWith('jp')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return 'en';
}

export default function FoodIndexScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const db = useDbStore((state) => state.db);
  const { isPro } = useSubscription();
  const posthog = usePostHog();
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
  const todayDateKey = toDailyDate(new Date());
  const isAnalyzing = analyzeFoodMutation.isPending;
  const isBusy = isCapturing || isAnalyzing || isPickingImage;
  const supportsFlashCapture = Boolean(device?.hasFlash);
  const supportsTorch = Boolean(device?.hasTorch);
  const canUseFlashControl = supportsFlashCapture || supportsTorch;
  const flashIconName = flashEnabled ? ('bolt.fill' as const) : ('bolt.slash' as const);
  const todayFoodAnalysisCountQuery = useQuery({
    enabled: Boolean(db) && !isPro,
    queryKey: ['food-limit-count', todayDateKey],
    queryFn: async () => {
      if (!db) return 0;
      const [row] = await db
        .select({
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(foodLogs)
        .where(sql`${foodLogs.logDate} = ${todayDateKey}`);
      return row?.count ?? 0;
    },
  });
  const isDailyFoodLimitReached = !isPro && (todayFoodAnalysisCountQuery.data ?? 0) >= FREE_DAILY_FOOD_ANALYSES;

  const handleOpenPaywall = useCallback(() => {
    hapticSelection();
    router.push(PAYWALL_ROUTE as never);
  }, [router]);

  useEffect(() => {
    if (!canUseFlashControl && flashEnabled) {
      setFlashEnabled(false);
    }
  }, [canUseFlashControl, flashEnabled]);

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: t('food.logFood', { defaultValue: 'Log Food' }),
      headerTransparent: true,
      headerTintColor: Theme.colors.textPrimary,
      headerBackButtonDisplayMode: 'minimal' as const,
      unstable_headerRightItems: () => [
        ...(canUseFlashControl
          ? [
              {
                type: 'button' as const,
                label: flashEnabled
                  ? t('scan.flashOff', { defaultValue: 'Flash Off' })
                  : t('scan.flashOn', { defaultValue: 'Flash On' }),
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
    [canUseFlashControl, flashEnabled, flashIconName, t]
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
        throw new Error(t('food.errors.noImagePath', { defaultValue: 'No image path returned by camera' }));
      }

      setCapturedImageUri(normalizeFileUri(photo.path));
      hapticSuccess();
    } catch (error) {
      setCaptureError(
        toErrorMessage(error, t('food.errors.captureFailed', { defaultValue: 'Unable to capture image.' }))
      );
      hapticError();
    } finally {
      setIsCapturing(false);
    }
  }, [clearPendingAnalysis, flashEnabled, isCapturing, supportsFlashCapture, t]);

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
        throw new Error(
          t('food.errors.libraryPermissionRequired', {
            defaultValue: 'Photo library access is required to choose an image.',
          })
        );
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
        throw new Error(t('food.errors.noImageSelected', { defaultValue: 'No image selected.' }));
      }

      setCapturedImageUri(pickedUri.includes('://') ? pickedUri : normalizeFileUri(pickedUri));
      hapticSuccess();
    } catch (error) {
      setCaptureError(
        toErrorMessage(
          error,
          t('food.errors.libraryPickFailed', { defaultValue: 'Unable to select this image.' })
        )
      );
      hapticError();
    } finally {
      setIsPickingImage(false);
    }
  }, [clearPendingAnalysis, isBusy, t]);

  const handleAnalyzeCapturedImage = useCallback(async () => {
    if (!capturedImageUri || isAnalyzing) return;
    if (isDailyFoodLimitReached) {
      setCaptureError(
        t('food.errors.dailyLimitReached', {
          defaultValue: 'Daily food analysis limit reached. Upgrade to Pro for unlimited analyses.',
        })
      );
      handleOpenPaywall();
      return;
    }

    setCaptureError(null);
    hapticImpact('light');
    const capturedAt = new Date().toISOString();

    try {
      const result = await analyzeFoodMutation.mutateAsync({
        imageUri: capturedImageUri,
        timestamp: capturedAt,
        locale: toBridgeLocale(i18n.language),
      });

      posthog?.capture('Food Analyzed', {
        food_name: result.food_name,
        sodium_mg: result.sodium_mg,
        bloat_risk: result.bloat_risk,
      });
      setPendingAnalysis({
        imageUri: capturedImageUri,
        capturedAt,
        result,
      });
      hapticSuccess();
      router.push('/(food)/result' as never);
    } catch (error) {
      const foodErrorMessage = toErrorMessage(
        error,
        t('food.errors.analyzeFailed', { defaultValue: 'Unable to analyze this image.' })
      );
      posthog?.capture('Food Analysis Failed', {
        error_message: foodErrorMessage,
      });
      setCaptureError(foodErrorMessage);
      hapticError();
    }
  }, [analyzeFoodMutation, capturedImageUri, handleOpenPaywall, i18n.language, isAnalyzing, isDailyFoodLimitReached, posthog, router, setPendingAnalysis, t]);

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
            {t('scan.cameraAccessNeeded', { defaultValue: 'Camera Access Needed' })}
          </Text>
          <Text selectable style={styles.subtitle}>
            {t('food.cameraPermissionSubtitle', {
              defaultValue: 'Allow camera access to capture your food and estimate sodium.',
            })}
          </Text>
          <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={requestPermission}>
            <Text selectable style={styles.primaryButtonLabel}>
              {t('scan.grantAccess', { defaultValue: 'Grant Access' })}
            </Text>
          </Pressable>
        </View>
      ) : !device ? (
        <View style={styles.centeredState}>
          <Text selectable style={styles.title}>
            {t('scan.cameraUnavailable', { defaultValue: 'Camera Unavailable' })}
          </Text>
          <Text selectable style={styles.subtitle}>
            {t('food.backCameraUnavailable', {
              defaultValue: 'No compatible back camera was found on this device.',
            })}
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
                    {t('common.retake', { defaultValue: 'Retake' })}
                  </Text>
                </PressableScale>
                <PressableScale
                  style={[ styles.actionButton, styles.primaryButton, isBusy || isDailyFoodLimitReached ? styles.disabledButton : null]}
                  onPress={isBusy ? undefined : isDailyFoodLimitReached ? handleOpenPaywall : () => void handleAnalyzeCapturedImage()}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator size="small" color={Theme.colors.foundation} />
                  ) : (
                    <Text selectable style={styles.primaryButtonLabel}>
                      {isDailyFoodLimitReached
                        ? t('common.upgrade', { defaultValue: 'Upgrade' })
                        : t('common.analyze', { defaultValue: 'Analyze' })}
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
          {isDailyFoodLimitReached ? (
            <View style={styles.limitBanner}>
              <Text selectable style={styles.limitBannerText}>
                {t('food.dailyLimitBanner', {
                  defaultValue: 'Daily free food analyses used. Upgrade to Pro for unlimited analyses.',
                })}
              </Text>
              <PressableScale style={styles.limitBannerButton} onPress={handleOpenPaywall}>
                <Text selectable style={styles.limitBannerButtonLabel}>
                  {t('common.unlockPro', { defaultValue: 'Unlock Pro' })}
                </Text>
              </PressableScale>
            </View>
          ) : null}
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
  limitBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  limitBannerText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  limitBannerButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: Theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  limitBannerButtonLabel: {
    color: Theme.colors.foundation,
    fontSize: 13,
    fontWeight: '700',
  },
});
