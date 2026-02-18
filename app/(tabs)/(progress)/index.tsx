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
                <Text selectable style={Typography.primary}>Flush Status</Text>
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Neutral card layer with border-white/10 equivalent.
                </Text>
                <Text selectable style={[Typography.tertiary, { marginTop: Spacing.xs }]}>
                    Last updated 2m ago
                </Text>
            </View>

            <View style={SurfaceStyles.cardHighlighted}>
                <Text selectable style={Typography.primary}>Retention Risk</Text>
                <View
                    style={{
                        marginTop: Spacing.sm,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: Theme.colors.warning,
                    }}
                />
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Warning color token: #fbbf24
                </Text>
            </View>

            <View style={SurfaceStyles.cardHighlighted}>
                <Text selectable style={Typography.primary}>High Bloat / Inflame</Text>
                <View
                    style={{
                        marginTop: Spacing.sm,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: Theme.colors.danger,
                    }}
                />
                <Text selectable style={[Typography.secondary, { marginTop: Spacing.xs }]}>
                    Danger color token: #ea580c
                </Text>
            </View>
        </ScrollView>
    )
}
