import { Theme } from '@/constants/Theme';
import { useFoodAnalysisStore } from '@/stores/foodAnalysisStore';
import { persistConfirmedFoodAnalysis } from '@/utils/food-intake';
import { hapticError, hapticImpact, hapticSelection, hapticSuccess } from '@/utils/haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const pendingAnalysis = useFoodAnalysisStore((state) => state.pendingAnalysis);
  const clearPendingAnalysis = useFoodAnalysisStore((state) => state.clearPendingAnalysis);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canConfirm = useMemo(() => Boolean(pendingAnalysis) && !isSaving, [isSaving, pendingAnalysis]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAnalysis || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    hapticImpact('light');

    try {
      const { logDate } = await persistConfirmedFoodAnalysis(pendingAnalysis);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['day-balance', logDate] }),
        queryClient.invalidateQueries({ queryKey: ['day-status', logDate] }),
      ]);
      clearPendingAnalysis();
      hapticSuccess();
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save food log.';
      setSaveError(message);
      hapticError();
    } finally {
      setIsSaving(false);
    }
  }, [clearPendingAnalysis, isSaving, pendingAnalysis, queryClient, router]);

  const handleCancel = useCallback(() => {
    hapticSelection();
    clearPendingAnalysis();
    router.back();
  }, [clearPendingAnalysis, router]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: insets.bottom + 20,
        gap: 12,
      }}
    >
      <Stack.Screen options={{ title: 'Food Log', headerShown: true }} />

      {!pendingAnalysis ? (
        <View style={styles.card}>
          <Text selectable style={styles.title}>
            No Pending Food Result
          </Text>
          <Text selectable style={styles.secondary}>
            Capture and analyze a food image first.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.imageCard}>
            <Image source={{ uri: pendingAnalysis.imageUri }} style={styles.image} contentFit="cover" />
          </View>

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              FOOD
            </Text>
            <Text selectable style={styles.value}>
              {pendingAnalysis.result.food_name}
            </Text>
          </View>

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              SODIUM
            </Text>
            <Text selectable style={styles.value}>
              {pendingAnalysis.result.sodium_mg.toLocaleString()} mg
            </Text>
          </View>

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              BLOAT RISK
            </Text>
            <Text selectable style={styles.value}>
              {pendingAnalysis.result.bloat_risk.toUpperCase()}
            </Text>
          </View>

          <View style={styles.card}>
            <Text selectable style={styles.label}>
              COUNTER MEASURE
            </Text>
            <Text selectable style={styles.secondary}>
              {pendingAnalysis.result.counter_measure}
            </Text>
          </View>

          {saveError ? (
            <Text selectable style={styles.errorText}>
              {saveError}
            </Text>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={handleCancel}>
              <Text selectable style={styles.secondaryButtonLabel}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.primaryButton, !canConfirm ? styles.disabledButton : null]}
              onPress={() => void handleConfirm()}
              disabled={!canConfirm}
            >
              <Text selectable style={styles.primaryButtonLabel}>
                {isSaving ? 'Saving...' : 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.foundation,
  },
  imageCard: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.glass1,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.glass1,
    padding: 12,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
  },
  secondary: {
    fontSize: 14,
    fontWeight: '500',
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  errorText: {
    alignSelf: 'center',
    color: Theme.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.glass1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
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
