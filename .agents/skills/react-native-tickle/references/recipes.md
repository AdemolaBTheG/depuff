# React Native Tickle Recipes

## Root Provider

```tsx
import { HapticProvider } from '@renegades/react-native-tickle';

export function App() {
  return <HapticProvider>{/* app */}</HapticProvider>;
}
```

## Transient Pattern

```ts
import { startHaptic } from '@renegades/react-native-tickle';

startHaptic(
  [
    {
      type: 'transient',
      relativeTime: 0,
      parameters: [
        { type: 'intensity', value: 1 },
        { type: 'sharpness', value: 0.5 },
      ],
    },
  ],
  []
);
```

## Continuous Pattern with Curves

```ts
import { startHaptic } from '@renegades/react-native-tickle';

startHaptic(
  [
    {
      type: 'continuous',
      relativeTime: 0,
      duration: 1200,
      parameters: [
        { type: 'intensity', value: 0.2 },
        { type: 'sharpness', value: 0.5 },
      ],
    },
  ],
  [
    {
      type: 'intensity',
      relativeTime: 0,
      controlPoints: [
        { relativeTime: 0, value: 0.2 },
        { relativeTime: 600, value: 1.0 },
        { relativeTime: 1200, value: 0.2 },
      ],
    },
  ]
);
```

## Real-Time Continuous Player

```tsx
import { useContinuousPlayer } from '@renegades/react-native-tickle';

function Example() {
  const { start, update, stop } = useContinuousPlayer('drag-player', 1.0, 0.5);

  // attach to gesture callbacks
  // onBegin -> start()
  // onUpdate -> update(intensity, sharpness)
  // onEnd -> stop()
  return null;
}
```

## Cleanup on Navigation/Unmount

```ts
import { useEffect } from 'react';
import { stopAllHaptics } from '@renegades/react-native-tickle';

export function Screen() {
  useEffect(() => () => stopAllHaptics(), []);
  return null;
}
```

## Global Haptics Toggle

```tsx
import { Switch } from 'react-native';
import { useHapticsEnabled } from '@renegades/react-native-tickle';

export function Settings() {
  const [enabled, setEnabled] = useHapticsEnabled();
  return <Switch value={enabled} onValueChange={setEnabled} />;
}
```

## System Haptics

```ts
import { triggerImpact, triggerNotification, triggerSelection } from '@renegades/react-native-tickle';

triggerImpact('light');
triggerNotification('success');
triggerSelection();
```

## Known Limitation and Fix

- Curves (`intensity` / `sharpness`) apply at pattern level and can attenuate transients that overlap in time.
- If needed, split haptics into two calls:
  - one `startHaptic(continuousEvents, curves)`
  - one `startHaptic(transientEvents, [])`

