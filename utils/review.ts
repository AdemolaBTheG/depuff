import * as StoreReview from "expo-store-review";
import { Alert } from "react-native";

export async function askForReview(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Enjoying the app?",
      "Please take a moment to rate us 5 stars on the App Store!",
      [
        {
          text: "No, thanks",
          style: "cancel",
          onPress: () => {
            resolve(false);
          },
        },
        {
          text: "Rate Now",
          style: "default",
          onPress: async () => {
            try {
              const isAvailable = await StoreReview.isAvailableAsync();
              if (isAvailable) {
                StoreReview.requestReview();
                resolve(true);
              } else {
                resolve(false);
              }
            } catch (err) {
              resolve(false);
            }
          },
        },
      ]
    );
  });
}
