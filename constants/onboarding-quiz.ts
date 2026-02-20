import type { QuizScreenConfig } from '@/components/onboarding/quiz-screen';

export const ONBOARDING_QUIZ_CONFIG = {
  goal: {
    questionId: 'primary_goal',
    title: 'What is your main goal?',
    subtitle: 'We will tune your plan around this first.',
    step: 0,
    ctaLabel: 'Continue',
    nextRoute: '/(onboarding)/frequency',
    options: [
      { id: 'reduce_morning_puffiness', label: 'Reduce morning puffiness', icon: 'sun.max' },
      { id: 'reduce_water_retention', label: 'Reduce water retention', icon: 'drop' },
      { id: 'build_daily_routine', label: 'Build a daily routine', icon: 'checkmark.circle' },
      { id: 'track_sodium_triggers', label: 'Track sodium triggers', icon: 'fork.knife' },
    ],
  },
  frequency: {
    questionId: 'puffiness_frequency',
    title: 'How often do you wake up puffy?',
    subtitle: 'This helps us calibrate your baseline.',
    step: 1,
    ctaLabel: 'Continue',
    nextRoute: '/(onboarding)/trigger',
    options: [
      { id: 'rarely', label: 'Rarely', icon: 'leaf' },
      { id: 'one_to_two', label: '1-2 days per week', icon: 'calendar' },
      { id: 'three_to_five', label: '3-5 days per week', icon: 'calendar.badge.clock' },
      { id: 'daily', label: 'Almost daily', icon: 'calendar.badge.exclamationmark' },
    ],
  },
  trigger: {
    questionId: 'suspected_trigger',
    title: 'Which trigger fits best?',
    subtitle: 'Pick what most likely causes your bloat.',
    step: 2,
    ctaLabel: 'Continue',
    nextRoute: '/(onboarding)/hydration-goal',
    options: [
      { id: 'salty_food', label: 'Salty food', icon: 'fork.knife.circle' },
      { id: 'poor_sleep', label: 'Poor sleep', icon: 'bed.double' },
      { id: 'alcohol', label: 'Alcohol', icon: 'wineglass' },
      { id: 'not_sure', label: "I'm not sure yet", icon: 'questionmark.circle' },
    ],
  },
  commitment: {
    questionId: 'commitment_level',
    title: 'How intense should your daily plan be?',
    subtitle: 'Choose your effort level.',
    step: 5,
    ctaLabel: 'Finish',
    nextRoute: '/(paywalls)/onboardingPaywall',
    shouldCompleteOnContinue: true,
    options: [
      { id: 'light', label: 'Light (2 min/day)', icon: 'hare' },
      { id: 'standard', label: 'Standard (5 min/day)', icon: 'figure.walk' },
      { id: 'focused', label: 'Focused (10 min/day)', icon: 'bolt.heart' },
    ],
  },
} satisfies Record<string, QuizScreenConfig>;
