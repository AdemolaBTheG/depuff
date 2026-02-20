<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Depuff Expo (React Native) project. Here is a summary of every change made:

- **`app.config.js`** — Created to extend `app.json` at build time, injecting `posthogApiKey` and `posthogHost` from environment variables into `Constants.expoConfig.extra`. This keeps credentials out of source code.
- **`.env`** — Created with `POSTHOG_API_KEY` and `POSTHOG_HOST` set to the project values. The file is gitignored.
- **`src/config/posthog.ts`** — Created a singleton PostHog client instance configured from `expo-constants`. Includes batching, feature flag preloading, retry logic, and a graceful no-op when the API key is absent.
- **`app/_layout.tsx`** — Wrapped the entire app in `<PostHogProvider>` with autocapture (touches enabled, manual screen tracking). Added `usePathname` + `useGlobalSearchParams` screen tracking that fires `posthog.screen()` on every route change via Expo Router.
- **`app/(scan)/index.tsx`** — Added `Scan Analyzed`, `Scan Analysis Failed`, `Scan Capture Error`, and `Camera Permission Requested` events.
- **`app/(scan)/result.tsx`** — Added `Scan Shared` and `Scan Deleted` events.
- **`app/(food)/index.tsx`** — Added `Food Analyzed` and `Food Analysis Failed` events.
- **`app/(food)/result.tsx`** — Added `Food Log Confirmed` and `Food Log Save Failed` events.
- **`components/onboarding/quiz-screen.tsx`** — Added `Onboarding Completed` event (fires alongside the existing `Onboarding Quiz Continued` on the final quiz step). The file already had `Onboarding Quiz Option Selected` and `Onboarding Quiz Continued` events which were preserved.
- **`app/(settings)/index.tsx`** — Added `Settings Goal Updated` events for both the hydration and sodium goal prompts, including `goal_type` and the new value as properties.
- **`app/(paywalls)/onboardingPaywall.tsx`** — Already had `Paywall Viewed` and `Paywall Dismissed` events; left untouched.

All lint warnings were resolved (missing `posthog` in `useCallback` dependency arrays).

---

## Events instrumented

| Event Name | Description | File |
|---|---|---|
| `Scan Analyzed` | Face scan image successfully analyzed by AI | `app/(scan)/index.tsx` |
| `Scan Analysis Failed` | Face scan AI analysis returned an error | `app/(scan)/index.tsx` |
| `Scan Capture Error` | Camera failed to capture the face image | `app/(scan)/index.tsx` |
| `Camera Permission Requested` | User tapped the Grant Camera Access button | `app/(scan)/index.tsx` |
| `Scan Shared` | User shared the scan report as an image | `app/(scan)/result.tsx` |
| `Scan Deleted` | User deleted a persisted scan report | `app/(scan)/result.tsx` |
| `Food Analyzed` | Food image successfully analyzed for sodium & bloat risk | `app/(food)/index.tsx` |
| `Food Analysis Failed` | Food image AI analysis returned an error | `app/(food)/index.tsx` |
| `Food Log Confirmed` | User confirmed and saved a food analysis to their log | `app/(food)/result.tsx` |
| `Food Log Save Failed` | Saving a confirmed food log entry failed | `app/(food)/result.tsx` |
| `Onboarding Completed` | User finished the full onboarding quiz flow | `components/onboarding/quiz-screen.tsx` |
| `Onboarding Quiz Option Selected` | User selected an answer on a quiz screen *(pre-existing)* | `components/onboarding/quiz-screen.tsx` |
| `Onboarding Quiz Continued` | User tapped Continue on a quiz screen *(pre-existing)* | `components/onboarding/quiz-screen.tsx` |
| `Settings Goal Updated` | User saved a new hydration or sodium daily goal | `app/(settings)/index.tsx` |
| `Paywall Viewed` | Paywall screen was shown *(pre-existing)* | `app/(paywalls)/onboardingPaywall.tsx` |
| `Paywall Dismissed` | User dismissed the paywall *(pre-existing)* | `app/(paywalls)/onboardingPaywall.tsx` |

---

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- 📊 **Dashboard — Analytics basics**: https://eu.posthog.com/project/129643/dashboard/534457
- 📈 **Scan success vs failure** (trend): https://eu.posthog.com/project/129643/insights/VPe1mJhZ
- 🥗 **Food logging funnel** (funnel): https://eu.posthog.com/project/129643/insights/Af8wYPMe
- 🧭 **Onboarding completion rate** (trend): https://eu.posthog.com/project/129643/insights/qybLxOIW
- 💳 **Paywall conversion funnel** (funnel): https://eu.posthog.com/project/129643/insights/ExkzZTZq
- 👥 **Daily active users by key actions** (trend): https://eu.posthog.com/project/129643/insights/Rovosvql

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-integration-expo/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
