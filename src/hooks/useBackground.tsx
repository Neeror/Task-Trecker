import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  DEFAULT_BACKGROUND_SETTINGS,
  deleteBackgroundFile,
  deleteStoredBackgroundFiles,
  loadBackgroundSettings,
  persistBackgroundSettings,
  saveBackgroundImage,
  type BackgroundSettings,
} from '@/storage/backgroundRepo';

interface BackgroundContextValue {
  settings: BackgroundSettings;
  loading: boolean;
  error: string | null;
  /** Відкриває галерею, валідує та зберігає фото як фон. */
  pickBackground: () => Promise<void>;
  /** Повертає стандартний фон і видаляє збережений файл. */
  resetBackground: () => Promise<void>;
  /** Змінює рівень затемнення (0..0.9). */
  setDimOpacity: (value: number) => Promise<void>;
  clearError: () => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BackgroundSettings>(
    DEFAULT_BACKGROUND_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBackgroundSettings()
      .then((loaded: BackgroundSettings) => {
        if (!cancelled) setSettings(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickBackground = useCallback(async () => {
    setError(null);
    try {
      // Запит доступу лише до фото; на iOS 14+ користувач може дати
      // обмежений доступ до окремих фото — цього достатньо.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Немає доступу до галереї. Дозвольте доступ у налаштуваннях.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        exif: false, // не читаємо метадані (геолокацію тощо) — приватність
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        setError('Не вдалося отримати фото.');
        return;
      }

      const savedUri = await saveBackgroundImage(asset.uri);

      // Спершу зберігаємо нові налаштування, потім точково прибираємо
      // попередній файл, щоб у разі збою не лишитися без фону взагалі.
      const previousUri = settings.imageUri;
      const next: BackgroundSettings = { ...settings, imageUri: savedUri };
      await persistBackgroundSettings(next);
      setSettings(next);

      if (previousUri !== null && previousUri !== savedUri) {
        deleteBackgroundFile(previousUri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося встановити фон.');
    }
  }, [settings]);

  const resetBackground = useCallback(async () => {
    setError(null);
    try {
      const next: BackgroundSettings = { ...settings, imageUri: null };
      await persistBackgroundSettings(next);
      setSettings(next);
      deleteStoredBackgroundFiles();
    } catch {
      setError('Не вдалося скинути фон.');
    }
  }, [settings]);

  const setDimOpacity = useCallback(
    async (value: number) => {
      // Затискаємо значення в безпечний діапазон незалежно від джерела.
      const clamped = Math.min(0.9, Math.max(0, value));
      try {
        const next: BackgroundSettings = { ...settings, dimOpacity: clamped };
        await persistBackgroundSettings(next);
        setSettings(next);
      } catch {
        setError('Не вдалося зберегти налаштування.');
      }
    },
    [settings],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      pickBackground,
      resetBackground,
      setDimOpacity,
      clearError,
    }),
    [settings, loading, error, pickBackground, resetBackground, setDimOpacity, clearError],
  );

  return (
    <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>
  );
}

export function useBackground(): BackgroundContextValue {
  const ctx = useContext(BackgroundContext);
  if (ctx === null) {
    throw new Error('useBackground must be used within BackgroundProvider');
  }
  return ctx;
}
