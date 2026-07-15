# Nekogo（記憶 / Kioku）

專注於日文學習的垂直閃卡 App。目標是提供比通用閃卡工具更好的「日文開箱即用體驗」：
精準的振假名（furigana）疊字對位、高低音調（pitch accent）視覺標記、KanjiVG 筆順動畫、
繁體中文在地化釋義，以及基於 FSRS-6 的現代間隔重複排程——內容全離線、不依賴伺服器。

使用 Expo（React Native）開發，支援 iOS 與 Android。

## 特色

- **速讀優先（skim-first）雙軌學習**——新字只從「速讀」進入：一眼掃過，分流成「已經會了」或「要學」；「閃卡」只複習已學過且到期的卡，永遠不引入新字。詳見 [docs/LEARNING_FLOW.md](docs/LEARNING_FLOW.md)。
- **FSRS-6 排程＋裝置端個人化**——排程由 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 計算；累積足夠複習紀錄後，可用內建的原生優化器（Rust [fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs)，經 Expo Module 橋接）在本機重新擬合個人參數。詳見 [docs/FSRS_NATIVE_OPTIMIZER.md](docs/FSRS_NATIVE_OPTIMIZER.md)。
- **全離線內容庫**——單字（JMdict）、逐字 furigana 對位（JmdictFurigana）、例句（Tanaka Corpus / Tatoeba）、漢字與筆順（KANJIDIC2 / KanjiVG）、JLPT 分級、詞頻與音調，於 build 階段由 ETL 組成唯讀 SQLite 隨 App 打包。
- **繁體中文釋義**——`gloss_zh` 以台灣用語重譯（非簡繁轉換），缺譯自動退回英文；語言可於設定切換。
- **詞源（語源）演化圖**——像 Google 字典的「Word origin」：以演化鏈呈現詞形變遷（如 文手（ふみて）→ ふんで → ふで（筆）），標注信度（定說／有力學說／一說／俗說）與可點開的出典連結。目前為試批階段，僅覆蓋部分 N5 高頻詞。
- **單字詳情**——pitch accent 圖、例句 TTS 朗讀、構成漢字筆順動畫（可點入逐筆播放）。

## 技術棧

| 層 | 採用 |
|---|---|
| 框架 | Expo SDK 56（custom dev build，不支援 Expo Go）、React Native 0.85、React 19、TypeScript |
| 路由 | expo-router（檔案式路由，`src/app/`） |
| 資料庫 | [@op-engineering/op-sqlite](https://github.com/OP-Engineering/op-sqlite)：可變主庫（`cards`／`revlog`）＋唯讀內容庫 `ATTACH` 為別名 `content` 跨庫 JOIN |
| 排程 | ts-fsrs（FSRS-6）；個人化訓練走 `modules/fsrs-native`（Rust → C ABI → Swift/Kotlin） |
| 動畫／繪圖 | react-native-reanimated、react-native-svg（筆順、pitch accent） |

## 專案結構

```
apps/nekogo/
├── src/
│   ├── app/               # expo-router 頁面（(tabs)、review、skim、search、stroke-order…）
│   ├── components/ui/     # 共用元件（FuriganaText、FlashCard、PitchAccent、KanjiStrokeBoard、EtymologyCard…）
│   ├── api/contentApi.ts  # 內容存取層：離線查詢內容庫（保留原雲端 client 簽章）
│   ├── db/                # 主庫 schema、內容庫掛載（contentDb.ts）、repositories
│   ├── services/          # fsrs.ts（排程）、fsrsOptimizer / fsrsTraining（個人化）
│   ├── hooks/             # useReviewSession 等
│   └── context/           # SettingsContext（語言、外觀等設定）
├── assets/db/kioku-content.db   # 唯讀內容庫（ETL 產物，隨 App 打包）
├── scripts/
│   ├── etl/               # 內容庫 ETL（下載來源 → 組庫 → 充實 → 繁中重譯 → 詞源）
│   └── verify-*.mjs|ts    # 各資料層驗證 harness
├── modules/fsrs-native/   # Expo 原生模組：fsrs-rs 優化器（iOS xcframework / Android cargo-ndk）
└── docs/                  # 資料模型、學習流程、FSRS 優化器等文件
```

## 資料架構

兩個 SQLite 庫、職責分離（詳見 [docs/DATA_MODEL.md](docs/DATA_MODEL.md)）：

- **主庫 `kioku.sqlite`（可變）**——使用者狀態：`cards`（FSRS 卡片）與 `revlog`（複習紀錄）。
- **內容庫 `kioku-content.db`（唯讀）**——`vocab`／`kanji`／`example`／`decks`／`vocab_etymology` 等，
  以 `表記＋讀音`（JMdict `ent_seq`）為 join key 正規化。首次啟動複製到可寫目錄後 `ATTACH`；
  檔名帶版本（`kioku-content-vNN.db`，見 [src/db/contentDb.ts](src/db/contentDb.ts)），內容改版 bump 即強制重新複製，不動使用者資料。

### 內容庫 ETL

內容庫由 `scripts/etl/` 在開發機組好、產物進版控（App build 不需跑 ETL）：

```bash
npm run content        # 下載全部來源 → 組庫 → 驗證
npm run content:verify # 驗證內容庫
```

之上還有兩條持續進行的資料精修管線，皆為「匯出批次 → session 內 LLM 生成 → 嚴格驗證回寫」模式：

- **繁中釋義重譯**（`export-gloss-batch.mjs` → `apply-gloss-v2.mjs`／`apply-gloss-fixes.mjs`）
- **詞源生成**（`export-etymology-batch.mjs` → `apply-etymology.mjs` → `verify-etymology.mjs`；
  無可靠學說的詞入 `etymology-skiplist.json`，寧缺勿錯）

## 開發

```bash
npm install

# 本專案使用原生模組（op-sqlite、fsrs-native），需 custom dev build，不能用 Expo Go
npx expo run:ios       # iOS 模擬器
npm run ios:device     # iOS 實體機（Release）
npx expo run:android   # Android（需 JDK 17）

npx tsc --noEmit       # 型別檢查
```

## 文件

| 文件 | 內容 |
|---|---|
| [docs/LEARNING_FLOW.md](docs/LEARNING_FLOW.md) | 學習系統全貌：速讀／閃卡雙軌、FSRS 排程、每日配額與統計 |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | 內容庫資料模型與關聯圖 |
| [docs/FSRS_NATIVE_OPTIMIZER.md](docs/FSRS_NATIVE_OPTIMIZER.md) | Rust 原生優化器的實作、交叉編譯與驗證紀錄 |
| [RESOURCES.md](RESOURCES.md) | 外部資源總目錄：每筆資料來源的授權與商用風險盤點 |

## 資料來源與授權

內容資料建立在開放授權資源之上：JMdict／KANJIDIC2（EDRDG，CC BY-SA 4.0）、
JmdictFurigana（CC BY-SA 4.0）、KanjiVG（CC BY-SA 3.0）、Tanaka Corpus／Tatoeba（CC BY）、
tanos.co.uk JLPT 字表等。完整清單與各來源的授權標注見 [RESOURCES.md](RESOURCES.md)，
App 內「關於」頁列有 attribution。
