import { StyleSheet, View } from "react-native";
import { interpolateColor, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { Blur, Canvas, RoundedRect } from "@shopify/react-native-skia";

// longevity-deck-onboarding-animation 🔽

type GradientLayerProps = {
  palette: string[];
  width: number;
  height: number;
  activeIndex: SharedValue<number>;
};

/**
 * Animated bottom glow that transitions colors based on active slide.
 * Creates a blurred oval shape positioned at 84% screen height.
 * Dimensions: 120% screen width (extends beyond edges) × 30% screen height (min 160px).
 */
export const BottomGlow: React.FC<GradientLayerProps> = ({
  palette,
  width,
  height,
  activeIndex,
}) => {
  "use no memo";
  /**
   * Oval dimensions create a wide, low glow effect.
   * width * 1.2: Extends 20% beyond screen edges for seamless coverage.
   * Math.max(160, height * 0.3): Ensures minimum 160px height on small screens.
   */
  const ovalWidth = width * 1.2;
  const ovalHeight = Math.max(160, height * 0.3);
  const ovalX = (width - ovalWidth) / 2;
  const ovalY = height * 0.84;

  /**
   * Interpolates color through HSV color space for smooth transitions.
   * HSV prevents muddy colors when transitioning between distant palette colors.
   * Input range: [0, 1, 2, 3, 4] (slide indices) → Output: palette colors.
   */
  const fillColor = useDerivedValue(() => {
    const inputs = palette.map((_, index) => index);
    const color = interpolateColor(activeIndex.get(), inputs, palette, "HSV");
    return color;
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* r={ovalHeight / 2} creates a perfect oval (radius = half height).
            Blur blur={60} provides strong glow effect - higher values = more diffusion. */}
        <RoundedRect
          x={ovalX}
          y={ovalY}
          width={ovalWidth}
          height={ovalHeight}
          r={ovalHeight / 2}
          color={fillColor}
        >
          <Blur blur={60} />
        </RoundedRect>
      </Canvas>
    </View>
  );
};

// longevity-deck-onboarding-animation 🔼
