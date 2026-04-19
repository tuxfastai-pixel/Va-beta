import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;

  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== "granted") {
    return { granted: false };
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return { granted: true, token: token.data };
}
