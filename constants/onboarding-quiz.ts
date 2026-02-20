import type { QuizScreenConfig } from '@/components/onboarding/quiz-screen';

export const ONBOARDING_QUIZ_CONFIG = {
  goal: {
    questionId: 'primary_goal',
    title: 'onboarding.quiz.goal.title',
    subtitle: 'onboarding.quiz.goal.subtitle',
    step: 0,
    ctaLabel: 'common.continue',
    nextRoute: '/(onboarding)/frequency',
    options: [
      { id: 'reduce_morning_puffiness', label: 'onboarding.quiz.goal.options.reduceMorningPuffiness', icon: 'sun.max' },
      { id: 'reduce_water_retention', label: 'onboarding.quiz.goal.options.reduceWaterRetention', icon: 'drop' },
      { id: 'build_daily_routine', label: 'onboarding.quiz.goal.options.buildDailyRoutine', icon: 'checkmark.circle' },
      { id: 'track_sodium_triggers', label: 'onboarding.quiz.goal.options.trackSodiumTriggers', icon: 'fork.knife' },
    ],
  },
  frequency: {
    questionId: 'puffiness_frequency',
    title: 'onboarding.quiz.frequency.title',
    subtitle: 'onboarding.quiz.frequency.subtitle',
    step: 1,
    ctaLabel: 'common.continue',
    nextRoute: '/(onboarding)/trigger',
    options: [
      { id: 'rarely', label: 'onboarding.quiz.frequency.options.rarely', icon: 'leaf' },
      { id: 'one_to_two', label: 'onboarding.quiz.frequency.options.oneToTwo', icon: 'calendar' },
      { id: 'three_to_five', label: 'onboarding.quiz.frequency.options.threeToFive', icon: 'calendar.badge.clock' },
      { id: 'daily', label: 'onboarding.quiz.frequency.options.daily', icon: 'calendar.badge.exclamationmark' },
    ],
  },
  trigger: {
    questionId: 'suspected_trigger',
    title: 'onboarding.quiz.trigger.title',
    subtitle: 'onboarding.quiz.trigger.subtitle',
    step: 2,
    ctaLabel: 'common.continue',
    nextRoute: '/(onboarding)/hydration-goal',
    options: [
      { id: 'salty_food', label: 'onboarding.quiz.trigger.options.saltyFood', icon: 'fork.knife.circle' },
      { id: 'poor_sleep', label: 'onboarding.quiz.trigger.options.poorSleep', icon: 'bed.double' },
      { id: 'alcohol', label: 'onboarding.quiz.trigger.options.alcohol', icon: 'wineglass' },
      { id: 'not_sure', label: 'onboarding.quiz.trigger.options.notSure', icon: 'questionmark.circle' },
    ],
  },
  commitment: {
    questionId: 'commitment_level',
    title: 'onboarding.quiz.commitment.title',
    subtitle: 'onboarding.quiz.commitment.subtitle',
    step: 5,
    ctaLabel: 'common.continue',
    nextRoute: '/(onboarding)/demo-scan',
    options: [
      { id: 'light', label: 'onboarding.quiz.commitment.options.light', icon: 'hare' },
      { id: 'standard', label: 'onboarding.quiz.commitment.options.standard', icon: 'figure.walk' },
      { id: 'focused', label: 'onboarding.quiz.commitment.options.focused', icon: 'bolt.heart' },
    ],
  },
} satisfies Record<string, QuizScreenConfig>;
