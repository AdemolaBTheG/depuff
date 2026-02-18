import type { TextStyle, ViewStyle } from 'react-native';

export const Theme = {
    colors: {
        foundation: '#000000',
        glass1: 'rgba(255, 255, 255, 0.05)',
        glass2: 'rgba(255, 255, 255, 0.10)',
        border: 'rgba(255, 255, 255, 0.12)',
        accent: '#22d3ee',
        warning: '#fbbf24',
        danger: '#ea580c',
        textPrimary: '#ffffff',
        textSecondary: 'rgba(255, 255, 255, 0.60)',
        textTertiary: 'rgba(255, 255, 255, 0.30)',
    },
    classes: {
        foundation: 'bg-black',
        glass1: 'bg-white/5',
        glass2: 'bg-white/10',
        border: 'border-white/10',
        accent: 'bg-cyan-400',
        warning: 'bg-amber-400',
        danger: 'bg-orange-600',
        textPrimary: 'text-white',
        textSecondary: 'text-white/60',
        textTertiary: 'text-white/30',
    },
} as const;

export const Colors = {
    primary: Theme.colors.accent,
    background: Theme.colors.foundation,
    text: Theme.colors.textPrimary,
    secondary: Theme.colors.textSecondary,
    success: Theme.colors.accent,
    error: Theme.colors.danger,
    warning: Theme.colors.warning,
    gray: Theme.colors.textTertiary,
    lightGray: Theme.colors.glass1,
    darkGray: Theme.colors.glass2,
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
};

export const SurfaceStyles: Record<string, ViewStyle> = {
    screen: {
        flex: 1,
        backgroundColor: Theme.colors.foundation,
    },
    card: {
        backgroundColor: Theme.colors.glass1,
        borderColor: Theme.colors.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: Spacing.md,
    },
    cardHighlighted: {
        backgroundColor: Theme.colors.glass2,
        borderColor: Theme.colors.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: Spacing.md,
    },
};

export const Typography: Record<string, TextStyle> = {
    primary: {
        color: Theme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '700',
    },
    secondary: {
        color: Theme.colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    tertiary: {
        color: Theme.colors.textTertiary,
        fontSize: 12,
        fontWeight: '500',
    },
};
