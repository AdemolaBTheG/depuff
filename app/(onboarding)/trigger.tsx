import QuizScreenView from '@/components/onboarding/quiz-screen';
import { ONBOARDING_QUIZ_CONFIG } from '@/constants/onboarding-quiz';

export default function OnboardingTriggerScreen() {
  return <QuizScreenView config={ONBOARDING_QUIZ_CONFIG.trigger} />;
}
