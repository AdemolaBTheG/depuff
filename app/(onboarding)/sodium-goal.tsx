import GoalWheelScreenView from '@/components/onboarding/goal-wheel-screen';
import { useSettingsStore } from '@/stores/settingsStore';

const TOTAL_STEPS = 10;

export default function OnboardingSodiumGoalScreen() {
  const { sodiumGoalMg, setSodiumGoalMg } = useSettingsStore();

  return (
    <GoalWheelScreenView
      config={{
        questionId: 'sodium_goal_mg',
        title: 'onboarding.goals.sodium.title',
        subtitle: 'onboarding.goals.sodium.subtitle',
        unit: 'onboarding.goals.sodium.unit',
        minimum: 1200,
        maximum: 4000,
        step: 50,
        stepIndex: 4,
        totalSteps: TOTAL_STEPS,
        ctaLabel: 'common.continue',
        nextRoute: '/(onboarding)/commitment',
        defaultValue: sodiumGoalMg,
        onSave: setSodiumGoalMg,
      }}
    />
  );
}
