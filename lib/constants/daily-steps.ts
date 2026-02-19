export const SPRING_CONFIG = {
  damping: 20,
  mass: 0.9,
  stiffness: 260,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

export const SPRING_CONFIG_WITH_OVERSHOOT = {
  damping: 16,
  mass: 0.9,
  stiffness: 250,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;
