import { Directory, File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { getTtsServerUrl } from '../db/repositories/uiSettingsRepository';

// v5 invalidates files produced by the former silence-based segment trimmer.
const AUDIO_CACHE_DIR = 'dictionary-audio-v5';
const REQUEST_TIMEOUT_MS = 3_000;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const NUMERIC_ENTRY_ID_PATTERN = /^\d+$/;
const INVALID_ENTRY_ID_PART_PATTERN = /[\\/?#%\u0000-\u001F\u007F]/;

const inflightDownloads = new Map<string, Promise<string | null>>();

export const isDictionaryAudioEntryId = (entryId: string): boolean => {
  const separator = entryId.indexOf(':');
  if (separator < 1) return false;
  const kind = entryId.slice(0, separator);
  const id = entryId.slice(separator + 1);
  if (!id || id.length > 128 || INVALID_ENTRY_ID_PART_PATTERN.test(id)) return false;
  if (kind === 'example') return NUMERIC_ENTRY_ID_PATTERN.test(id);
  return kind === 'vocab' && (NUMERIC_ENTRY_ID_PATTERN.test(id) || id.startsWith('t-'));
};

const cacheRootDirectory = () => new Directory(Paths.cache, AUDIO_CACHE_DIR);

const cacheDirectory = (baseUrl: string) => new Directory(cacheRootDirectory(), encodeURIComponent(baseUrl));

const ensureCacheDirectory = (baseUrl: string): Directory => {
  const directory = cacheDirectory(baseUrl);
  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }
  return directory;
};

const parseEntryId = (entryId: string): { kind: 'vocab' | 'example'; id: string } => {
  if (!isDictionaryAudioEntryId(entryId)) throw new Error(`Invalid dictionary audio entry ID: ${entryId}`);
  const [kind, ...idParts] = entryId.split(':');
  return { kind: kind as 'vocab' | 'example', id: idParts.join(':') };
};

type AudioExtension = 'm4a' | 'opus';

const cacheFileFor = (baseUrl: string, entryId: string, extension: AudioExtension): File => {
  const { kind, id } = parseEntryId(entryId);
  return new File(ensureCacheDirectory(baseUrl), `${kind}-${encodeURIComponent(id)}.${extension}`);
};

const readyCacheUri = (baseUrl: string, entryId: string): string | null => {
  for (const extension of ['m4a', 'opus'] as const) {
    const file = cacheFileFor(baseUrl, entryId, extension);
    if (file.exists && (file.size ?? 0) > 0) return file.uri;
    if (file.exists) file.delete();
  }
  return null;
};

const audioUrl = (baseUrl: string, entryId: string): string => {
  const { kind, id } = parseEntryId(entryId);
  return `${baseUrl}/api/v1/dictionary-audio/${kind}/${encodeURIComponent(id)}`;
};

const downloadAudio = async (baseUrl: string, entryId: string): Promise<string | null> => {
  const cached = readyCacheUri(baseUrl, entryId);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await expoFetch(audioUrl(baseUrl, entryId), { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const extension: AudioExtension | null = contentType.startsWith('audio/ogg') || contentType.startsWith('audio/opus') ? 'opus' :
      contentType.startsWith('audio/mp4') || contentType.startsWith('audio/x-m4a') ? 'm4a' :
      null;
    if (!extension) return null;
    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_AUDIO_BYTES) return null;

    const bytes = await response.bytes();
    if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) return null;

    const destination = cacheFileFor(baseUrl, entryId, extension);
    const temporary = new File(destination.parentDirectory, `.${destination.name}.${Date.now()}.tmp`);
    let moved = false;
    try {
      temporary.create({ overwrite: true, intermediates: true });
      temporary.write(bytes);
      await temporary.move(destination, { overwrite: true });
      if (!destination.exists || destination.size !== bytes.length) {
        throw new Error('Downloaded audio was not persisted correctly');
      }
      moved = true;
    } finally {
      // File.move() mutates `temporary.uri` to the destination. Deleting it
      // after a successful move would therefore delete the cached audio.
      if (!moved && temporary.exists) temporary.delete();
    }
    return destination.uri;
  } catch (error) {
    if ((error as { name?: string }).name !== 'AbortError') {
      console.warn('預產語音下載失敗，改用裝置 TTS', { entryId, error });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/** 取得本機音檔 URI；未設定 server、缺檔或網路失敗時回傳 null。 */
export const getDictionaryAudioUri = async (entryId: string): Promise<string | null> => {
  if (!isDictionaryAudioEntryId(entryId)) return null;
  const baseUrl = getTtsServerUrl();
  if (!baseUrl) return null;

  const key = `${baseUrl}\n${entryId}`;
  const existing = inflightDownloads.get(key);
  if (existing) return existing;

  const request = downloadAudio(baseUrl, entryId).finally(() => inflightDownloads.delete(key));
  inflightDownloads.set(key, request);
  return request;
};

export const prefetchDictionaryAudio = async (entryId: string): Promise<void> => {
  await getDictionaryAudioUri(entryId);
};

/** 播放器判定檔案無效時移除該筆，讓下次播放重新向 server 下載。 */
export const invalidateDictionaryAudioCacheEntry = (entryId: string): void => {
  if (!isDictionaryAudioEntryId(entryId)) return;
  const baseUrl = getTtsServerUrl();
  if (!baseUrl) return;
  for (const extension of ['m4a', 'opus'] as const) {
    const file = cacheFileFor(baseUrl, entryId, extension);
    if (file.exists) file.delete();
  }
  inflightDownloads.delete(`${baseUrl}\n${entryId}`);
};

/** Server 與本機只刪除指定音聲，隨後用 HEAD 立即觸發背景重新生成。 */
export const regenerateDictionaryAudio = async (entryId: string): Promise<void> => {
  if (!isDictionaryAudioEntryId(entryId)) {
    throw new Error(`Invalid dictionary audio entry ID: ${entryId}`);
  }
  const baseUrl = getTtsServerUrl();
  if (!baseUrl) throw new Error('音声サーバーが設定されていません');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = audioUrl(baseUrl, entryId);
  try {
    const deletion = await expoFetch(url, { method: 'DELETE', signal: controller.signal });
    if (!deletion.ok) {
      throw new Error(`音声の削除に失敗しました（HTTP ${deletion.status}）`);
    }

    invalidateDictionaryAudioCacheEntry(entryId);
    const regeneration = await expoFetch(url, { method: 'HEAD', signal: controller.signal });
    const generationState = regeneration.headers.get('x-audio-generation');
    if (regeneration.ok || (regeneration.status === 404 && (generationState === 'started' || generationState === 'in-progress'))) {
      return;
    }
    throw new Error(`音声の再生成を開始できませんでした（HTTP ${regeneration.status}）`);
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') {
      throw new Error('音声サーバーへの接続がタイムアウトしました');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const getDictionaryAudioCacheBytes = (): number => {
  const directory = cacheRootDirectory();
  return directory.exists ? (directory.size ?? 0) : 0;
};

export const clearDictionaryAudioCache = (): void => {
  const directory = cacheRootDirectory();
  if (directory.exists) directory.delete();
  inflightDownloads.clear();
};

export const checkTtsServer = async (rawBaseUrl: string): Promise<{ audioProfile: string }> => {
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await expoFetch(`${baseUrl}/healthz`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { status?: string; audio_profile?: string };
    if (body.status !== 'ok') throw new Error('Invalid health response');
    return { audioProfile: body.audio_profile ?? 'unknown' };
  } finally {
    clearTimeout(timeout);
  }
};
