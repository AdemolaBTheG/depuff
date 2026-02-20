import { useSubscription } from '@/context/SubscriptionContext';
import { syncHydrationWidgetSnapshot } from '@/services/hydration-widget';
import { useSettingsStore } from '@/stores/settingsStore';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import * as Linking from 'expo-linking';
import { PressableScale } from 'pressto';
import React, { useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  I18nManager,
  Platform,
  PlatformColor,
  SectionList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Since AppText, Colors, useSubscription, RevenueCatUI, Zeego, and other specific contexts
// are either missing or need to be adapted to Depuff's architecture, I've swapped them:
// 1. Used standard React Native `Text` components with HIG `PlatformColor` styling.
// 2. Mocked `isPro` as false to show the banner.
// 3. Removed Zeego DropdownMenu in favor of standard Pressable routing or ActionSheets to keep dependencies clean.

const termsUrl = 'https://ajar-prune-18d.notion.site/Depuff-AI-Terms-Of-Service-30d99fdd69fc801786cdedda3f712ee7?pvs=74';
const privacyUrl = 'https://ajar-prune-18d.notion.site/Depuff-AI-Privacy-Policy-30d99fdd69fc8039a6e6e1d5271839ab?pvs=74';

export default function SettingsIndex() {
  const { width, height } = useWindowDimensions();
  const { waterGoalMl, sodiumGoalMg, setWaterGoalMl, setSodiumGoalMg } = useSettingsStore();
  const { t } = useTranslation();
  const posthog = usePostHog();

  const { isPro } = useSubscription();
  const isRTL = I18nManager.isRTL;

  useEffect(() => {
    void syncHydrationWidgetSnapshot().catch((widgetError) => {
      console.warn('Failed to sync hydration widget', widgetError);
    });
  }, [waterGoalMl]);

  const openLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        t('settings.alerts.cannotOpenUrlTitle', { defaultValue: 'Unable to open URL' }),
        t('settings.alerts.cannotOpenUrlMessage', { defaultValue: `Cannot open ${url}`, url })
      );
    }
  };

  const writeReview = () => {
    if (Platform.OS === 'ios') {
      // Depuff App Store ID placeholder
      Linking.openURL(`itms-apps://itunes.apple.com/app/viewContentsUserReviews/id6759452702?action=write-review`);
    } else {
      Alert.alert(
        t('settings.alerts.reviewTitle', { defaultValue: 'Review' }),
        t('settings.alerts.reviewMessage', {
          defaultValue: 'Reviewing is only supported on iOS right now.',
        })
      );
    }
  };

  const promptGoal = (title: string, message: string, currentValue: number, onSave: (val: number) => void) => {
    Alert.prompt(
      title,
      message,
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { 
          text: t('common.save', { defaultValue: 'Save' }), 
          onPress: (val: any) => {
            const num = parseInt(val || '', 10);
            if (!isNaN(num) && num > 0) {
              onSave(num);
            } else {
              Alert.alert(
                t('settings.alerts.invalidInputTitle', { defaultValue: 'Invalid Input' }),
                t('settings.alerts.invalidInputMessage', {
                  defaultValue: 'Please enter a valid number greater than 0.',
                })
              );
            }
          }
        }
      ],
      'plain-text',
      currentValue.toString(),
      'number-pad'
    );
  };

  const SECTIONS = [
    {
      title: t('settings.sections.currentGoals', { defaultValue: 'Current Goals' }),
      data: [
        [
          {
            id: 'waterGoal',
            label: t('settings.goals.hydrationLabel', {
              defaultValue: `Hydration (${waterGoalMl} ml)`,
              value: waterGoalMl,
            }),
            icon: 'water',
            rightIcon: isRTL ? 'chevron-back' : 'chevron-forward',
            rightIconType: 'Ionicons',
            onPress: () =>
              promptGoal(
                t('settings.goals.hydrationPromptTitle', { defaultValue: 'Hydration Goal' }),
                t('settings.goals.hydrationPromptMessage', {
                  defaultValue: 'Enter your daily water goal in milliliters (ml):',
                }),
                waterGoalMl,
                (val) => {
                  setWaterGoalMl(val);
                  posthog?.capture('Settings Goal Updated', {
                    goal_type: 'hydration',
                    new_value_ml: val,
                  });
                }
              ),
            iconColor: PlatformColor('systemBlue'),
          },
          {
            id: 'sodiumGoal',
            label: t('settings.goals.sodiumLabel', {
              defaultValue: `Sodium Limit (${sodiumGoalMg} mg)`,
              value: sodiumGoalMg,
            }),
            icon: 'restaurant',
            rightIcon: isRTL ? 'chevron-back' : 'chevron-forward',
            rightIconType: 'Ionicons',
            onPress: () =>
              promptGoal(
                t('settings.goals.sodiumPromptTitle', { defaultValue: 'Sodium Limit' }),
                t('settings.goals.sodiumPromptMessage', {
                  defaultValue: 'Enter your daily sodium limit in milligrams (mg):',
                }),
                sodiumGoalMg,
                (val) => {
                  setSodiumGoalMg(val);
                  posthog?.capture('Settings Goal Updated', {
                    goal_type: 'sodium',
                    new_value_mg: val,
                  });
                }
              ),
            iconColor: PlatformColor('systemOrange'),
          },
        ],
      ],
    },
    {
      title: t('settings.sections.support', { defaultValue: 'Support' }),
      data: [
        [
          {
            id: 'rate',
            label: t('settings.support.rateApp', { defaultValue: 'Rate Depuff' }),
            icon: 'star',
            rightIcon: isRTL ? 'chevron-back' : 'chevron-forward',
            rightIconType: 'Ionicons',
            onPress: writeReview,
            iconColor: PlatformColor('systemYellow'),
          },
          {
            id: 'feedback',
            label: t('settings.support.contactUs', { defaultValue: 'Contact Us' }),
            icon: 'mail',
            rightIcon: isRTL ? 'chevron-back' : 'chevron-forward',
            rightIconType: 'Ionicons',
            onPress: () => Linking.openURL('mailto:support@depuff.app'),
            iconColor: PlatformColor('systemBlue'),
          },
        ],
      ],
    },
    {
      title: t('settings.sections.legal', { defaultValue: 'Legal' }),
      data: [
        [
          {
            id: 'terms',
            label: t('settings.legal.terms', { defaultValue: 'Terms of Service' }),
            icon: 'document-text',
            rightIcon: isRTL ? 'arrow-top-left' : 'arrow-top-right',
            rightIconType: 'Ionicons',
            onPress: () => openLink(termsUrl),
            iconColor: PlatformColor('systemGray'),
          },
          {
            id: 'privacy',
            label: t('settings.legal.privacy', { defaultValue: 'Privacy Policy' }),
            icon: 'lock-closed',
            rightIcon: isRTL ? 'arrow-top-left' : 'arrow-top-right',
            rightIconType: 'Ionicons',
            onPress: () => openLink(privacyUrl),
            iconColor: PlatformColor('systemGray'),
          },
        ],
      ],
    },
  ];

  const renderItem = ({ item: items }: { item: any[] }) => (
    <View style={styles.sectionCard}>
      {items.map((item: any, index: number) => (
        <React.Fragment key={item.id}>
          <PressableScale onPress={item.onPress} style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconContainer, { backgroundColor: item.iconColor }]}>
                <Ionicons
                  name={(item.icon + '-outline') as any}
                  size={20}
                  color="white"
                />
              </View>
              <Text selectable style={styles.rowLabel}>{item.label}</Text>
            </View>
            {item.rightIconType === 'Ionicons' ? (
              <Ionicons name={item.rightIcon} size={20} color={PlatformColor('tertiaryLabel')} />
            ) : (
              <MaterialCommunityIcons
                name={item.rightIcon as any}
                size={20}
                color={PlatformColor('tertiaryLabel')}
              />
            )}
          </PressableScale>
          {index < items.length - 1 && <View style={styles.separator} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SectionList
      ListHeaderComponent={
        !isPro ? (
          <PressableScale style={styles.proCard} onPress={() => {}}>
            <View style={StyleSheet.absoluteFill}>
              <AnimatedGradientRect width={width} height={height} />
            </View>
            <View style={styles.proContent}>
              <View style={styles.proLeft}>
                <View style={styles.proIconContainer}>
                  <Ionicons name="sparkles" size={24} color="white" />
                </View>
                <View>
                  <Text selectable style={styles.proTitle}>
                    {t('settings.pro.title', { defaultValue: 'Depuff Pro' })}
                  </Text>
                  <Text selectable style={styles.proSubtitle}>
                    {t('settings.pro.subtitle', {
                      defaultValue: 'Unlock all facial scanning features',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </PressableScale>
        ) : null
      }
      sections={SECTIONS}
      keyExtractor={(item, index) => index.toString()}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      stickySectionHeadersEnabled={false}
      style={styles.list}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionHeader}>{title}</Text>
      )}
      renderItem={renderItem}
    />
  );
}

function AnimatedGradientRect({ width, height }: { width: number; height: number }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withRepeat(
      withTiming(1, {
        duration: 4000,
      }),
      -1,
      true,
    );
  }, [t]);

  const start = useDerivedValue(() => {
    const angle = t.value * Math.PI * 2;
    const radius = width * 0.15;
    const centerX = width * 0.2;
    const centerY = height * 0.2;

    return vec(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  });

  const end = useDerivedValue(() => {
    const angle = t.value * Math.PI * 2 + Math.PI;
    const radius = width * 0.25;
    const centerX = width * 0.8;
    const centerY = height * 0.8;

    return vec(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  });

  return (
    <Canvas style={{ flex: 1 }}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={start}
          end={end}
          colors={['rgba(34, 211, 238, 1)', 'rgba(6, 182, 212, 1)', 'rgba(56, 189, 248, 1)']}
          positions={[0, 0.45, 1]}
        />
      </Rect>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: PlatformColor('systemGroupedBackground'),
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  proCard: {
    width: '100%',
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingVertical: 24,
    marginTop: 20,
    marginBottom: 12,
  },
  proContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  proLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  proSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColor('secondaryLabel'),
    marginTop: 24,
    marginBottom: 8,
    marginStart: 16,
    textTransform: 'uppercase',
  },
  sectionCard: {
    flexDirection: 'column',
    width: '100%',
    backgroundColor: PlatformColor('secondarySystemGroupedBackground'),
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    color: PlatformColor('label'),
    fontWeight: '500',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PlatformColor('separator'),
    marginStart: 60,
  },
});
