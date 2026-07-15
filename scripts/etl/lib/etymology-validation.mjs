// vocab_etymology 資料驗證規則（apply 與 verify 共用，單一事實來源）。

// 枚舉值＝畫面徽章文字，一律日文（與 App 的日文 UI 一致）；只有 note／explanation 提供繁中＋英文雙語。
export const ORIGIN_TYPES = ['音変化', '意味変化', '漢語', '複合語', '派生語', '外来語', 'オノマトペ'];
export const CONFIDENCE_LEVELS = ['定説', '有力説', '一説', '俗説'];

// 純ひらがな＋長音符。stage 的 reading 可為 null（外語原詞、中古漢語等無假名讀音時），非 null 則必須符合。
const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

// 台灣繁中檢查用：gloss/說明中絕不該出現的常見簡體字抽樣。
const SIMPLIFIED_CHARS = /[国语时给东说话汉发历级读写体门问间见观点风电这为么]/;

const MIN_STAGES = 2;

/** カタカナ→ひらがな正規化（外來語詞條 reading 比對用）。 */
export const toHiragana = (text) =>
  text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

/**
 * 驗證單筆詞源資料。回傳錯誤訊息陣列（空陣列＝通過）。
 * @param entry {{origin_type, evolution: {stages}, explanation_zh, confidence, source}}
 * @param vocabReading 詞條的 reading（用於核對演化鏈最末段）
 */
export const validateEtymologyEntry = (entry, vocabReading) => {
  const errors = [];

  if (!ORIGIN_TYPES.includes(entry.origin_type)) {
    errors.push(`origin_type 非法值：${entry.origin_type}`);
  }
  if (!CONFIDENCE_LEVELS.includes(entry.confidence)) {
    errors.push(`confidence 非法值：${entry.confidence}`);
  }
  if (entry.source !== null && (typeof entry.source !== 'string' || entry.source.trim() === '')) {
    errors.push('source 須為 null 或非空字串');
  }
  if (entry.source_url !== null && !/^https:\/\/\S+$/.test(entry.source_url ?? '')) {
    errors.push(`source_url 須為 null 或 https URL：${entry.source_url}`);
  }
  if (entry.source_url !== null && entry.source === null) {
    errors.push('有 source_url 時 source 名稱不可為 null');
  }

  if (typeof entry.explanation_zh !== 'string' || entry.explanation_zh.trim() === '') {
    errors.push('explanation_zh 不可為空');
  } else if (SIMPLIFIED_CHARS.test(entry.explanation_zh)) {
    errors.push(`explanation_zh 含簡體字：${entry.explanation_zh.match(SIMPLIFIED_CHARS)[0]}`);
  }
  if (entry.explanation_en != null && (typeof entry.explanation_en !== 'string' || entry.explanation_en.trim() === '')) {
    errors.push('explanation_en 須為 null 或非空字串');
  }

  const stages = entry.evolution?.stages;
  if (!Array.isArray(stages) || stages.length < MIN_STAGES) {
    errors.push(`evolution.stages 須為長度 >= ${MIN_STAGES} 的陣列`);
    return errors;
  }

  for (const [i, stage] of stages.entries()) {
    if (typeof stage.form !== 'string' || stage.form.trim() === '') {
      errors.push(`stage[${i}].form 不可為空`);
    }
    if (stage.reading !== null && !HIRAGANA_ONLY.test(stage.reading ?? '')) {
      errors.push(`stage[${i}].reading 須為 null 或純ひらがな：${stage.reading}`);
    }
    if (typeof stage.period !== 'string' || stage.period.trim() === '') {
      errors.push(`stage[${i}].period 不可為空`);
    }
    if (stage.note !== null && (typeof stage.note !== 'string' || stage.note.trim() === '')) {
      errors.push(`stage[${i}].note 須為 null 或非空字串`);
    }
    if (stage.note_en != null && (typeof stage.note_en !== 'string' || stage.note_en.trim() === '')) {
      errors.push(`stage[${i}].note_en 須為 null 或非空字串`);
    }
    if ('period_en' in stage) {
      errors.push(`stage[${i}] 不應有 period_en（period 一律日文、不做雙語）`);
    }
  }

  const lastReading = stages[stages.length - 1]?.reading;
  if (lastReading !== toHiragana(vocabReading)) {
    errors.push(`最末段 reading（${lastReading}）與詞條 reading（${vocabReading}）不符`);
  }

  return errors;
};
