import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/colors';
// ВАЖЛИВО: імпорт заради сайд-ефекту — реєструє бекграунд-таск локації
// до того, як хтось спробує його запустити.
import '@/tracking/locationTask';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Сьогодні' }} />
        <Stack.Screen
          name="summary"
          options={{ title: 'Підсумок дня', presentation: 'modal' }}
        />
        <Stack.Screen name="stats" options={{ title: 'Статистика' }} />
        <Stack.Screen name="goals" options={{ title: 'Цілі' }} />
        <Stack.Screen
          name="run/active"
          options={{ title: 'Пробіжка', headerBackVisible: true }}
        />
        <Stack.Screen name="run/[id]" options={{ title: 'Пробіжка' }} />
      </Stack>
    </>
  );
}
