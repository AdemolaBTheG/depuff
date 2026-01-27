declare namespace NodeJS {
    interface ProcessEnv {
        EXPO_PUBLIC_SUPABASE_URL: string;
        EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
        EXPO_PUBLIC_RC_APPLE_API_KEY: string;
        EXPO_PUBLIC_ONESIGNAL_APP_ID: string;
        EXPO_PUBLIC_POSTHOG_API_KEY: string;
        EXPO_PUBLIC_POSTHOG_HOST: string;
    }
}
