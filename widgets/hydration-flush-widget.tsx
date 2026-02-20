import { HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  lineLimit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { WidgetBase } from 'expo-widgets';

export const HYDRATION_WIDGET_NAME = 'HydrationFlushWidget';

export type HydrationWidgetProps = {
  intakeMl: number;
  goalMl: number;
  progress: number;
  remainingMl: number;
};

let isHydrationWidgetRegistered = false;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function HydrationFlushWidget(props: WidgetBase<HydrationWidgetProps>) {
  'widget';

  const intakeMl = Math.max(0, Math.round(props.intakeMl ?? 0));
  const goalMl = Math.max(1, Math.round(props.goalMl ?? 2500));
  const progress = clamp01(props.progress ?? intakeMl / goalMl);
  const progressPercent = Math.round(progress * 100);
  const remainingMl = Math.max(0, Math.round(props.remainingMl ?? goalMl - intakeMl));
  const subtitle = remainingMl > 0 ? `${remainingMl.toLocaleString()} ml left` : 'Goal reached';

  return (
    <VStack spacing={8} modifiers={[padding({ all: 14 })]}>
      <HStack alignment="center">
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
          ]}
        >
          Hydration
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
          ]}
        >
          {progressPercent.toString()}%
        </Text>
      </HStack>

      <Text modifiers={[font({ size: 30, weight: 'bold', design: 'rounded' }), lineLimit(1)]}>
        {intakeMl.toLocaleString()} ml
      </Text>

      <ProgressView value={progress} />

      <HStack alignment="center" spacing={8}>
        <Text
          modifiers={[
            font({ size: 11, weight: 'regular' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
          ]}
        >
          Goal {goalMl.toLocaleString()} ml
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            lineLimit(1),
            multilineTextAlignment('trailing'),
          ]}
        >
          {subtitle}
        </Text>
      </HStack>
    </VStack>
  );
}

export async function registerHydrationWidgetLayout(): Promise<void> {
  if (isHydrationWidgetRegistered) return;
  const { registerWidgetLayout } = await import('expo-widgets');
  registerWidgetLayout(HYDRATION_WIDGET_NAME, HydrationFlushWidget);
  isHydrationWidgetRegistered = true;
}
