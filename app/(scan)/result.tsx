import { NativeButton } from '@/components/native-button';
import { Theme } from '@/constants/Theme';
import { faceScans } from '@/db/schema';
import { useDbStore } from '@/stores/dbStore';
import { deletePersistedScan, type ScanResultPayload } from '@/utils/scan-intake';
import {
  hapticError,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
  stopAllAppHaptics,
} from '@/utils/haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Canvas, Group, ImageFormat, Path, Skia, makeImageFromView } from '@shopify/react-native-skia';
import { Button as IOSButton, Host as IOSHost, HStack as IOSHStack, Spacer as IOSSpacer } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { and, desc, eq } from 'drizzle-orm';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RouteParams = {
  imageUri?: string | string[];
  capturedAt?: string | string[];
  result?: string | string[];
};

function firstParamValue(value?: string | string[]): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseResultParam(raw?: string): ScanResultPayload | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded) as ScanResultPayload;
  } catch {
    return null;
  }
}

function formatFocusAreaTag(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function parseFlaggedAreas(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function formatScanTimestamp(value?: string | null): string {
  if (!value) return 'Unknown time';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

const GAUGE_SIZE = 206;
const GAUGE_STROKE = 14;

function BloatIndexGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clampedScore / 100, { duration: 750 });
  }, [clampedScore, progress]);

  const ringProgress = useDerivedValue(() => progress.value);
  const ringColor = useDerivedValue(() =>
    interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['#22C55E', '#F59E0B', '#EF4444']
    )
  );

  const circlePath = useMemo(() => {
    const radius = (GAUGE_SIZE - GAUGE_STROKE) / 2;
    const path = Skia.Path.Make();
    path.addCircle(GAUGE_SIZE / 2, GAUGE_SIZE / 2, radius);
    return path;
  }, []);

  return (
    <View style={styles.gaugeWrap}>
      <Canvas style={styles.gaugeCanvas}>
        <Group
          origin={{ x: GAUGE_SIZE / 2, y: GAUGE_SIZE / 2 }}
          transform={[{ rotate: -Math.PI / 2 }]}
        >
          <Path
            path={circlePath}
            style="stroke"
            strokeWidth={GAUGE_STROKE}
            color="#E5E7EB"
            strokeCap="round"
          />
          <Path
            path={circlePath}
            style="stroke"
            strokeWidth={GAUGE_STROKE}
            color={ringColor}
            start={0}
            end={ringProgress}
            strokeCap="round"
          />
        </Group>
      </Canvas>

      <View style={styles.gaugeCenter}>
        <Text selectable style={styles.scoreValue}>
          {clampedScore}
        </Text>
      </View>
    </View>
  );
}

export default function Result() {
  const router = useRouter();
  const db = useDbStore((state) => state.db);
  const insets = useSafeAreaInsets();
  const reportRef = useRef<View>(null);
  const params = useLocalSearchParams<RouteParams>();
  const imageUri = useMemo(() => firstParamValue(params.imageUri), [params.imageUri]);
  const capturedAt = useMemo(() => firstParamValue(params.capturedAt), [params.capturedAt]);
  const result = useMemo(
    () => parseResultParam(firstParamValue(params.result)),
    [params.result]
  );
  const focusAreas = useMemo(
    () => (result?.focus_areas ?? []).map(formatFocusAreaTag).filter(Boolean),
    [result?.focus_areas]
  );
  const protocol = useMemo(
    () => (result?.suggested_protocol ?? '').replace(/_/g, ' ').toUpperCase(),
    [result?.suggested_protocol]
  );
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const persistedScanQuery = useQuery({
    enabled: Boolean(db) && Boolean(capturedAt || imageUri),
    queryKey: ['scan-result-entry', capturedAt ?? null, imageUri ?? null],
    queryFn: async () => {
      if (!db || (!capturedAt && !imageUri)) return null;
      const builder = db
        .select({
          id: faceScans.id,
          createdAt: faceScans.createdAt,
          score: faceScans.score,
          feedback: faceScans.feedback,
          flaggedAreas: faceScans.flaggedAreas,
          localImageUri: faceScans.localImageUri,
        })
        .from(faceScans);

      if (capturedAt && imageUri) {
        const [row] = await builder
          .where(and(eq(faceScans.createdAt, capturedAt), eq(faceScans.localImageUri, imageUri)))
          .orderBy(desc(faceScans.id))
          .limit(1);
        return row ?? null;
      }

      if (capturedAt) {
        const [row] = await builder.where(eq(faceScans.createdAt, capturedAt)).orderBy(desc(faceScans.id)).limit(1);
        return row ?? null;
      }

      const [row] = await builder.where(eq(faceScans.localImageUri, imageUri!)).orderBy(desc(faceScans.id)).limit(1);
      return row ?? null;
    },
  });

  const persistedScan = persistedScanQuery.data;
  const effectiveScore = result?.score ?? persistedScan?.score ?? null;
  const analysisText = (result?.analysis_summary ?? persistedScan?.feedback ?? '').trim();
  const effectiveFocusAreas = useMemo(() => {
    if (focusAreas.length > 0) return focusAreas;
    return parseFlaggedAreas(persistedScan?.flaggedAreas ?? null).map(formatFocusAreaTag);
  }, [focusAreas, persistedScan?.flaggedAreas]);
  const scanTimestampLabel = useMemo(
    () => formatScanTimestamp(capturedAt ?? persistedScan?.createdAt ?? null),
    [capturedAt, persistedScan?.createdAt]
  );
  const hasRenderableScan = Boolean(result || persistedScan);
  const hasLivePayload = Boolean(result);
  const hasPersistedPayload = Boolean(persistedScan);
  const sourceLabel = hasLivePayload
    ? hasPersistedPayload
      ? 'Live payload + saved scan'
      : 'Live payload'
    : hasPersistedPayload
      ? 'Saved scan'
      : 'Preview only';

  useEffect(
    () => () => {
      stopAllAppHaptics();
    },
    []
  );

  const shareFileAsync = useCallback(async (
    fileUri: string,
    dialogTitle: string,
    mimeType: string,
    uti: string
  ) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(normalizeFileUri(fileUri), {
      dialogTitle,
      mimeType,
      UTI: uti,
    });
  }, []);

  const handleShareReport = useCallback(async () => {
    setIsSharing(true);
    hapticSelection();
    try {
      const snapshot = await makeImageFromView(reportRef);
      if (!snapshot) {
        throw new Error('Unable to snapshot the report.');
      }

      const base64Png = snapshot.encodeToBase64(ImageFormat.PNG, 100);
      const reportFile = new File(Paths.cache, `clinical-report-${Date.now()}.png`);
      reportFile.create({ overwrite: true, intermediates: true });
      reportFile.write(base64Png, { encoding: 'base64' });

      await shareFileAsync(reportFile.uri, 'Share Clinical Report', 'image/png', 'public.png');
      hapticSuccess();
    } catch (error) {
      console.warn(error);
      hapticError();
    } finally {
      setIsSharing(false);
    }
  }, [shareFileAsync]);

  const handleSaveFaceImage = useCallback(async () => {
    if (!imageUri) return;

    setIsSharing(true);
    hapticSelection();
    try {
      await shareFileAsync(imageUri, 'Save Face Image', 'image/*', 'public.image');
      hapticSuccess();
    } catch (error) {
      console.warn(error);
      hapticError();
    } finally {
      setIsSharing(false);
    }
  }, [imageUri, shareFileAsync]);

  const runDeleteScan = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deletePersistedScan({
        imageUri,
        createdAt: capturedAt,
      });
      hapticWarning();
      router.replace('/(scan)' as never);
    } catch (error) {
      hapticError();
      Alert.alert(
        'Delete failed',
        error instanceof Error ? error.message : 'Unable to delete this scan.'
      );
    } finally {
      setIsDeleting(false);
    }
  }, [capturedAt, imageUri, router]);

  const confirmDeleteScan = useCallback(() => {
    hapticSelection();
    Alert.alert('Delete this scan?', 'This will remove this report and photo from local storage.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void runDeleteScan() },
    ]);
  }, [runDeleteScan]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View ref={reportRef} collapsable={false} style={styles.reportContent}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} contentFit="cover" style={styles.photoImage} transition={180} />
          ) : null}

          {hasRenderableScan ? (
            <>
              <View style={styles.tagCard}>
                <Text selectable style={styles.sectionLabel}>
                  FLAGGED AREAS
                </Text>
                {effectiveFocusAreas.length ? (
                  <View style={styles.tagRow}>
                    {effectiveFocusAreas.map((tag) => (
                      <View key={tag} style={styles.tagChip}>
                        <Text selectable style={styles.tagText}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text selectable style={styles.emptyTagText}>
                    No flagged regions
                  </Text>
                )}
              </View>

              <View style={styles.scoreCard}>
                <Text selectable style={styles.scoreLabel}>
                  BLOAT INDEX
                </Text>
                <BloatIndexGauge score={effectiveScore ?? 0} />
              </View>

              <View style={styles.analysisCard}>
                <Text selectable style={styles.analysisTitle}>
                  Analysis
                </Text>
                <Text selectable style={styles.analysisText}>
                  {analysisText || 'No analysis payload found for this result.'}
                </Text>
                <Text selectable style={styles.protocolText}>
                  Protocol: {protocol || 'N/A'}
                </Text>
                <View style={styles.metaRow}>
                  <Text selectable style={styles.metaText}>
                    Scanned: {scanTimestampLabel}
                  </Text>
                  <Text selectable style={styles.metaText}>
                    Source: {sourceLabel}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.analysisCard}>
              <Text selectable style={styles.analysisText}>
                No analysis payload found for this result.
              </Text>
            </View>
          )}
        </View>

        {process.env.EXPO_OS === 'ios' ? (
          <IOSHost
            style={[styles.iosActionsHost, styles.resultActionsContainer, { paddingBottom: insets.bottom + 10 }]}
          >
            <IOSHStack spacing={12}>
              <IOSButton
                label="New Scan"
                systemImage="camera.viewfinder"
                role="cancel"
                onPress={() => {
                  hapticImpact('light');
                  router.replace('/(scan)' as never);
                }}
                modifiers={[
                  controlSize('large'),
                  tint('#475569'),
                  buttonStyle(isLiquidGlassAvailable() ? 'glass' : 'bordered'),
                ]}
              />
              <IOSSpacer />
              <IOSButton
                label="Done"
                systemImage="checkmark"
                onPress={() => {
                  hapticImpact('light');
                  router.replace('/(tabs)/(home)' as never);
                }}
                modifiers={[
                  buttonStyle(isLiquidGlassAvailable() ? 'glassProminent' : 'borderedProminent'),
                  tint(Theme.colors.accent),
                  controlSize('large'),
                ]}
              />
            </IOSHStack>
          </IOSHost>
        ) : (
          <View style={[styles.resultActionsContainer, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <NativeButton
                  label="New Scan"
                  kind="secondary"
                  role="cancel"
                  onPress={() => {
                    hapticImpact('light');
                    router.replace('/(scan)' as never);
                  }}
                />
              </View>
              <View style={styles.actionItem}>
                <NativeButton
                  label="Done"
                  onPress={() => {
                    hapticImpact('light');
                    router.replace('/(tabs)/(home)' as never);
                  }}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Stack.Screen
        options={{
          title: 'Clinical Report',
          headerShown: true,
          headerShadowVisible: false,
          headerTransparent: isLiquidGlassAvailable(),
          headerStyle: { backgroundColor:isLiquidGlassAvailable() ? 'transparent' : '#F3F4F6' },
        }}
      />
      {process.env.EXPO_OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis.circle">
            <Stack.Toolbar.MenuAction
              icon="square.and.arrow.up"
              onPress={() => void handleShareReport()}
              disabled={isSharing}
            >
              Share Report
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="square.and.arrow.down"
              onPress={() => void handleSaveFaceImage()}
              disabled={!imageUri || isSharing}
            >
              Save Image
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="trash"
              destructive
              onPress={confirmDeleteScan}
              disabled={isDeleting || isSharing || (!imageUri && !capturedAt)}
            >
              Delete Scan
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 14,
  },
  reportContent: {
    gap: 14,
  },
  photoImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#E5E7EB',
    boxShadow: '0 10px 24px rgba(17, 24, 39, 0.08)',
  },
  tagCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    boxShadow: '0 8px 20px rgba(17, 24, 39, 0.06)',
  },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#22D3EE',
    backgroundColor: '#E0F7FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: '#0891B2',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTagText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    boxShadow: '0 8px 20px rgba(17, 24, 39, 0.06)',
  },
  gaugeWrap: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    marginTop: 4,
  },
  gaugeCanvas: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
  },
  gaugeCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  scoreValue: {
    color: '#111111',
    fontSize: 74,
    lineHeight: 80,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  analysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    boxShadow: '0 6px 16px rgba(17, 24, 39, 0.05)',
  },
  analysisTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  analysisText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  protocolText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  metaRow: {
    gap: 3,
    marginTop: 2,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  resultActionsContainer: {
    width: '100%',
  },
  iosActionsHost: {
    width: '100%',
  },
  actionItem: {
    flex: 1,
  },
});
