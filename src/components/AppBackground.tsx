import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useBackground } from '@/hooks/useBackground';
import { colors } from '@/theme/colors';

export function AppBackground({ children }: { children: ReactNode }) {
  const { settings, loading } = useBackground();

  if (loading || settings.imageUri === null) {
    return <View style={styles.solid}>{children}</View>;
  }

  return (
    <ImageBackground
      source={{ uri: settings.imageUri }}
      style={styles.image}
      resizeMode="cover"
      onError={() => undefined}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background, opacity: settings.dimOpacity },
        ]}
        pointerEvents="none"
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  solid: {
    flex: 1,
    backgroundColor: colors.background,
  },
  image: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
