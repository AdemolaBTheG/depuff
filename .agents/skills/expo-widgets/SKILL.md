---
name: expo-widgets
description: Build iOS home screen widgets and Live Activities in Expo apps using expo-widgets and @expo/ui/swift-ui. Use when the task mentions widgets, Live Activities, Dynamic Island, widget timelines, app group/widget extension configuration, or updating widget/live activity UI from JavaScript.
---

## References

- `./references/quickstart.md` -- install, config plugin options, and code templates

## Core Constraints

- Treat `expo-widgets` as alpha; expect breaking changes.
- Use development builds. Expo Go does not support this library.
- Target iOS only for widget/Live Activity behavior.
- Ensure widget names used in code exactly match config plugin `widgets[].name`.

## Implementation Workflow

1. Install dependencies:

```bash
npx expo install expo-widgets
```

2. Configure plugin in app config (`app.json`/`app.config.*`) with at least one widget entry:
   - Set `widgets[].name`, `displayName`, `description`, and `supportedFamilies`.
   - Keep `groupIdentifier` consistent between app and widget extension.
   - Enable `enablePushNotifications` only when push-updated Live Activities are required.

3. Regenerate native projects when config changes:

```bash
npx expo prebuild
```

4. Build and run an iOS development build (not Expo Go), then test on device/simulator.

5. Implement widget rendering with `@expo/ui/swift-ui` components and update data with:
   - `updateWidgetSnapshot` for immediate single-entry updates
   - `updateWidgetTimeline` for scheduled timeline entries

6. Implement Live Activities with:
   - `startLiveActivity` to create and get `activityId`
   - `updateLiveActivity` to refresh state by `activityId`

7. Add interaction handling when needed:
   - `addUserInteractionListener` for widget action events.

## Verification Checklist

- `expo-doctor` passes after dependency/config changes.
- Plugin config contains valid widget families.
- App group and bundle identifiers resolve to valid entitlements.
- Widget appears in iOS widget gallery with expected name/description.
- Snapshot/timeline updates render correctly across declared families.
- Live Activity renders banner + Dynamic Island variants and updates with new data.

