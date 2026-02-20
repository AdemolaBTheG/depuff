import { PropsWithChildren } from "react";
import { View, Text, useWindowDimensions } from "react-native";

// longevity-deck-onboarding-animation 🔽

type Props = {
  title: string;
  description: string;
};

export const OnboardingSlideContainer: React.FC<PropsWithChildren<Props>> = ({
  title,
  description,
  children,
}) => {
  const { width } = useWindowDimensions();

  return (
    <View style={{ width }} className="h-full">
      <View className="w-full h-1/2">{children}</View>
      <View className="w-full h-1/2 items-center justify-center px-5">
        <Text className="text-zinc-50 text-3xl text-center">{title}</Text>
        <Text className="text-zinc-300 text-lg mt-5 text-center">{description}</Text>
      </View>
    </View>
  );
};

// longevity-deck-onboarding-animation 🔼
