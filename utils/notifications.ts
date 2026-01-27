import * as Notifications from 'expo-notifications';
import { OneSignal } from 'react-native-onesignal';

export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const status = await OneSignal.Notifications.requestPermission(true);

    return status;
  }

  return true;
}
