import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

const STORAGE_KEY = 'app_background_settings_v1';
const BACKGROUNDS_DIR_NAME = 'backgrounds';

/** Максимальний розмір фото — 15 МБ, щоб не роздувати пам'ять. */
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/** Дозволені розширення зображень. */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const;

export const backgroundSettingsSchema = z.object({
  /** Абсолютний URI файлу в пісочниці застосунку або null (стандартний фон). */
  imageUri: z.string().min(1).nullable(),
  /** Затемнення поверх фото, щоб текст лишався читабельним. 0..0.9 */
  dimOpacity: z.number().min(0).max(0.9),
});

export type BackgroundSettings = z.infer<typeof backgroundSettingsSchema>;

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  imageUri: null,
  dimOpacity: 0.55,
};

function getBackgroundsDir(): Directory {
  return new Directory(Paths.document, BACKGROUNDS_DIR_NAME);
}

function ensureBackgroundsDir(): Directory {
  const dir = getBackgroundsDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** Дістає розширення з URI без урахування query-параметрів, у нижньому регістрі. */
function extractExtension(uri: string): string | null {
  const withoutQuery = uri.split('?')[0] ?? '';
  const lastDot = withoutQuery.lastIndexOf('.');
  if (lastDot === -1 || lastDot === withoutQuery.length - 1) return null;
  return withoutQuery.slice(lastDot + 1).toLowerCase();
}

function isAllowedExtension(ext: string | null): ext is (typeof ALLOWED_EXTENSIONS)[number] {
  return ext !== null && (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Перевіряє, що URI вказує саме в нашу папку фонів (захист від path traversal). */
function isUriInsideBackgroundsDir(uri: string): boolean {
  const dirUri = getBackgroundsDir().uri;
  return uri.startsWith(dirUri) && !uri.includes('..');
}

/**
 * Зберігає вибране у пікері фото як фон.
 * Повертає новий URI файлу в пісочниці застосунку.
 * Кидає Error з людським повідомленням, якщо файл не пройшов перевірки.
 */
export async function saveBackgroundImage(pickedUri: string): Promise<string> {
  if (typeof pickedUri !== 'string' || pickedUri.length === 0) {
    throw new Error('Не вдалося отримати фото.');
  }
  // Приймаємо лише локальні URI від пікера — жодних http/https.
  if (!pickedUri.startsWith('file://') && !pickedUri.startsWith('content://')) {
    throw new Error('Непідтримуване джерело зображення.');
  }

  const ext = extractExtension(pickedUri);
  if (!isAllowedExtension(ext)) {
    throw new Error('Підтримуються лише зображення JPG, PNG, WEBP або HEIC.');
  }

  const source = new File(pickedUri);
  if (!source.exists) {
    throw new Error('Файл зображення не знайдено.');
  }
  const size = source.size;
  if (typeof size === 'number' && size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Фото завелике. Максимальний розмір — 15 МБ.');
  }

  const dir = ensureBackgroundsDir();
  // Випадкове ім'я файлу: неможливо підмінити або вгадати.
  const destination = new File(dir, `${randomUUID()}.${ext}`);
  source.copy(destination);

  return destination.uri;
}

/** Точково видаляє один файл фону, якщо він лежить у нашій папці. */
export function deleteBackgroundFile(uri: string): void {
  try {
    if (!isUriInsideBackgroundsDir(uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Некритично.
  }
}

/** Видаляє всі збережені файли фонів (використовується при заміні/скиданні). */
export function deleteStoredBackgroundFiles(): void {
  try {
    const dir = getBackgroundsDir();
    if (dir.exists) {
      dir.delete();
    }
  } catch {
    // Не критично: файл міг бути вже видалений системою.
  }
}

/** Читає налаштування. Ніколи не кидає — на будь-яку проблему повертає дефолт. */
export async function loadBackgroundSettings(): Promise<BackgroundSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_BACKGROUND_SETTINGS;

    const parsed: unknown = JSON.parse(raw);
    const result = backgroundSettingsSchema.safeParse(parsed);
    if (!result.success) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return DEFAULT_BACKGROUND_SETTINGS;
    }

    const settings = result.data;
    if (settings.imageUri !== null) {
      // Захист: шлях мусить лежати в нашій папці і файл мусить існувати.
      if (!isUriInsideBackgroundsDir(settings.imageUri)) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return DEFAULT_BACKGROUND_SETTINGS;
      }
      const file = new File(settings.imageUri);
      if (!file.exists) {
        return { ...settings, imageUri: null };
      }
    }
    return settings;
  } catch {
    return DEFAULT_BACKGROUND_SETTINGS;
  }
}

/** Зберігає налаштування після валідації схемою. */
export async function persistBackgroundSettings(
  settings: BackgroundSettings,
): Promise<void> {
  const validated = backgroundSettingsSchema.parse(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
}
