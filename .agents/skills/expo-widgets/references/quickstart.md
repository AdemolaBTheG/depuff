# Expo Widgets Quickstart

## Install

```bash
npx expo install expo-widgets
```

If this is an existing React Native app, install Expo first.

## App Config Plugin Template

```json
{
  "expo": {
    "plugins": [
      [
        "expo-widgets",
        {
          "bundleIdentifier": "com.example.myapp.widgets",
          "groupIdentifier": "group.com.example.myapp",
          "enablePushNotifications": false,
          "widgets": [
            {
              "name": "StatusWidget",
              "displayName": "Status",
              "description": "Shows status at a glance",
              "supportedFamilies": ["systemSmall", "systemMedium"]
            }
          ]
        }
      ]
    ]
  }
}
```

## Supported Families

- `systemSmall`
- `systemMedium`
- `systemLarge`
- `systemExtraLarge` (iPad)
- `accessoryCircular`
- `accessoryRectangular`
- `accessoryInline`

## Widget Snapshot Template

```tsx
import { Text, VStack } from '@expo/ui/swift-ui';
import { updateWidgetSnapshot, WidgetBase } from 'expo-widgets';

type Props = { count: number };

const CounterWidget = (props: WidgetBase<Props>) => (
  <VStack>
    <Text>Count: {props.count}</Text>
  </VStack>
);

updateWidgetSnapshot('StatusWidget', CounterWidget, { count: 5 });
```

## Widget Timeline Template

```tsx
import { Text } from '@expo/ui/swift-ui';
import { updateWidgetTimeline, WidgetBase } from 'expo-widgets';

const TimelineWidget = (props: WidgetBase) => <Text>{props.date.toLocaleTimeString()}</Text>;

const dates = [
  new Date(),
  new Date(Date.now() + 60 * 60 * 1000),
  new Date(Date.now() + 2 * 60 * 60 * 1000),
];

updateWidgetTimeline('StatusWidget', dates, TimelineWidget);
```

## Live Activity Template

```tsx
import { Text, VStack } from '@expo/ui/swift-ui';
import { LiveActivityComponent, startLiveActivity, updateLiveActivity } from 'expo-widgets';

const DeliveryActivity: LiveActivityComponent = () => ({
  banner: (
    <VStack>
      <Text>Delivery in 15 min</Text>
    </VStack>
  ),
  compactLeading: <Text>ETA</Text>,
  compactTrailing: <Text>15m</Text>,
  minimal: <Text>15m</Text>,
});

const id = startLiveActivity('DeliveryActivity', DeliveryActivity);

const UpdatedDeliveryActivity: LiveActivityComponent = () => ({
  banner: (
    <VStack>
      <Text>Delivery in 2 min</Text>
    </VStack>
  ),
  compactTrailing: <Text>2m</Text>,
});

updateLiveActivity(id, 'DeliveryActivity', UpdatedDeliveryActivity);
```

## API Surface (Common)

- `startLiveActivity(name, liveActivity, url?) => string`
- `updateLiveActivity(id, name, liveActivity) => void`
- `updateWidgetSnapshot(name, widget, props?, updateFunction?) => void`
- `updateWidgetTimeline(name, dates, widget, props?, updateFunction?) => void`
- `addUserInteractionListener(listener) => EventSubscription`

## Common Failure Points

- Widget name mismatch between config and update calls.
- Running in Expo Go instead of development build.
- Missing/incorrect `groupIdentifier` entitlement.
- Expecting Android behavior (library is for iOS widget features).
- Forgetting to rebuild after plugin config changes.

