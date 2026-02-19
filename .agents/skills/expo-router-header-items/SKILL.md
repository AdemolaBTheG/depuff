---
name: expo-router-header-items
description: Add and configure Expo Router header items with unstable_headerLeftItems and unstable_headerRightItems, including buttons, menus, spacing, and custom elements. Use when you need native header actions, menus, or iOS 26+ shared background and overflow menu behavior.
---

# Expo Router Header Items

## Overview

Use `unstable_headerLeftItems` and `unstable_headerRightItems` to render native header items (buttons, menus, spacing, and custom elements). Prefer these options over `headerLeft` or `headerRight` when you need iOS 26+ shared backgrounds or the system overflow menu.

## iOS 26+ Behavior

Expect right-side items to collapse into a system overflow menu when space is tight. Note that `type: "custom"` items never collapse into the overflow menu.

## Action Items (Buttons or Menus)

Define action items with `type: "button"` or `type: "menu"`.

Common properties:
- `label`: Provide text; hidden when `icon` is set but used for accessibility and overflow labels.
- `labelStyle`: Set `fontFamily`, `fontSize`, `fontWeight`, `color`.
- `icon`: Provide an image or SF Symbol.
- `variant`: Use `plain` (default), `done`, or `prominent` (iOS 26+).
- `tintColor`: Apply a tint color.
- `disabled`: Disable the item.
- `width`: Set a fixed width.
- `hidesSharedBackground`: Hide shared background (iOS 26+).
- `sharesBackground`: Allow shared background (iOS 26+, default true).
- `identifier`: Match items across transitions (iOS 26+).
- `badge`: Provide `{ value, style? }` with `style` supporting `fontFamily`, `fontSize`, `fontWeight`, `color`, `backgroundColor`.
- `accessibilityLabel`: Set an accessibility label.
- `accessibilityHint`: Set an accessibility hint.

Button-only properties:
- `onPress`: Handle presses.
- `selected`: Mark selected state.

Menu-only properties:
- `changesSelectionAsPrimaryAction`: Turn the menu into a selection menu.
- `menu`: Provide a menu definition.

Icon examples:

```tsx
icon: { type: "image", source: require("./path/to/icon.png"), tinted: true }
```

```tsx
icon: { type: "sfSymbol", name: "heart" }
```

## Menu Structure

Define `menu` with `title`, `multiselectable`, `layout`, and `items`.

Menu action item properties:
- `type`: Use `"action"`.
- `label`: Provide menu text.
- `description`: Provide secondary text.
- `icon`: Provide an SF Symbol.
- `onPress`: Handle selection.
- `state`: Use `on`, `off`, or `mixed`.
- `disabled`: Disable the item.
- `destructive`: Style as destructive.
- `hidden`: Hide the item.
- `keepsMenuPresented`: Keep menu open after selection.
- `discoverabilityLabel`: Provide an elaborated title for the iOS discoverability HUD.

Menu submenu properties:
- `type`: Use `"submenu"`.
- `label`: Provide submenu text.
- `icon`: Provide an SF Symbol.
- `inline`: Render inline instead of a nested menu.
- `layout`: Use `default` or `palette`.
- `destructive`: Style as destructive.
- `multiselectable`: Allow multiple selections.
- `items`: Provide nested actions or submenus.

## Spacing Items

Use `type: "spacing"` with `spacing` to add fixed space between items.

## Custom Items

Use `type: "custom"` with `element` to render any React element. Optionally set `hidesSharedBackground` to hide the liquid glass background on iOS 26+.

## Examples

Button item:

```tsx
unstable_headerRightItems: () => [
  {
    type: "button",
    label: "Edit",
    icon: { type: "sfSymbol", name: "pencil" },
    onPress: () => {
      // Do something
    },
  },
]
```

Menu item:

```tsx
unstable_headerRightItems: () => [
  {
    type: "menu",
    label: "Options",
    icon: { type: "sfSymbol", name: "ellipsis" },
    menu: {
      title: "Options",
      items: [
        {
          type: "action",
          label: "Edit",
          icon: { type: "sfSymbol", name: "pencil" },
          onPress: () => {
            // Do something
          },
        },
        {
          type: "submenu",
          label: "More",
          items: [
            {
              type: "action",
              label: "Delete",
              destructive: true,
              onPress: () => {
                // Do something
              },
            },
          ],
        },
      ],
    },
  },
]
```

Spacing + custom:

```tsx
unstable_headerRightItems: () => [
  { type: "button", label: "Edit", onPress: () => {} },
  { type: "spacing", spacing: 10 },
  {
    type: "custom",
    element: <MaterialCommunityIcons name="map" color="gray" size={36} />,
  },
]
```
