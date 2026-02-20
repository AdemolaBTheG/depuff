import GoalWheelScreenView from '@/components/onboarding/goal-wheel-screen';
import { useSettingsStore } from '@/stores/settingsStore';

const TOTAL_STEPS = 6;

export default function OnboardingSodiumGoalScreen() {
  const { sodiumGoalMg, setSodiumGoalMg } = useSettingsStore();

  return (
    <GoalWheelScreenView
      config={{
        questionId: 'sodium_goal_mg',
        title: 'Set your sodium limit',
        subtitle: 'Depuff tracks how close each day is to this cap.',
        unit: 'mg per day',
        minimum: 1200,
        maximum: 4000,
        step: 50,
        stepIndex: 4,
        totalSteps: TOTAL_STEPS,
        ctaLabel: 'Continue',
        nextRoute: '/(onboarding)/commitment',
        defaultValue: sodiumGoalMg,
        onSave: setSodiumGoalMg,
      }}
    />
  );
}
