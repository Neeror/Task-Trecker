import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppBackground } from '@/components/AppBackground';
import { BackgroundProvider } from '@/hooks/useBackground';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <BackgroundProvider>
      <AppBackground>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            // Прозорий фон екранів, щоб було видно користувацьке фото.
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Сьогодні' }} />
          <Stack.Screen
            name="summary"
            options={{ title: 'Підсумок дня', presentation: 'modal' }}
          />
          <Stack.Screen name="stats" options={{ title: 'Статистика' }} />
          <Stack.Screen name="goals" options={{ title: 'Цілі' }} />
        </Stack>
      </AppBackground>
    </BackgroundProvider>
  );
}

