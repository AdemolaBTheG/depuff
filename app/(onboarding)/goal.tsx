import QuizScreenView from '@/components/onboarding/quiz-screen';
import { ONBOARDING_QUIZ_CONFIG } from '@/constants/onboarding-quiz';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';

export default function OnboardingGoalScreen() {
  const posthog = usePostHog();
  const hasAnsweredFirstQuestion = useOnboardingStore(
    (state) => Boolean(state.quizAnswers.primary_goal)
  );

  useEffect(() => {
    if (hasAnsweredFirstQuestion) return;
    posthog?.capture('Onboarding Started', {
      entry_point: 'quiz_direct',
    });
  }, [hasAnsweredFirstQuestion, posthog]);

  return <QuizScreenView config={ONBOARDING_QUIZ_CONFIG.goal} />;
}
