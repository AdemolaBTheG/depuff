import { NativeButton } from '@/components/native-button';
import { Theme } from '@/constants/Theme';
import type { ScanResultPayload } from '@/utils/scan-intake';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type RouteParams = {
  imageUri?: string | string[];
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

export default function Result() {
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const imageUri = useMemo(() => firstParamValue(params.imageUri), [params.imageUri]);
  const result = useMemo(
    () => parseResultParam(firstParamValue(params.result)),
    [params.result]
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: 'Scan Result', headerShown: true }} />

      {imageUri ? (
        <View style={styles.card}>
          <Image source={{ uri: imageUri }} contentFit="cover" style={styles.previewImage} />
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text selectable style={styles.scoreText}>
            Score {result.score}
          </Text>
          <Text selectable style={styles.summaryText}>
            {result.analysis_summary}
          </Text>
          <Text selectable style={styles.metaText}>
            Status: {result.status}
          </Text>
          <Text selectable style={styles.metaText}>
            Protocol: {result.suggested_protocol}
          </Text>
          <Text selectable style={styles.metaText}>
            Focus Areas: {result.focus_areas.join(', ') || 'none'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text selectable style={styles.summaryText}>
            No analysis payload found for this result.
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <NativeButton
            label="New Scan"
            kind="secondary"
            onPress={() => router.replace('/(scan)' as never)}
          />
        </View>
        <View style={styles.actionItem}>
          <NativeButton
            label="Done"
            onPress={() => router.replace('/(tabs)/(home)' as never)}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.foundation,
  },
  content: {
    padding: 16,
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
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: Theme.colors.glass2,
  },
  scoreText: {
    color: Theme.colors.accent,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryText: {
    color: Theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  metaText: {
    color: Theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  actionItem: {
    flex: 1,
  },
});
