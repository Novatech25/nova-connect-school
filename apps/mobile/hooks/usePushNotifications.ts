import { useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getSupabaseClient } from "@novaconnect/data/client";

// Configuration du comportement des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string>();
  const [notification, setNotification] = useState<Notifications.Notification>();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);

      // Sauvegarder le token dans le profil utilisateur
      if (token && userId) {
        const supabase = getSupabaseClient();
        // Récupérer d'abord les métadonnées existantes pour ne pas les écraser
        supabase
          .from("users")
          .select("metadata")
          .eq("id", userId)
          .single()
          .then(({ data: userData, error: fetchError }) => {
            if (fetchError) {
              console.error("Failed to fetch user metadata:", fetchError);
              return;
            }

            // Fusionner les métadonnées existantes avec les nouveaux champs push
            const existingMetadata = (userData?.metadata as Record<string, unknown>) || {};
            const updatedMetadata = {
              ...existingMetadata,
              push_token: token,
              push_token_updated_at: new Date().toISOString(),
            };

            // Mettre à jour avec les métadonnées fusionnées
            return supabase
              .from("users")
              .update({ metadata: updatedMetadata })
              .eq("id", userId);
          })
          .then(({ error }) => {
            if (error) console.error("Failed to save push token:", error);
          });
      }
    });

    // Écouter les notifications reçues
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Écouter les interactions avec les notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
      const data = response.notification.request.content.data;

      // Navigation selon le type de notification
      if (data?.scheduleId) {
        // Naviguer vers l'écran EDT
        // router.push(`/schedule/${data.scheduleId}`);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3b82f6",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notification!");
      return;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })
    ).data;
  } else {
    alert("Must use physical device for Push Notifications");
  }

  return token;
}
