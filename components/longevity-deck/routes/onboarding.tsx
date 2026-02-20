import { View, Text, useWindowDimensions, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { PaginationDots } from '../components/pagination-dots';
import { BottomGlow } from '../components/bottom-glow';
import { OnboardingSlideContainer } from '../components/onboarding-slide-container';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Welcome } from '../components/slides/welcome';
import { Essentials } from '../components/slides/essentials';
import { BackedInfo } from '../components/slides/backed-info';
import { Share } from '../components/slides/share';
import { NotMedicalAdvice } from '../components/slides/not-medical-advice';
import { AnimatedIndexContext } from '../lib/animated-index-context';

// longevity-deck-onboarding-animation 🔽

/**
 * Creates an animated Pressable component to enable spring animations on button.
 * Required because Pressable isn't natively animatable - see Reanimated docs:
 * https://docs.swmansion.com/react-native-reanimated/docs/core/createAnimatedComponent
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Color palette for bottom glow gradient, one color per slide.
 * Interpolated via HSV color space for smooth transitions between slides.
 */
const PALETTE = ['#321A48', '#192444', '#1C3F2D', '#44382A', '#391C1D'];

const TOTAL_SLIDES = 5;

const Onboarding = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * Shared values that drive all animations:
   * - scrollOffsetX: Raw pixel offset from scroll (for future use)
   * - activeIndex: Normalized slide index (0-4), computed from scroll position
   */
  const scrollOffsetX = useSharedValue(0);
  const activeIndex = useSharedValue(0);

  /**
   * Handles scroll events and updates shared values on the UI thread.
   * activeIndex calculation: offsetX / width converts pixel position to slide index.
   * This runs at 60fps via scrollEventThrottle={16} for smooth animations.
   */
  const scrollHandler = useAnimatedScrollHandler((event) => {
    const offsetX = event.contentOffset.x;
    scrollOffsetX.set(offsetX);
    activeIndex.set(offsetX / width);
  });

  /**
   * Animates "I understand" button fade-in on the last slide.
   * Interpolation: [beforeLastIndex, lastIndex] → [0, 1] opacity
   * CLAMP prevents opacity > 1 if user scrolls beyond last slide.
   * pointerEvents: "none" prevents taps before button is visible.
   */
  const rButtonStyle = useAnimatedStyle(() => {
    const beforeLastIndex = TOTAL_SLIDES - 2;
    const lastIndex = TOTAL_SLIDES - 1;

    return {
      opacity: interpolate(
        activeIndex.get(),
        [beforeLastIndex, lastIndex],
        [0, 1],
        Extrapolation.CLAMP
      ),
      pointerEvents: activeIndex.get() === lastIndex ? 'auto' : 'none',
    };
  }, [width]);

  const handleContinue = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(onboarding)/goal');
  };

  const handleSkip = () => {
    void Haptics.selectionAsync();
    router.replace('/(onboarding)/goal');
  };

  return (
    <AnimatedIndexContext value={{ activeIndex }}>
      <View className="flex-1 bg-[#161522]" style={{ paddingBottom: insets.bottom + 8 }}>
        <BottomGlow palette={PALETTE} width={width} height={height} activeIndex={activeIndex} />

        {/* scrollEventThrottle={16} ensures scroll events fire at ~60fps (1000ms/16ms).
            Critical for smooth animation - lower values = more events = smoother motion. */}
        <Animated.ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 40 }}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
        >
          <OnboardingSlideContainer
            title={'Welcome to your\nLongevity Deck'}
            description="Your personal guide to evidence-based health and longevity protocols. Swipe cards into your own deck and track what you do, learn from it, and share with others. Privately."
          >
            <Welcome />
          </OnboardingSlideContainer>
          <OnboardingSlideContainer
            title={"Cut through the noise.\nEssentials only!"}
            description="Each protocol is a beautiful card. See benefits, risks, and best practices baked in. Keep only what fits your goals. Filter, search, learn and discover new things!"
          >
            <Essentials />
          </OnboardingSlideContainer>
          <OnboardingSlideContainer
            title={"Up to date expert\nbacked info"}
            description="We pull fresh insights from top podcasts and scientific publications. Then update every card with sources, and alert you when anything changes. Never miss a beat!"
          >
            <BackedInfo />
          </OnboardingSlideContainer>
          <OnboardingSlideContainer
            title={"Share with friends\n& compare"}
            description="Publish your stack as one link, let friends copy it in a tap, and see public adoption and weekly-use stats. You can also share a specific protocol you do on social media!"
          >
            <Share />
          </OnboardingSlideContainer>
          <OnboardingSlideContainer
            title={"This app is not\nmedical advice"}
            description="Educational use only. Not a diagnosis/treatment tool. Protocols may not suit you and could interact with meds or conditions. Do you research and consult a licensed clinician before starting or changing anything. Seek immediate care for symptoms or emergencies. Tap 'I understand' to acknowledge."
          >
            <NotMedicalAdvice />
          </OnboardingSlideContainer>
        </Animated.ScrollView>

        <View className="gap-5 px-5 pt-5">
          <PaginationDots numberOfDots={TOTAL_SLIDES} activeIndex={activeIndex} />
          {currentIndex < TOTAL_SLIDES - 1 ? (
            <Pressable
              className="self-center px-3 py-1"
              onPress={handleSkip}
              hitSlop={8}>
              <Text className="text-zinc-300 text-base">Skip</Text>
            </Pressable>
          ) : null}
          <AnimatedPressable
            className="h-[50px] rounded-full bg-white justify-center items-center"
            style={[rButtonStyle, styles.borderCurve]}
            onPress={handleContinue}
          >
            <Text className="text-black text-lg font-medium">I understand</Text>
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedIndexContext>
  );
};

const styles = StyleSheet.create({
  borderCurve: {
    borderCurve: 'continuous',
  },
});

export default Onboarding;

// longevity-deck-onboarding-animation 🔼
