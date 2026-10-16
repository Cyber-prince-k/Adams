/**
 * Root layout — sets up global CSS, gesture handler,
 * status bar, and the Expo Router Stack navigator.
 */

import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0a0f" }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0f" },
          animation: Platform.OS === "web" ? "none" : "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat"
          options={{
            headerShown: true,
            headerTitle: "ADAMS",
            headerStyle: { backgroundColor: "#111118" },
            headerTintColor: "#e8e8f0",
            headerTitleStyle: {
              fontWeight: "700",
              fontSize: 18,
              color: "#3b82f6",
            } as object,
            headerShadowVisible: false,
            presentation: Platform.OS === "web" ? "card" : "modal",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            headerTitle: "Settings",
            headerStyle: { backgroundColor: "#111118" },
            headerTintColor: "#e8e8f0",
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
