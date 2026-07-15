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
// 版本化檔名：內容庫改版或副本需強制重建時 bump，下次啟動會重新複製，不動使用者主庫 cards/revlog。
// v13：明日 讀音＝kuromoji 基準（あした）＋逐句 あす override（見 apply-asu-overrides.mjs）。漢字繁中 kanji.meanings_zh 已撤下（程式不讀取；DB 舊欄位保留無害）。
// v14：詞條策展修正第一批（apply-vocab-curation.mjs）：tanos N2 假名詞頭 する→刷る（含 furigana、pitch [1]）。
// v15：例句連結策展（apply-example-curation.mjs）：讀音錯配剪枝 6,063 條＋37 句 RESCUE 修 furigana。
// v16：高風險詞性（副詞/感嘆詞）繁中重譯 1,253 筆（Sonnet 級人工重譯：翻日文詞本身、防假朋友；強いて/日中/どう 等壞譯修正）。
// v17：繁中重譯續批（依頻率補常用未翻詞＋壞譯）共 4,493 筆入 gloss_zh；含副詞/感嘆詞/助詞/常用名詞（無理やり、乾杯、最近、季節、真実…）。
// v18：再補常用名詞/助詞 1,200 筆（部門、違法、例外、本質、貴族、狂気、戰術、神秘…），gloss_zh 繁中重譯累計 5,693 筆；分隔符統一全形「；」。
// v19：--risk 佇列（副詞/感嘆詞/連接詞/助詞）全數翻畢，再補 6,724 筆入 gloss_zh，繁中重譯累計 12,417 筆；含大量常用詞（館内、悪性、前代未聞、共働き、自明、過渡期、風光明媚、当意即妙…）與擬聲擬態詞、それ／いずれ／ながら等連接詞助詞語感標註。
// v20：非高風險常用詞繁中補譯——JLPT N5 核心名詞第一批 60 筆＋單詞精修（葛藤 かっとう/つづらふじ、筆 ふで）；gloss_zh 覆蓋 63,083。
// v21：新增 vocab_etymology 詞源表（演化鏈 JSON＋信度＋出典連結）試批 15 筆（N5 高頻：いい、この、だけ、じゃ、とし…）；無可靠學說者入 skiplist 不佔位。
// v22：內容同 v21；強制重建副本（v21 首次複製時 Metro 中斷，裝置上留下缺表的壞副本）。
// v23：補「筆（ふで）」詞源（文手→ふむで→ふで；語源由来辞典），vocab_etymology 共 16 筆。
const CONTENT_DB_FILE = 'kioku-content-v23.db';
// 舊版副本檔名：複製新版時順手清掉，避免 134MB 級的孤兒檔佔用空間。
const STALE_CONTENT_DB_FILES = [
  'kioku-content-v4.db',
  'kioku-content-v5.db',
  'kioku-content-v6.db',
  'kioku-content-v7.db',
  'kioku-content-v8.db',
  'kioku-content-v9.db',
  'kioku-content-v10.db',
  'kioku-content-v11.db',
  'kioku-content-v12.db',
  'kioku-content-v13.db',
  'kioku-content-v14.db',
  'kioku-content-v15.db',
  'kioku-content-v16.db',
  'kioku-content-v17.db',
  'kioku-content-v18.db',
  'kioku-content-v19.db',
  'kioku-content-v20.db',
  'kioku-content-v21.db',
  'kioku-content-v22.db',
];
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
  for (const staleFile of STALE_CONTENT_DB_FILES) {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${staleFile}`, { idempotent: true });
  }
  console.log('✅ 內容庫已複製至 documentDirectory');
};

/** 複製（首次）並把內容庫 ATTACH 到主連線。冪等；需在任何 content.* 查詢前 await。 */
export const attachContentDb = async (): Promise<void> => {
  if (attached) {
    return;
  }
  await ensureContentDbCopied();
  // dev reload 後原生連線可能還留著上一輪的 ATTACH；若指向舊版檔案則先卸掉再重掛。
  const attachedDbs = (db.executeSync('PRAGMA database_list').rows ?? []) as { name?: string; file?: string }[];
  const existing = attachedDbs.find((row) => row.name === CONTENT_ALIAS);
  if (existing && existing.file !== DEST_PATH) {
    db.executeSync(`DETACH DATABASE ${CONTENT_ALIAS}`);
  }
  if (!existing || existing.file !== DEST_PATH) {
    db.executeSync(`ATTACH DATABASE '${DEST_PATH}' AS ${CONTENT_ALIAS}`);
  }
  attached = true;

  const result = db.executeSync(`SELECT COUNT(*) AS count FROM ${CONTENT_ALIAS}.vocab`);
  const count = (result.rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  console.log(`✅ 內容庫已掛載 — content.vocab 共 ${count} 筆`);
};
