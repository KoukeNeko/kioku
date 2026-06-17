import { Stack } from "expo-router";
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SettingsProvider } from '../context/SettingsContext';
import { initDB } from '../db/schema';
import { seedDatabaseIfEmpty } from '../db/seed';

SplashScreen.preventAutoHideAsync();

// Initialize Database on App Start
initDB();
seedDatabaseIfEmpty();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'SourceHanSerif-Regular': require('../../assets/fonts/SourceHanSerifJP-Regular.otf'),
    'SourceHanSerif-Bold': require('../../assets/fonts/SourceHanSerifJP-Bold.otf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review" />
      </Stack>
    </SettingsProvider>
  );
}
