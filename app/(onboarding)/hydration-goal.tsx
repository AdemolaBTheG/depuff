import GoalWheelScreenView from '@/components/onboarding/goal-wheel-screen';
import { useSettingsStore } from '@/stores/settingsStore';

const TOTAL_STEPS = 6;

export default function OnboardingHydrationGoalScreen() {
  const { waterGoalMl, setWaterGoalMl } = useSettingsStore();

  return (
    <GoalWheelScreenView
      config={{
        questionId: 'water_goal_ml',
        title: 'Set your daily hydration goal',
        subtitle: 'We use this target in Home and Progress.',
        unit: 'ml per day',
        minimum: 1200,
        maximum: 5000,
        step: 100,
        stepIndex: 3,
        totalSteps: TOTAL_STEPS,
        ctaLabel: 'Continue',
        nextRoute: '/(onboarding)/sodium-goal',
        defaultValue: waterGoalMl,
        onSave: setWaterGoalMl,
      }}
    />
  );
}
