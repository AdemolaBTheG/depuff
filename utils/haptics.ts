import {
  startHaptic,
  stopAllHaptics,
  triggerImpact,
  triggerNotification,
  triggerSelection,
} from '@renegades/react-native-tickle';
import { Platform } from 'react-native';

function runIfSupported(action: () => void): void {
  if (Platform.OS !== 'ios') return;
  try {
    action();
  } catch {
    // Avoid crashing UI if haptics engine is unavailable in current runtime.
  }
}

export function hapticSelection(): void {
  runIfSupported(() => triggerSelection());
}

export function hapticImpact(style: 'rigid' | 'heavy' | 'medium' | 'light' | 'soft'): void {
  runIfSupported(() => triggerImpact(style));
}

export function hapticSuccess(): void {
  runIfSupported(() => triggerNotification('success'));
}

export function hapticWarning(): void {
  runIfSupported(() => triggerNotification('warning'));
}

export function hapticError(): void {
  runIfSupported(() => triggerNotification('error'));
}

export function stopAllAppHaptics(): void {
  runIfSupported(() => stopAllHaptics());
}

export function startAnalyzingHaptic(): void {
  runIfSupported(() =>
    startHaptic(
      [
        {
          type: 'continuous',
          relativeTime: 0,
          duration: 12000,
          parameters: [
            { type: 'intensity', value: 0.18 },
            { type: 'sharpness', value: 0.25 },
          ],
        },
      ],
      [
        {
          type: 'intensity',
          relativeTime: 0,
          controlPoints: [
            { relativeTime: 0, value: 0.12 },
            { relativeTime: 900, value: 0.3 },
            { relativeTime: 1800, value: 0.12 },
            { relativeTime: 2700, value: 0.3 },
            { relativeTime: 3600, value: 0.12 },
          ],
        },
      ]
    )
  );
}

export function stopAnalyzingHaptic(): void {
  runIfSupported(() => stopAllHaptics());
}
