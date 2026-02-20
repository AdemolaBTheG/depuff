// app.config.js — extends app.json with runtime extras for PostHog
// PostHog keys are read from environment variables (.env) at build time.
// Access in app code via: Constants.expoConfig?.extra?.posthogApiKey

const baseConfig = require('./app.json');

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    extra: {
      ...baseConfig.expo.extra,
      posthogApiKey: process.env.POSTHOG_API_KEY,
      posthogHost: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
    },
  },
};
