# Nekogo (Kioku) — 資源海巡總目錄 (RESOURCES.md)

> **用途**：盤點所有可灌進 Nekogo 的外部資源（內容資料、媒體、現成牌組、套件 / API），每筆標註**授權與商用風險**，作為 ETL 整合與選材的單一依據。
> **範圍**：四大類全覆蓋；商用乾淨與灰色地帶都列，清楚標風險。
> **查證基準**：2026-06，由四組平行研究 agent 以一手來源（GitHub / npm / 授權頁 / 政府公報）實查，非憑記憶推測。
> **免責**：本文為技術與授權現況研究，**非法律意見**。所有 ⚠️/❌ 項目商用上線前請經智財法務確認。
> **配套文件**：PROPOSED_PLAN.md（實作藍圖，本機規劃日誌、不入版控）、[../../momo/compass_artifact…md](../../momo/compass_artifact_wf-d7ccc396-d7b4-4083-bc94-c2a455637927_text_markdown.md)（戰略研究報告）。

---

## 目錄

- [0. 決策摘要 (TL;DR)](#0-決策摘要-tldr)
- [1. 現況盤點：已有 vs. 缺](#1-現況盤點已有-vs-缺)
- [2. 內容 / 詞彙資料](#2-內容--詞彙資料)
- [3. 媒體素材（音檔 / TTS / 筆順動畫）](#3-媒體素材音檔--tts--筆順動畫)
- [4. 現成牌組 / 字表](#4-現成牌組--字表)
- [5. 套件 / 函式庫 / API](#5-套件--函式庫--api)
- [6. 授權地雷專章](#6-授權地雷專章)
- [7. 整合優先序 Roadmap](#7-整合優先序-roadmap)
- [8. Attribution 清單（App「關於」頁必列）](#8-attribution-清單app關於頁必列)
- [9. 主要來源](#9-主要來源)

**圖例**：✅ 可商用／⚠️ 受限或不明（附原因）／❌ 不可商用　|　整合難度 低／中／高　|　現況 ✅已整合／🟡mock 待換／❌缺

---

## 0. 決策摘要 (TL;DR)

**一句話**：整個「文字 + 筆順 + 部首 + furigana + 例句」資料層可以**完全建立在乾淨可商用的開放授權之上**（EDRDG 系列 CC BY-SA 4.0 + KanjiVG CC BY-SA 3.0 + JmdictFurigana + Tatoeba + tanos.co.uk JLPT 表）；真正的授權地雷集中在四處——**pitch accent、詞頻表、文法、現成牌組的嵌入媒體**。

**最乾淨的商用全套組合（建議主線）：**

| 層 | 採用 | 授權 |
|---|---|---|
| 辭典骨幹（詞義/詞性） | **jmdict-simplified**（JMdict eng-common） | CC BY-SA 4.0 |
| 逐字 furigana 對位 | **JmdictFurigana** | CC BY-SA 4.0 |
| 漢字資訊 + 分級 | **KANJIDIC2**（grade 欄）或 **kanji-data**（MIT） | CC BY-SA 4.0 / MIT |
| 筆順動畫 | **KanjiVG** | CC BY-SA 3.0 |
| 部首拆解 | **KRADFILE / RADKFILE** | CC BY-SA 4.0 |
| JLPT 分級（單字/漢字/文法） | **tanos.co.uk**（= open-anki-jlpt-decks, MIT） | CC BY |
| 例句 | **Tatoeba** + Tanaka Corpus | CC BY 2.0 FR / PD |
| 去活用 | **kamiya-codec** | Unlicense（公眾領域） |
| 詞頻排序 | **TUBELEX-JA**（BSD）或 **jpstats**（CC0） | BSD-3 / CC0 |
| 發音 | **裝置端 TTS（expo-speech）** → 升級 piper-plus（MIT） | MIT |
| pitch accent | **UniDic accType（BSD）** 或 tdmelodic（避開 Kanjium） | BSD-New |

**四大授權地雷（務必避開的商用陷阱）：**

1. **Pitch accent**：**Kanjium** 自稱 CC BY-SA 4.0 但 12 萬筆來源從未公開、疑似源自付費辭典；NHK 衍生 Yomitan 詞典 = 直接抄付費辭典；OJAD 明示禁營利。→ 商用走 **UniDic accType / tdmelodic**。
2. **詞頻表**：Innocent Corpus（盜版小說全文）、Netflix / 字幕詞頻、JPDB scrape、H-corpus → 底層全是版權內容。→ 商用走 **TUBELEX-JA / Wikipedia 頻率 / jpstats**。
3. **文法**：fluent-jp、Grammar-Dictionaries、bunpou 等 repo 雖掛 MIT/GPL，**內容卻 scrape 自版權教科書（DoJG、どんなときどう使う）**；Tae Kim 是 NC；Imabi 是 All Rights Reserved。→ 商用只有 **tanos.co.uk（CC BY）** 乾淨。
4. **現成牌組嵌入媒體**：Core 2k/6k、Tango、**Kaishi 1.5k**、Refold 等牌組的例句/音檔/英譯繼承 iKnow/JapanesePod101/出版社版權；教科書字表（Minna/Genki/Quartet/Tobira）受**彙編著作權**且已有出版社執法前例。→ 商用**不要預載版權牌組**，改用開放字表自組。

**一條技術紅線**：**Hermes（RN）至今無執行期 WebAssembly** → `sql.js`、`lindera-wasm`、`fsrs-browser` 等 runtime 呼叫 `WebAssembly.instantiate()` 的套件**裝置端不可直跑**。離線斷詞/解析要嘛純 JS，要嘛 build 階段預處理。

---

## 1. 現況盤點：已有 vs. 缺

**架構與套件層 — 多數已就位：**

| 能力 | 套件 | 現況 |
|---|---|---|
| 本地 DB | `@op-engineering/op-sqlite` 16.2 | ✅已整合 |
| 排程引擎 | `ts-fsrs` 5.4（FSRS-6） | ✅已整合 |
| SVG / 動畫 | `react-native-svg` 15.15 + `reanimated` 4.3 | ✅已整合 |
| 日文字體 | Noto Sans JP + Source Han Serif JP | ✅已整合 |
| Furigana 元件 | `FuriganaText.tsx`（flex 疊字） | ✅元件就緒 |
| 筆順元件 | `KanjiStrokeBoard.tsx` | ✅元件就緒 |

**內容資料層 — 幾乎全缺或仍是 mock：**

| 資料 | 現況 | 缺什麼 |
|---|---|---|
| 單字 / furigana | 🟡 `db/seed.ts` 手寫 10 筆 N5 mock | 真實 JMdict + JmdictFurigana |
| 筆順 SVG | 🟡 `data/mockKanjiVG.ts` 假 path | 真實 KanjiVG |
| 漢字 metadata | ❌缺 | KANJIDIC2 / kanji-data |
| 詞義 / 詞性 | 🟡 僅 `english` 單欄 | JMdict gloss/pos |
| JLPT 分級 | ❌缺 | tanos.co.uk 分級 |
| 例句 | ❌缺 | Tatoeba |
| pitch accent | ❌缺 | UniDic accType（乾淨）|
| 發音 | ❌缺 | expo-speech（MVP）|

> **關鍵相容點**：目前 `notes.kanji` 存的是 `[{ruby, rt}]` JSON（如 `[{ruby:"図",rt:"としょ"},{ruby:"館",rt:"かん"}]`）——**這正是 JmdictFurigana 的輸出結構**，所以那份資料是天然的 drop-in 替代，元件層幾乎不用改。
> **Schema 待擴充**：現行 `notes(id, kanji, english)` 過於精簡，整合時需擴充 reading / jlpt_level / pos / pitch / 例句關聯等欄位（見 [§7](#7-整合優先序-roadmap)）。

---

## 2. 內容 / 詞彙資料

### 2.1 辭典核心

| 資源 | 提供什麼 | 格式/規模 | 授權 | 商用 | 取得 | 整合難度 |
|---|---|---|---|---|---|---|
| **jmdict-simplified** (scriptin) ⭐ | JMdict/JMnedict/KANJIDIC2/KRAD 規則化 JSON | JSON；eng-common ~1.4MB、全英 ~10.9MB（每週發版） | CC BY-SA 4.0（碼 MIT） | ✅ 署名 EDRDG | [github](https://github.com/scriptin/jmdict-simplified) | **低**：JSON → ETL |
| JMdict（EDRDG 原始） | 多語日語辭典 | XML，~217,538 詞 | CC BY-SA 4.0 | ✅ 署名 | [edrdg](http://www.edrdg.org/jmdict/j_jmdict.html) | **高**：XML 巢狀 |
| JMnedict | 人名/地名/專名 | JSON/XML，~743,411 詞 | CC BY-SA 4.0 | ✅ 署名 | jmdict-simplified | **低**(JSON)；規模大宜做可選下載 |
| EDICT/EDICT2 | 舊單行文字辭典 | 文字，gz | CC BY-SA 4.0 | ✅ | [edrdg](http://www.edrdg.org/jmdict/edict.html) | **中**：EDRDG 已標 legacy，**不建議** |
| wadoku | 德日辭典 + pitch | XML/TSV | 授權矛盾，官方禁商用販售 | ⚠️ 受限 | [wadoku](https://www.wadoku.de/wiki/display/WAD/XML) | **高**：德語介面用途低 |

> **註**：jmdict-simplified **只有 JSON、無 JSONL**；全語言版解壓 100MB+，RN 端直接 `JSON.parse` 有記憶體壓力。用 `eng-common`(1.4MB) 子集，並在 build 階段離線 ETL 成 op-sqlite `.db` 打包。

### 2.2 漢字 / 筆順 / 部首

| 資源 | 提供什麼 | 授權 | 商用 | 取得 | 整合難度 | 備註 |
|---|---|---|---|---|---|---|
| **KanjiVG** ⭐ | 每筆 SVG（順序/方向/部首） | CC BY-SA **3.0** | ✅ 署名 + ShareAlike | [github](https://github.com/KanjiVG/kanjivg) | 中 | 筆順核心；**不修改 SVG 即安全商用**（見 §6） |
| **KANJIDIC2** ⭐ | 漢字綜合（JLPT/grade/筆畫/音訓/部首/頻率） | CC BY-SA 4.0 | ✅ 署名 | [edrdg](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | 低(JSON) | grade 欄可直接產常用/人名/教育漢字分級 |
| **KRADFILE / RADKFILE** | 漢字↔部件雙向 | CC BY-SA 4.0 | ✅ 署名 | [edrdg](https://www.edrdg.org/krad/kradinf.html) | 低 | 部首查字、手寫輔助 |
| **davidluzgouveia/kanji-data** | 整合 JSON：strokes/grade/freq/JLPT新舊/WK level | **MIT** | ✅（最寬鬆） | [github](https://github.com/davidluzgouveia/kanji-data) | 低 | **最省事且避開 BY-SA 傳染**的漢字 metadata |
| scriptin/kanji-frequency | 漢字頻率（文學/新聞/維基分語料） | CC BY 4.0 | ✅ 署名 | [github](https://github.com/scriptin/kanji-frequency) | 低 | 比 KANJIDIC2 單欄頻率細緻 |
| scriptin/topokanji | 部件依存「拓樸排序」學習順序 | MIT（可選） | ✅ | [github](https://github.com/scriptin/topokanji) | 低 | 排卡片路徑用 |
| kanjialive/kanji-data-media | 漢字 + 筆順 MP4 + 部首 SVG + 音檔 | CC BY 4.0 | ✅ 署名 | [github](https://github.com/kanjialive/kanji-data-media) | 中 | MP4 大、僅 ~N5–N3 |
| 常用 / 人名用漢字表 | 官方字表 | **公有領域**（日著法§13 政府告示） | ✅ | bunka.go.jp / moj.go.jp | 低 | 建議直接用 KANJIDIC2 grade 帶出 |
| AnimCJK / makemeahanzi | 動畫筆順 SVG | Arphic + LGPL | ⚠️ copyleft；**部分中國筆順** | [github](https://github.com/hy2k/animCJK) | 高 | **不建議**：react-native-svg 不支援內嵌 CSS 動畫，且中日筆順有別 |

### 2.3 Furigana 逐字對位

| 資源 | 提供什麼 | 授權 | 商用 | 取得 | 整合難度 |
|---|---|---|---|---|---|
| **JmdictFurigana** (Doublevil) ⭐ | 詞彙級逐字 furigana（`ruby`+`rt`），正確處理熟字訓 | CC BY-SA 4.0 | ✅ 署名（作者明確表態可商用） | [github](https://github.com/Doublevil/JmdictFurigana) | **低**：JSON 已是 ruby/rt，drop-in |
| kuromoji.js（+ RN fork） | 執行期對任意句分詞產 furigana | Apache-2.0 | ✅ | [RN fork](https://github.com/CharlesCoeder/react-native-kuromoji) | 中：需打包 ~12MB 字典 |
| kuroshiro | furigana/romaji 高階封裝 | MIT | ✅ | [github](https://github.com/hexenq/kuroshiro) | 中：透過 kuromoji 載字典 |
| NDL huriganacorpus | 國會圖書館書誌 furigana（morpheme 級） | CC BY 4.0 | ✅ 署名 | [github](https://github.com/ndl-lab/huriganacorpus-ndlbib) | 中：書名來源，補 reading 覆蓋 |

> **策略**：閃卡多為**已知詞彙** → JmdictFurigana 查表是最佳離線解（純查表、無需執行期分詞）。任意句即時標注才需 kuromoji + 打包字典。

### 2.4 例句語料

| 資源 | 提供什麼 | 授權 | 商用 | 取得 | 備註 |
|---|---|---|---|---|---|
| **Tatoeba**（文字句） ⭐ | 多語例句 + 日英對譯；日語 ~249,008 句 | CC BY 2.0 FR | ✅ 署名 | [downloads](https://tatoeba.org/en/downloads) | **無 ShareAlike，不污染 App 授權**；句無 furigana 需自分詞 |
| Tanaka Corpus | 日英例句對，**附 word-level 索引** | PD / CC-BY / CC BY-SA | ✅ | [edrdg](http://edrdg.org/wiki/index.php/Tanaka_Corpus) | word-level 索引降低逐字對位工 |
| Tatoeba 音檔 | 例句朗讀 | **逐檔不同** | ⚠️ 須逐筆讀 license 欄（空白者禁站外用） | downloads | 須過濾再下載 |
| JESC / OpenSubtitles | 字幕平行語料 | CC BY-SA（僅標註層） | ⚠️→❌ **底層字幕受原片版權** | — | **商用避免** |
| JParaCrawl | 大規模日英平行語料 | NTT 自訂 | ❌ **僅研究** | — | **完全避開** |

### 2.5 JLPT 分級

| 資源 | 提供什麼 | 授權 | 商用 | 取得 | 備註 |
|---|---|---|---|---|---|
| **tanos.co.uk**（Jonathan Waller） ⭐ | N1–N5 單字/漢字/**文法**表（JLPT 分級祖宗來源） | **CC BY**（明示可商用） | ✅ 署名 + 連結 | [tanos](http://www.tanos.co.uk/jlpt/) | 連 jisho.org 都用這份；唯一乾淨可商用 |
| **open-anki-jlpt-decks** (jamsinclair) | tanos 衍生，**附現成 CSV/JSON** | **MIT** | ✅ | [github](https://github.com/jamsinclair/open-anki-jlpt-decks) | **最易整合**的 JLPT 字彙骨架 |
| wkei/jlpt-vocab-api | JLPT 單字，**附現成 SQLite** | 無 LICENSE（資料源 tanos） | ⚠️ 署名 Waller | [github](https://github.com/wkei/jlpt-vocab-api) | 已做好 SQLite，最貼 op-sqlite |
| stephenmk/yomitan-jlpt-vocab | JLPT 標籤**已對應 JMdict ID** | CC BY-SA 4.0 | ✅ 署名 + SA | [github](https://github.com/stephenmk/yomitan-jlpt-vocab) | 綁定 JMdict ID 對串接有價值 |
| JLPT 官方 (jlpt.jp) | — | — | ❌ **不提供任何詞表** | [jlpt](https://www.jlpt.jp/e/faq/index.html) | 2010 後所有分級皆非官方推測 |

### 2.6 詞頻表（版權重災區，逐筆標風險）

| 資源 | 來源語料 | 授權 | 商用 | 備註 |
|---|---|---|---|---|
| **TUBELEX-JA** (naist-nlp) ⭐ | YouTube 字幕（學術級口語） | **詞頻表 BSD-3** | ⚠️→✅ 署名（全文不公開、詞頻列表有釋出） | **現代口語詞頻最友善選項** |
| **wareya/jpstats** ⭐ | VN/網路小說/小說 | **CC0** | ✅ 零限制 | Innocent Corpus 的乾淨替代 |
| **wordfreq**（日語） | 維基+字幕+Web | 程式 Apache / 資料 CC-BY-SA | ✅ 署名（**已封存 SUNSET**，定格 2021） | 當「內部排序」降 SA 疑慮 |
| Wikipedia jawiki 頻率 | 維基（底層合法） | CC BY-SA | ✅ 署名 + SA | 偏書面語 |
| BCCWJ | NINJAL 平衡語料 | 研究/教育 | ⚠️ **商用須發信 NINJAL 申請** | 品質最佳但卡授權 |
| **Innocent Corpus** | 5000+ 盜版小說 | 無授權 | ❌ **極高風險** | **絕對避免** |
| **JPDB / Netflix / Anime / 字幕詞頻** | 私有服務 / 版權字幕 | 無授權 | ❌ 高風險（部分 repo 已 404 下架） | 排名可內部參考，**勿散布檔案** |
| H-corpus | 成人腳本 | 無授權 | ❌ 高風險 + 內容敏感 | — |

### 2.7 Pitch Accent（灰色地帶 — 見 [§6.1](#61-pitch-accent-灰色地帶)）

| 資源 | 提供什麼 | 授權 | 商用 | 備註 |
|---|---|---|---|---|
| **Kanjium** (mifunetoshiro) | word→accent，124,137 詞 | 自稱 CC BY-SA 4.0 / GitHub 偵測 NOASSERTION | ⚠️ **來源未公開、疑源自付費辭典** | 規模最大但**商用風險最高**（agent 間判斷分歧，見 §6.1）|
| **UniDic accType** ⭐ | 詞典內 accent type 欄 | GPL-2.0 / LGPL / **BSD-New** | ✅（選 BSD，**版權最乾淨**） | [unidic](https://clrd.ninjal.ac.jp/unidic/en/) ／ [lite](https://github.com/polm/unidic-lite)；**商用最穩 pitch 來源** |
| **tdmelodic** (PKSHA) | NN **機器估計** Tokyo accent | 碼 BSD-3 / accent 機器生成 | ⚠️ 較佳（詞表繼承 NEologd） | [github](https://github.com/PKSHATechnology-Research/tdmelodic)；想自建「無辭典版權」資料時用 |
| Yomitan NHK/三省堂 pitch | pitch 條目 | 衍生付費辭典 | ❌ **不可** | 最準但商用禁 |
| OJAD / Suzuki-kun（東大） | ~9000 名詞 + 活用 accent | 學術/教育，**禁營利** | ❌ **不可**（爬蟲違條款） | 最權威但商用不可碰 |

### 2.8 活用 / 去活用（多為純規則演算法，通常無版權問題）

| 資源 | 提供什麼 | 授權 | 商用 | RN | 備註 |
|---|---|---|---|---|---|
| **kamiya-codec** (fasiha) ⭐ | **活用 + 去活用**，零相依 TS | **Unlicense**（公眾領域） | ✅ 無條件 | ✅ 純 TS | **最契合 RN**；唯一同時支援去活用 |
| jv-conjugator | 多種動詞活用形 | ISC | ✅ 署名 | ✅ 純 TS | npm 安裝即用 |
| Yomitan japanese-transforms.js | 最完整去活用規則 | **GPL-3.0** | ⚠️ 傳染 | 中 | **讀懂後重寫**（演算法無版權） |
| JapaneseVerbConjugator | 10 種活用 | BSD | ✅ | ❌ Python | 僅離線預生成/參考 |

### 2.9 文法（版權重災區 — 見 [§6.3](#63-文法重災區)）

| 資源 | 提供什麼 | 授權 | 商用 | 備註 |
|---|---|---|---|---|
| **tanos.co.uk 文法表** ⭐ | JLPT N5–N1 文法清單 + 例句 + MP3 | **CC BY** | ✅ 署名 + 連結 | **唯一明確可商用的 JLPT 文法來源**；格式老舊需轉檔 |
| Wiktionary / Wikibooks 文法 | 助詞/文法條目/教學章節 | CC BY-SA 4.0 | ✅ 署名 + SA | 高：非結構化、非 JLPT 分級 |
| Hanabira | N5–N1 文法 JSON | 碼 MIT / 內容自稱 in-house | ⚠️ 高風險：自承參考市售教科書 | 技術低、法律存疑 |
| fluent-jp / Grammar-Dictionaries / bunpou | N5–N1 文法 JSON | repo 掛 MIT/GPL | ❌ **內容 scrape 自版權教科書（DoJG、どんなときどう使う、Imabi、Tae Kim）** | 版權重災區典型 |
| Tae Kim / Imabi / Bunpro / JLPT Sensei | 文法教學 | NC-SA / All Rights Reserved / 專有 | ❌ 不可 | NC 與專有皆商用禁區 |

> 經多輪搜尋**查無任何 CC0 / public-domain 的 JLPT 文法點資料集**——文法類一律落在「無授權」或「CC BY-SA / NC」。

---

## 3. 媒體素材（音檔 / TTS / 筆順動畫）

### 3.1 發音音檔

| 資源 | 提供什麼 | 授權 | 商用 | 離線 | 備註 |
|---|---|---|---|---|---|
| **Lingua Libre** ⭐ | 母語者單字/短句語料庫 | CC0 / CC-BY / CC-BY-SA（錄者選） | ✅（CC0 最乾淨） | ✅ | **最推薦的 CC 批次音檔來源**；可批次匯出 |
| **Shtooka / SWAC** | 母語者單字+短句 | 多為 CC-BY | ✅ 署名 | ✅ | 資料較舊，需對應單字 |
| Wikimedia Commons / Wiktionary | 單字發音 ogg | CC BY-SA / CC0 | ✅ | ✅ | 涵蓋率低、檔名需清洗 |
| Tatoeba audio | 例句朗讀 | 逐檔不同 | ⚠️ 逐筆過濾 license 欄 | ✅ | 空白授權者禁用 |
| **Forvo API** | 最大單字發音庫 | 專屬商業 | ⚠️ **禁快取、連結 2hr 失效** | ❌ | **與離線 App 架構衝突，建議排除** |
| **JapanesePod101 包** | 課程級音檔 | 站方專有，僅付費 | ❌ 流傳的 anki pack = 未授權散布 | ⚠️ | 商用高侵權風險 |

### 3.2 TTS 引擎

| 資源 | 提供什麼 | 授權 | 商用 | 離線 | 備註 |
|---|---|---|---|---|---|
| **expo-speech** ⭐ | 呼叫 OS 系統 TTS（ja-JP） | MIT | ✅ | ✅ | **MVP 首選**：零成本、開箱即用；品質依 OS 語音包 |
| react-native-tts | 同上，bare RN 更多控制 | MIT | ✅ | ✅ | Expo 整合差，通常優先 expo-speech |
| **piper-plus** (ayutaz) ⭐ | 開源神經 TTS（含日語）+ iOS xcframework/CoreML | **MIT**（唯一無 espeak 依賴） | ✅ | ✅（~38MB 模型） | **離線高品質升級路徑**；RN 需自寫 native bridge |
| OpenJTalk | 經典離線合成 + 韻律 | BSD（引擎）/ 音聲各異 | ⚠️ 部分音聲受限 | ✅ | C 函式庫，整合工高；常作 G2P |
| espeak-ng | 極輕量 G2P | **GPL-3.0** | ⚠️ 傳染 | ✅ | 音質機械；fallback 用 |
| VOICEVOX | 高品質角色 TTS | 引擎 LGPL / **角色各有規約** | ⚠️ 逐角色掛 credit，免 credit ¥400k/角色 | ⚠️ | 行動端跑引擎吃力；**MVP 不建議** |
| Coqui TTS | 開源神經 TTS | MPL-2.0 | ⚠️ **公司 2024 已收，無維護** | ✅ | 無官方日語高品質模型 |
| Google / Azure / Polly / ElevenLabs | 雲端高品質 | 商業 API（付費） | ✅ | ❌（Polly/11Labs 可存產出 MP3 離線播） | 須後端代理金鑰；Polly 最划算 |

### 3.3 筆順動畫 / 圖

| 資源 | 提供什麼 | 授權 | 商用 | 備註 |
|---|---|---|---|---|
| **KanjiVG** ⭐ | 每筆 SVG | CC BY-SA 3.0 | ✅ 署名 + SA | 日語筆順事實標準；react-native-svg 直渲 |
| strokesvg | 手寫風筆順（Klee One） | SIL OFL | ✅ 署名字體 | 教寫字情境佳 |
| **@jamsch/react-native-hanzi-writer** ⭐ | hanzi-writer 的真正 RN 移植 | MIT | ✅ | **筆順渲染最佳起點**；餵 KanjiVG path 即可畫日文 |
| hanzi-writer（原版） | 筆順動畫 + quiz | MIT | ⚠️ 預設中國筆順 | 為 Web 設計，RN 需 WebView；**不建議** |
| makemeahanzi | 字形 + 中位線 | LGPL/Arphic | ⚠️ 中國筆順 + Arphic | 日文不建議 |
| WaniKani 助記 | 角色化助記 | **All Rights Reserved** | ❌ ToS 禁複製 | 需書面授權 |

---

## 4. 現成牌組 / 字表

> **核心法律前提**：個別「單字+讀音」屬語言**事實**（不受著作權）；但「**收錄哪些字、按什麼課別順序**」屬出版社**彙編著作權**，例句/英譯/插圖更明確受保護。**已證實出版社執法**：The Japan Times（Genki/Quartet 下架）、くろしお出版（Tobira 反盜版聲明）。

### 4.1 Anki 牌組 / 詞頻 core

| 牌組 | 內容 | 授權 | 商用 | 媒體版權陷阱 |
|---|---|---|---|---|
| **open-anki-jlpt-decks** ⭐ | JLPT N5–N1 純單字（無教科書例句） | **MIT**（源自 tanos） | ✅ | **目前最乾淨可商用骨架**；附 CSV/JSON |
| Japanese Core 2k/6k/10k | 2k–10k 字 + 例句 + 音檔 | 無授權（底層 iKnow） | ❌ | 例句/音檔源自 iKnow + JapanesePod101 |
| JLPT Tango N5–N1 | 各 1k–2.8k 字 + CD 音檔 | 無授權（出版品） | ❌ | 例句/音檔翻拍《単語スピードマスター》 |
| **Kaishi 1.5k** | 1.5k 字 + 音檔 + 音高圖 | **repo 無 LICENSE** | ❌ | **看似開放實則繼承全部上游版權**（Core/Tango + AJT 音源）|
| Refold JP1K | 1k 卡 + native audio | 付費商品 $29.99 | ❌ | 預載 = 轉售他人商品 |
| RTK / KanjiDamage | 漢字排序 | Heisig 版權 / **KanjiDamage CC BY-NC-SA** | ❌/⚠️ | NC 禁商用 |

### 4.2 教科書字表（商用全為 ❌）

みんなの日本語、げんき Genki、Quartet、Tobira、新完全マスター — **全著作權保留**，「按課別組織」即觸彙編著作權，GitHub 的 MIT 只授權程式碼、**無權對教科書內容再授權**。Genki/Quartet 已遭 The Japan Times 強制下架；Tobira 已發反盜版聲明。

### 4.3 漢字清單

| 清單 | 授權 | 商用 | 備註 |
|---|---|---|---|
| 常用 / 人名用 / 教育漢字 | **公有領域**（政府告示） | ✅ | KANJIDIC2 grade 欄即逐年級分配 |
| 漢検（Kanken）各級 | 協會主張版權 | ⚠️ 級別編排受保護 | 可從公有清單**重建**（10–5級≈学年配当、2級≈常用） |
| RTK（Heisig） | 全保留（排序+keyword） | ❌ | kanji-koohii 明文「不及於衍生作品」 |
| WaniKani 排序/部首 | 全保留 | ❌ | Terms 禁營利重製 |
| **KANJIDIC2** ⭐ | CC BY-SA 4.0 | ✅ | **最佳乾淨來源** |

### 4.4 分級閱讀 / Graded Content

| 資源 | 授權 | 商用 | 備註 |
|---|---|---|---|
| **青空文庫**（PD 作品） | 公眾領域 | ✅ | 歿於 1967 前確定 PD；需解析青空格式 + 判版權旗標 |
| Tatoeba | CC BY 2.0 FR | ✅ | 最乾淨例句源（音檔逐筆查）|
| 日文 Wikipedia | CC BY-SA 4.0 | ⚠️ SA 傳染 | **無 Simple 版**；建議只當查證來源 |
| NHK NEWS WEB EASY | NHK 版權 | ❌ | 明文禁轉載 |
| Tadoku 讀本 | **CC BY-NC-ND** | ❌ | ND 禁拆解成卡片 |
| Satori Reader / JPLANG / Marugoto | 專有 / NC-ND / 全保留 | ❌ | 商用皆不可 |

### 4.5 .apkg 匯入（技術）

`.apkg` 本質是 **ZIP**：內含 SQLite（`collection.anki2/.anki21/.anki21b`，2.1.50+ 起 zstd 壓縮）+ `media` JSON 對照 + 數字命名媒體檔。

- **RN 正解**：`fflate` 解 ZIP → 內部 SQLite 寫沙箱 → `op-sqlite` 直接讀。**完全不需 sql.js/WASM**。
- **建議架構**：**不要在 App 執行期解析任意 .apkg**，改在 build/後端把（合法授權的）來源 ETL 成自家 schema 預載，避開 zstd/protobuf/schema 版本地獄。後端可用 Node `anki-apkg-parser` 或 Python `ankisync2`。

---

## 5. 套件 / 函式庫 / API

> **前置紅線**：Hermes 無執行期 WASM（[hermes#429](https://github.com/facebook/hermes/issues/429) 仍 OPEN）。RN 0.84「WASM 支援」指 Callstack Polygen 的 **build 階段 wasm2c AOT**，非瀏覽器式 runtime WASM。

### 5.1 斷詞

| 套件 | RN 端 | 給讀音？ | 授權 | 備註 |
|---|---|---|---|---|
| TinySegmenter | ✅ 純 JS | ❌ 僅切詞 | New BSD | ~25KB 零字典 |
| budoux (Google) | ✅ 純 JS | ❌ 僅斷句 | Apache-2.0 | 換行美化用 |
| **@patdx/kuromoji** / **@charlescoeder/react-native-kuromoji** ⭐ | △ 需打包 ~12MB 字典 | ✅ | Apache-2.0 | **唯一裝置端能給讀音**；RN fork 維護薄 |
| Lindera (wasm) | ❌ Hermes 無 WASM | ✅ | MIT | 須過 Polygen 預編 |
| MeCab / Sudachi / Janome / fugashi | ❌ 僅 server | ✅ | Apache/GPL | 後端用 |

### 5.2 Furigana 生成

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **jmdict-furigana 資料查表** ⭐ | ✅ 純 JS | CC BY-SA 4.0 | **最佳離線解**（已知詞查表，免裝置分詞） |
| kuroshiro + analyzer | △ 字典載入 | MIT | 任意句即時標注 |
| react-furi / react-native-furi | ✅（只渲染不算音） | MIT | 對位邏輯可參考；RN 建議自寫 ruby 疊排 |

### 5.3 羅馬字 / 假名

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **wanakana** ⭐ | ✅ 純 JS | MIT | **本類首選**，零相依，週下載 ~70k；`isKanji/isKana` 判斷 |

### 5.4 辭典查詢

| 套件/API | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **jmdict-simplified（資料）→ op-sqlite FTS5** ⭐ | ✅ build 轉 SQLite | CC BY-SA 4.0 | **離線辭典首選**；用 common 版控體積 |
| @scriptin/jmdict-simplified-types | ✅ 純型別 | MIT | 直接給 TS 用 |
| Jisho.org 非官方 API | ❌ 僅 server | 無正式授權 | 限流嚴、商用勿依賴 |
| Jotoba (jotoba.de) | ❌ 可自架 | AGPL-3.0 | 自架有開源義務 |

### 5.5 翻譯

| API | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **react-native-mlkit-translate** ⭐ | △ 原生模組 | MIT / ML Kit | **唯一裝置端離線翻譯**；品質一般、不能 Expo Go |
| DeepL / Google Translate | ❌ 僅 server | 商業 | App 不可直打金鑰，須後端代理 |
| LibreTranslate | ❌（主機可離線） | AGPL-3.0 | 對外服務需開源 |

### 5.6 Pitch Accent（套件）

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **kanjium 資料 + hatsuon + react-native-svg 自畫** ⭐ | ✅ 純 JS | 資料 CC BY-SA / hatsuon MIT | 100% 離線；overline 無現成 RN 元件需自寫（難度低） |
| @birchill pitch-accent（10ten） | △ HTML 渲染 | MIT 系 | 資料邏輯可參考 |

> 商用請用 §2.7 的 **UniDic accType（BSD）** 取代 kanjium 資料源。

### 5.7 筆順渲染（套件）

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **@jamsch/react-native-hanzi-writer** ⭐ | ✅ 純 JS | MIT | v1.2.0 / 2025-11；餵 KanjiVG 畫日文 |
| **svg-path-properties** ⭐ | ✅ 純 JS 零相依 | ISC | 算 path 長度 → strokeDasharray 動畫關鍵；週下載 ~184k |
| react-native-kanji-animation | ✅（2020 停更） | MIT | 參考技法別依賴 |

### 5.8 SRS / 排程

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **ts-fsrs** ⭐已用 | ✅ 純 JS | MIT | v5.4.1，零相依官方核心，**續用** |
| @open-spaced-repetition/binding | ❌ 僅 server | MIT | 參數最佳化放後端 |
| fsrs-browser | ❌ Hermes 無 WASM | BSD-3 | 不可直跑 |

### 5.9 資料庫 / ORM

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **@op-engineering/op-sqlite** ⭐已用 | △ 原生模組 | MIT | v16.2，RN 最快，**續用** |
| **drizzle-orm** ⭐ | ✅ 純 JS | Apache-2.0 | **官方支援 op-sqlite driver**，型別安全；建議加入 |
| expo-sqlite | △ 原生模組 | MIT | SDK 56 內建，可當 Drizzle driver |
| WatermelonDB | △ 原生模組 | MIT | 自帶 sync；**維護放緩** |
| RxDB | △ 原生模組 | Apache（部分付費） | **生產級 SQLite 儲存屬 Premium** |
| react-native-quick-sqlite | △ | MIT | **已棄用，勿用新專案** |

### 5.10 匯入 / 解析

| 套件 | RN 端 | 授權 | 備註 |
|---|---|---|---|
| **fflate** ⭐ | ✅ 純 JS | MIT | **.apkg 解壓首選**，~8kB 零相依 |
| fast-xml-parser / sax | ✅ 純 JS | MIT/BlueOak | 解原始 JMdict XML（用 JSON 則免） |
| sql.js | ❌ Hermes 無 WASM | MIT | 已有 op-sqlite，無需 |
| anki-apkg-parser | ❌ 僅 server | ISC | schema 參考用 |

### 5.11 TTS（套件）

見 [§3.2](#32-tts-引擎)：MVP 用 **expo-speech**，離線升級 **piper-plus**。

---

## 6. 授權地雷專章

### 6.1 Pitch accent 灰色地帶

> **⚠️ Agent 間判斷分歧 — 已查證並採最嚴謹結論**：媒體/套件 agent 把 Kanjium 當「✅ CC BY-SA 4.0 可商用」；但內容 agent 查到作者在 GitHub issue **自承來源「因潛在版權問題不便公開、來自 2–3 個正當來源」**，社群普遍認為那 124,137 筆 accent 整理自 NHK/三省堂/大辞泉等**付費辭典**。

- **CC 標籤無法漂白上游版權**：若資料本身無權被以 CC 釋出，下游商用仍有風險。
- **商用結論**：Kanjium 當**高風險灰色地帶**；改用 **UniDic accType（BSD-New，版權最乾淨）** 或 **tdmelodic（NN 機器估計，無辭典版權）**。
- **絕對禁區**：任何 NHK/三省堂/大辞泉/大辞林衍生的 Yomitan pitch 詞典；OJAD 爬取（明示禁營利）。
- **非商用/個人**：Kanjium 廣泛使用、可放心。

### 6.2 詞頻重災區

底層是有版權第三方創作的詞頻表（Innocent Corpus 盜版小說、Netflix/anime 字幕、JPDB scrape、H-corpus）**商用內嵌法律風險高**，即使社群流通也一樣。**乾淨替代**：TUBELEX-JA（BSD）、jpstats（CC0）、Wikipedia 頻率（CC BY-SA）、申請後的 BCCWJ。技巧：把頻率當**內部排序計算**而非散布原檔，可降 SA 疑慮。

### 6.3 文法重災區

最危險模式：**repo 掛寬鬆授權（MIT/GPL），但文法內容 scrape 自版權教科書或 All-Rights-Reserved 網站**。已查證 `Grammar-Dictionaries` 直接抓取 **DoJG（A Dictionary of Japanese Grammar）** 與 **どんなときどう使う文型辞典**；下游（fluent-jp 等）全繼承侵權風險。MIT 標頭只能授權作者**自己擁有的程式碼**。**唯一乾淨可商用 = tanos.co.uk（CC BY）**。

### 6.4 教科書 / 牌組嵌入媒體

字表「骨架」風險低，但**嵌入媒體（音檔/例句/英譯/插圖）幾乎全是地雷**。**Kaishi 1.5k 特別危險**：社群常當「現代開放牌組」推薦，實際 repo 無 LICENSE、衍生自 Core/Tango + AJT 音源（NHK/JapanesePod101/Forvo）。教科書字表受彙編著作權且已有執法前例。

### 6.5 CC BY-SA ShareAlike 的真義（最常見誤解）

- EDRDG 系列（JMdict/KANJIDIC2/JmdictFurigana）、KanjiVG、Kanjium 全是 **CC BY-SA**。
- **ShareAlike 只感染「資料/SVG 本身的衍生」，不傳染到你的 App 程式碼**（CC 不是 GPL 式軟體 copyleft）。把資料原樣放進更大軟體屬「mere aggregation」，**不強制整支 App 開源**。
- 義務是：(a) 在 App **選單可進入的「關於/來源」頁**署名（只放啟動畫面不合規）；(b) 你**再散布的衍生資料檔**須維持同 CC BY-SA。
- **KanjiVG 實務界線**：**不修改原始 SVG、照實署名即安全商用**；一旦改寫 SVG/path（重切、改自家動畫格式），那份衍生資料須以 CC BY-SA 3.0 散布。

### 6.6 Hermes 無 WASM（技術紅線）

`sql.js`、`lindera-wasm`、`fsrs-browser`、任何 runtime `WebAssembly.instantiate()` 的套件**裝置端不可直跑**（除非過 Callstack Polygen build 階段預編，工程量大）。離線斷詞/解析要嘛純 JS（kuromoji JS fork、fflate、wanakana、ts-fsrs），要嘛 build 階段預處理。

### 6.7 Arphic / 中國筆順陷阱

AnimCJK / makemeahanzi 用 Arphic copyleft 字型（1999 版可商用、2010 版限非營利，須認版本），且 react-native-svg 不支援其 SVG 內嵌 CSS 動畫；makemeahanzi 約 1/3 漢字是中國字形/筆順，與日語不同。**筆順一律用 KanjiVG，不要用 AnimCJK/makemeahanzi**。

---

## 7. 整合優先序 Roadmap

> 對應 PROPOSED_PLAN.md（本機規劃日誌）的三階段。所有可商用資料一律在 **build 階段離線 ETL 成 op-sqlite `.db` 隨 App 打包**，runtime 只查表，避免 RN 端大型 JSON 解析。

### Phase 1 — MVP 內容地基（換掉所有 mock）

目標：用真實資料替換 `db/seed.ts` 與 `data/mockKanjiVG.ts`，跑出可複習的 JLPT 分級閃卡。

1. **辭典骨幹**：jmdict-simplified `eng-common`（1.4MB）→ ETL 成 `notes`（kanji/reading/gloss/pos）。
2. **逐字 furigana**：JmdictFurigana → 直接填 `notes.kanji` 的 `[{ruby,rt}]`（**drop-in 既有格式**）。
3. **JLPT 分級**：open-anki-jlpt-decks（MIT, CSV）→ 給每張卡 `jlpt_level`。
4. **漢字資訊**：KANJIDIC2 或 kanji-data（MIT）→ `kanji` 表（grade/筆畫/音訓/部首）。
5. **筆順**：KanjiVG → 預處理 stroke path，換掉 `mockKanjiVG.ts`。
6. **發音**：expo-speech（ja-JP）即時唸，零資料成本。
7. **去活用**：kamiya-codec（Unlicense）npm 安裝。

**Schema 擴充**（現行 `notes(id,kanji,english)` 太精簡）：新增 `reading / gloss / pos / jlpt_level`，新增 `kanji` 與 `examples` 表，建議同步導入 **drizzle-orm** 管理 migration。

### Phase 2 — 站穩日文垂直

8. **例句**：Tatoeba + Tanaka Corpus（CC BY/PD）→ `examples` 表，挑含該詞的 1–2 句。
9. **pitch accent**：**UniDic accType（BSD）** 萃取 → `notes.pitch`，用 react-native-svg + hatsuon 自畫 overline（**避開 Kanjium**）。
10. **詞頻排序**：TUBELEX-JA（BSD）或 jpstats（CC0）→ 給「同級內建議學習順序」。
11. **筆順升級**：評估 @jamsch/react-native-hanzi-writer 或自寫 svg-path-properties 動畫。
12. **真人音檔**（選配）：Lingua Libre CC0 + Shtooka 批次打包補常用詞。

### Phase 3 — 生態與變現

13. **.apkg 匯入**：fflate + op-sqlite 自組流程（讓使用者匯入自己的牌組）。
14. **多裝置同步**：local-first + USN/last-write-wins（見 compass 報告 C.4）。
15. **TTS 升級**：piper-plus（MIT，離線高品質）。

### ETL 通則

- 所有來源 → 後端/build 腳本清洗 → 單一 `kioku.seed.db` → 打包進 App assets。
- 每個資料表記錄來源與授權，產生 App 的 Attribution 頁（見 §8）。
- 詞頻只輸出「排序分數」，不散布原始頻率檔。

---

## 8. Attribution 清單（App「關於」頁必列）

實作一個**選單可進入**的「資料來源與授權」頁，集中列出（CC BY/BY-SA 的署名與 ShareAlike 義務一次滿足）：

- **JMdict・JMnedict・KANJIDIC2・KRADFILE/RADKFILE** — © EDRDG, CC BY-SA 4.0（http://www.edrdg.org/edrdg/licence.html）
- **JmdictFurigana** — Doublevil, CC BY-SA 4.0
- **KanjiVG** — © Ulrich Apel, CC BY-SA 3.0（筆順資料）
- **Tatoeba** — CC BY 2.0 FR（例句）
- **JLPT 分級** — Jonathan Waller, tanos.co.uk, CC BY
- **UniDic** — NINJAL, BSD-New（若用於 pitch）
- **TUBELEX-JA / jpstats** — BSD-3 / CC0（若用於詞頻）
- 套件授權（MIT/Apache/Unlicense）依各 npm 套件 LICENSE。

---

## 9. 主要來源

**可商用資料源**：[jmdict-simplified](https://github.com/scriptin/jmdict-simplified)、[EDRDG 授權頁](https://www.edrdg.org/edrdg/licence.html)、[JmdictFurigana](https://github.com/Doublevil/JmdictFurigana)、[KanjiVG](https://github.com/KanjiVG/kanjivg)、[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)、[KRADFILE/RADKFILE](https://www.edrdg.org/krad/kradinf.html)、[tanos.co.uk 授權](http://www.tanos.co.uk/jlpt/sharing/)、[open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)、[kanji-data (MIT)](https://github.com/davidluzgouveia/kanji-data)、[Tatoeba](https://tatoeba.org/en/downloads)、[kamiya-codec](https://github.com/fasiha/kamiya-codec)、[UniDic](https://clrd.ninjal.ac.jp/unidic/en/)、[TUBELEX-JA](https://github.com/naist-nlp/tubelex)、[jpstats CC0](https://github.com/wareya/jpstats)、[Lingua Libre](https://lingualibre.org/wiki/Help:Download_datasets)

**乾淨套件**：[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)、[op-sqlite](https://github.com/OP-Engineering/op-sqlite)、[drizzle-orm](https://orm.drizzle.team)、[wanakana](https://github.com/WaniKani/WanaKana)、[fflate](https://github.com/101arrowz/fflate)、[@jamsch/react-native-hanzi-writer](https://www.npmjs.com/package/@jamsch/react-native-hanzi-writer)、[svg-path-properties](https://www.npmjs.com/package/svg-path-properties)、[hatsuon](https://github.com/DJTB/hatsuon)、[piper-plus](https://github.com/ayutaz/piper-plus)

**地雷佐證**：[Kanjium 來源爭議 issue](https://github.com/mifunetoshiro/kanjium)、[Kaishi repo 無 LICENSE](https://github.com/donkuri/kaishi)、[Genki/Quartet 下架公告](https://ko-fi.com/post/All-Exercises-for-GenkiQuartet-Study-Resources-Wi-R6R81M8LLN)、[Tobira 反盜版](https://tobiraweb.9640.jp/1299/)、[Grammar-Dictionaries scrape 自付費辭典](https://github.com/aiko-tanaka/Grammar-Dictionaries)、[Tadoku CC BY-NC-ND](https://tadoku.org/japanese/free-books/note/)、[Forvo 禁快取](https://api.forvo.com/documentation/general-information/)、[Hermes 無 WASM #429](https://github.com/facebook/hermes/issues/429)

---

*本目錄由四組平行研究 agent 海巡彙整（2026-06）。下一步見 [§7 Roadmap](#7-整合優先序-roadmap)，Phase 1 可立即動工替換 mock 資料。*
