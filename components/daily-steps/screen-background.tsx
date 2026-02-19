import { StyleSheet, View } from "react-native";
import { useWindowDimensions } from "react-native";
import { Blur, Canvas, RoundedRect } from "@shopify/react-native-skia";

export const ScreenBackground = () => {
  const { width, height } = useWindowDimensions();

  const topOvalWidth = width * 1.4;
  const topOvalHeight = height * 0.5;
  const topOvalX = (width - topOvalWidth) / 2;
  const topOvalY = -height * 0.1;

  const middleOvalWidth = width;
  const middleOvalHeight = height;
  const middleOvalX = 0;
  const middleOvalY = height * 0.25;

  const bottomOvalWidth = width * 1.3;
  const bottomOvalHeight = height * 0.6;
  const bottomOvalX = (width - bottomOvalWidth) / 2;
  const bottomOvalY = height * 0.75;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Top oval: Dark purplish-blue color for gradient start */}
        <RoundedRect
          x={topOvalX}
          y={topOvalY}
          width={topOvalWidth}
          height={topOvalHeight}
          r={topOvalHeight / 2}
          color="#0B0B0B"
        >
          <Blur blur={50} />
        </RoundedRect>

        {/* Middle oval: Transition color between dark and bright blue */}
        <RoundedRect
          x={middleOvalX}
          y={middleOvalY}
          width={middleOvalWidth}
          height={middleOvalHeight}
          r={middleOvalHeight / 2}
          color="#2D1EED"
        >
          <Blur blur={80} />
        </RoundedRect>

        {/* Bottom oval: Vibrant royal blue for gradient end */}
        <RoundedRect
          x={bottomOvalX}
          y={bottomOvalY}
          width={bottomOvalWidth}
          height={bottomOvalHeight}
          r={bottomOvalHeight / 2}
          color="#4E6CDC"
        >
          <Blur blur={100} />
        </RoundedRect>
      </Canvas>
    </View>
  );
};
