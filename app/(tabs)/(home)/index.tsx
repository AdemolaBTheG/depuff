import { Spacing, SurfaceStyles, Theme, Typography } from '@/constants/Theme'
import React from 'react'
import { ScrollView, Text, View } from 'react-native'

export default function Index() {
    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={SurfaceStyles.screen}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
        >
            <View style={SurfaceStyles.card}>
                <Text selectable style={Typography.primary}>Foundation Layer</Text>
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Main screen uses pure black with glass overlays.
                </Text>
            </View>

            <View style={SurfaceStyles.cardHighlighted}>
                <Text selectable style={Typography.primary}>Accent System</Text>
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Active states use Cyan accent.
                </Text>

                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
                    <View style={{ backgroundColor: Theme.colors.accent, height: 8, flex: 1, borderRadius: 99 }} />
                    <View style={{ backgroundColor: Theme.colors.warning, height: 8, flex: 1, borderRadius: 99 }} />
                    <View style={{ backgroundColor: Theme.colors.danger, height: 8, flex: 1, borderRadius: 99 }} />
                </View>
            </View>

            <View style={SurfaceStyles.card}>
                <Text selectable style={Typography.primary}>Text Hierarchy</Text>
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Secondary text uses 60% white opacity.
                </Text>
                <Text selectable style={[Typography.tertiary, { marginTop: Spacing.xs }]}>
                    Tertiary text uses 30% white opacity.
                </Text>
            </View>
        </ScrollView>
    )
}
