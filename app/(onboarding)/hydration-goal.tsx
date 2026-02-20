import GoalWheelScreenView from '@/components/onboarding/goal-wheel-screen';
import { useSettingsStore } from '@/stores/settingsStore';

const TOTAL_STEPS = 10;

export default function OnboardingHydrationGoalScreen() {
  const { waterGoalMl, setWaterGoalMl } = useSettingsStore();

  return (
    <GoalWheelScreenView
      config={{
        questionId: 'water_goal_ml',
        title: 'onboarding.goals.hydration.title',
        subtitle: 'onboarding.goals.hydration.subtitle',
        unit: 'onboarding.goals.hydration.unit',
        minimum: 1200,
        maximum: 5000,
        step: 100,
        stepIndex: 3,
        totalSteps: TOTAL_STEPS,
        ctaLabel: 'common.continue',
        nextRoute: '/(onboarding)/sodium-goal',
        defaultValue: waterGoalMl,
        onSave: setWaterGoalMl,
      }}
    />
  );
}
