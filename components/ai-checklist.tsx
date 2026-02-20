import { ActionItem } from '@/db/schema';
import StrikethroughText from '@/strikethrough-text';
import { hapticSelection } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { PlatformColor, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface AIChecklistProps {
  items: ActionItem[];
  onToggleItem: (id: string, currentCompleted: boolean) => void;
}

function normalizeActionText(input: string): string {
  return input
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/([/_\-.,:;!?])/g, '$1\u200B')
    .replace(/([^\s\u200B]{12})(?=[^\s\u200B])/g, '$1\u200B');
}

export function AIChecklist({ items, onToggleItem }: AIChecklistProps) {
  if (!items || items.length === 0) return null;

  return (
    <View  style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={PlatformColor('systemPurple')} />
        <Text style={styles.headerTitle}>Today&apos;s Action Plan</Text>
      </View>

      <View style={styles.listContainer}>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <ChecklistItem 
              item={item}
              onToggle={() => {
                hapticSelection();
                onToggleItem(item.id, item.completed);
              }}
            />
            {index < items.length - 1 ? <View style={styles.separator} /> : null}
                      </React.Fragment>

        ))}
      </View>
    </View>
  );
}

function ChecklistItem({ item, onToggle }: { item: ActionItem; onToggle: () => void }) {
  const progress = useSharedValue(item.completed ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(item.completed ? 1 : 0, { duration: 140 });
  }, [item.completed, progress]);

  const checkmarkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  return (
    <Pressable onPress={onToggle} style={styles.row}>
      <View style={[styles.checkbox, item.completed ? styles.checkboxCompleted : styles.checkboxIdle]}>
        <Animated.View style={checkmarkStyle}>
          <Ionicons name="checkmark" size={14} color="white" />
        </Animated.View>
      </View>

      <View style={styles.itemTextContainer}>
        <StrikethroughText
          isSelected={item.completed}
          animationDuration={220}
          strikethroughColor="bg-slate-400"
          lineBreakStrategyIOS="standard"
          textBreakStrategy="highQuality"
          style={[styles.itemText, item.completed ? styles.itemTextCompleted : styles.itemTextActive]}
        >
          {normalizeActionText(item.text)}
        </StrikethroughText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listContainer: {
    marginHorizontal: 12,
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
 
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxIdle: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(107, 114, 128, 0.55)',
  },
  checkboxCompleted: {
    backgroundColor: 'rgba(52, 199, 89, 1)',
    borderColor: 'rgba(52, 199, 89, 1)',
  },
  itemTextContainer: {
    flex: 1,
    width: 0,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  itemText: {
    flexShrink: 1,
    maxWidth: '100%',
    flexWrap: 'wrap',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
  },
  itemTextActive: {
    color: PlatformColor('label'),
  },
  itemTextCompleted: {
    color: PlatformColor('tertiaryLabel'),
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlatformColor('separator'),
    marginLeft: 52,
  },
});
