---
name: react-native-tickle
description: Implement iOS Core Haptics in Expo/React Native apps using @renegades/react-native-tickle with Nitro Modules. Use when tasks involve transient taps, continuous haptic patterns with curves, real-time gesture-driven haptics, global haptic enable/disable settings, or haptic lifecycle cleanup on navigation.
version: 1.0.0
license: MIT
---

# React Native Tickle

## References

- `./references/recipes.md` -- install, setup, API patterns, and limitations

## Core Constraints

- iOS only (Core Haptics). Do not plan Android parity in this skill.
- Prefer development builds when native module changes are involved.
- Wrap app in `HapticProvider` unless manually managing engine lifecycle.
- Stop active haptics on unmount/navigation to avoid stuck playback.

## Setup Workflow

1. Install packages:

```bash
npm i @renegades/react-native-tickle react-native-nitro-modules
```

2. Initialize engine at app root:
   - Use `HapticProvider` around app content.
   - Use manual `initializeEngine()` / `destroyEngine()` only for custom lifecycle control.

3. Pick the right API for the use case:
   - `startHaptic(events, curves)` for predefined transient/continuous patterns.
   - `useContinuousPlayer(...)` for real-time gesture/data driven updates.
   - `triggerImpact`, `triggerNotification`, `triggerSelection` for OS predefined haptics.

4. Add cleanup:
   - Call `stopAllHaptics()` in screen cleanup or navigation `beforeRemove`.

5. Add user preference control:
   - Use `useHapticsEnabled()` for persisted global on/off toggle.

## Pattern Selection Rules

- Use transient events for point-in-time clicks.
- Use continuous events with curves for known timelines.
- Use continuous player for unpredictable updates (gestures, scroll velocity, sensors).

## Critical Limitation

`HapticCurve` values are pattern-level multipliers. Curves can reduce transients that occur during the same pattern window.

Workaround:
- Play continuous pattern with curves in one `startHaptic()` call.
- Play transient taps in a separate `startHaptic()` call.

## Verification Checklist

- Haptics play only on iOS and fail gracefully elsewhere.
- Engine initializes once at app root and is cleaned correctly.
- No lingering playback after route changes.
- Real-time player starts/updates/stops without leaks.
- Global haptics toggle persists across app restarts.

