import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from './schema';

/**
 * 唯讀「內容庫」(kioku-content.db) 的載入與掛載。
 *
 * 內容庫由 scripts/etl 於 build 階段組好，放在 assets/db/ 隨 App 打包（Metro 以 asset 方式內嵌；
 * 見 metro.config.js 的 assetExts 追加 'db'）。首次啟動複製到可寫的 documentDirectory
 * （copyAsync 為原生檔案複製、不讀進 JS 記憶體，134MB 亦安全），再以絕對路徑 ATTACH 到主連線的別名 `content`，
 * 之後可跨庫 JOIN（cards c JOIN content.vocab v）。
 *
 * 必須複製到 documentDirectory —— expo-file-system 只允許寫入它管理的目錄。
 * ATTACH 不跨進程存活，故每次冷啟都要重掛（copyAsync 第二次起會因檔案已存在而略過）。
 *
 * 備註：op-sqlite 另有原生 moveAssetsDatabase，但需把 DB 嵌進原生 bundle（iOS Xcode 資源／Android assets），
 * 於 Expo CNG 需額外 config plugin；本專案沿用既有、免原生設定的 expo-asset + copyAsync 路徑。
 */

export const CONTENT_ALIAS = 'content';
// 版本化檔名：內容庫改版時 bump（配合 contentApi 的 CONTENT_VERSION），強制下次啟動重新複製，不動使用者主庫 cards/revlog。
const CONTENT_DB_FILE = 'kioku-content-v4.db';
const DEST_URI = `${FileSystem.documentDirectory}${CONTENT_DB_FILE}`;
const DEST_PATH = DEST_URI.replace('file://', '');

let attached = false;

const ensureContentDbCopied = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(DEST_URI);
  if (info.exists) {
    return;
  }
  const asset = Asset.fromModule(require('../../assets/db/kioku-content.db'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('內容庫資產無 localUri，無法複製');
  }
  await FileSystem.copyAsync({ from: asset.localUri, to: DEST_URI });
  console.log('✅ 內容庫已複製至 documentDirectory');
};

/** 複製（首次）並把內容庫 ATTACH 到主連線。需在任何 content.* 查詢前 await。 */
export const attachContentDb = async (): Promise<void> => {
  if (attached) {
    return;
  }
  await ensureContentDbCopied();
  db.executeSync(`ATTACH DATABASE '${DEST_PATH}' AS ${CONTENT_ALIAS}`);
  attached = true;

  const result = db.executeSync(`SELECT COUNT(*) AS count FROM ${CONTENT_ALIAS}.vocab`);
  const count = (result.rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  console.log(`✅ 內容庫已掛載 — content.vocab 共 ${count} 筆`);
};
