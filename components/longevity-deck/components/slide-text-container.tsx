import { cn } from '@/components/cn';
import { BlurView } from "expo-blur";
import React, { FC, PropsWithChildren } from "react";
import { Text, ViewProps, StyleSheet, Platform } from "react-native";
import Animated, { AnimatedProps } from "react-native-reanimated";

// longevity-deck-onboarding-animation 🔽

interface Props extends AnimatedProps<ViewProps> {
  className?: string;
  textClassName?: string;
}

/**
 * Platform-optimized text container with blur effects.
 * iOS: Uses native BlurView for performance-optimized glassmorphism effect.
 * Android: Falls back to semi-transparent background + border (BlurView has performance issues).
 * borderCurve: "continuous" enables iOS-style rounded corners for modern look.
 */
export const SlideTextContainer: FC<PropsWithChildren<Props>> = ({
  children,
  className,
  textClassName,
  style,
  ...props
}) => {
  return (
    <Animated.View
      style={[styles.borderCurve, style]}
      className={cn(
        "p-4 rounded-full overflow-hidden",
        Platform.OS === "android" && "bg-[#161522]/80 border border-neutral-600/30",
        className
      )}
      {...props}
    >
      {Platform.OS === "ios" && <BlurView tint="dark" style={StyleSheet.absoluteFill} />}
      <Text className={cn("text-base font-medium text-white", textClassName)}>{children}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  borderCurve: {
    borderCurve: "continuous",
  },
});

// longevity-deck-onboarding-animation 🔼
