import type { Scalar } from '@op-engineering/op-sqlite';
import { db } from './schema';
import { createNewCard } from '../services/fsrs';
import { fetchDeckMembers, ApiDeckMember } from '../api/contentApi';
import { getSelectedDecks } from './repositories/selectedDecksRepository';

/**
 * 範圍感知 + 增量建卡：只為「目標牌組」向雲端取成員建立本機卡片，而非一次 seed 全部。
 * 每個 (deck_id, vocab_id) 生一張卡（card id = card-{vocab_id}），並存下 intro_rank（新卡引入順序）。
 * 卡片是使用者狀態，已存在則以 INSERT OR IGNORE 略過 → 增量、可重入（不重灌複習進度）。
 *
 * 大牌組（如「専門・稀少」約 15 萬詞）以原生 executeBatch 分批寫入：INSERT 本體在原生背景執行緒執行、
 * 批次之間 await 讓出事件迴圈使 UI 可更新，不再像舊版單一同步交易長時間鎖死；
 * （每批的 commit 仍有短暫同步開銷，故大牌組可能略有頓挫，但非長時間凍結）。可選 onProgress 回報進度。
 *
 * 目標牌組解析：傳入的 deckIds 優先；未傳則取目前學習範圍（getSelectedDecks）；
 * 學習範圍為空（= 全部）時，套用預設範圍（5 個 JLPT 包），首次啟動只建約 7,965 張卡。
 *
 * 需要連到伺服器；若離線則本次不建卡（拋錯由呼叫端記錄），下次仍會重試。
 */

// 預設範圍：學習範圍未明確指定時，只 seed 5 個 JLPT 包（避免一次建立 20 萬張卡）。
const DEFAULT_SEED_DECK_IDS = ['deck-n1', 'deck-n2', 'deck-n3', 'deck-n4', 'deck-n5'];

// 每批建卡筆數：批次間讓出 JS 執行緒並回報進度，使大牌組建卡不凍結 UI。
const SEED_BATCH_SIZE = 2000;

const INSERT_CARD_SQL = `INSERT OR IGNORE INTO cards (
  id, vocab_id, deck_id, intro_rank, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// 解析本次要 seed 的目標牌組：明確傳入 → 用之；否則用學習範圍；學習範圍空 → 預設範圍。
const resolveSeedTargets = (deckIds?: string[]): string[] => {
  if (deckIds && deckIds.length > 0) return deckIds;
  const selected = getSelectedDecks();
  return selected.length > 0 ? selected : DEFAULT_SEED_DECK_IDS;
};

// 單張新卡的 INSERT 參數（FSRS 初值由 createNewCard 提供）。
const cardParams = (deckId: string, member: ApiDeckMember): Scalar[] => {
  const card = createNewCard();
  return [
    `card-${member.id}`,
    member.id,
    deckId,
    member.introRank ?? null,
    card.due.getTime(),
    card.stability,
    card.difficulty,
    card.elapsed_days,
    card.scheduled_days,
    card.reps,
    card.lapses,
    card.state,
    card.last_review ? card.last_review.getTime() : null,
  ];
};

export const ensureSelectedDeckCards = async (
  deckIds?: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> => {
  const targetDeckIds = resolveSeedTargets(deckIds);
  if (targetDeckIds.length === 0) return;

  console.log('🌱 為目標牌組增量建卡：', targetDeckIds.join(', '));
  // 各包成員平行抓回（含 introRank，已由伺服器依 intro_rank 升冪排序）。網路抓取在寫入之前完成。
  const deckMemberLists = await Promise.all(
    targetDeckIds.map((deckId) => fetchDeckMembers(deckId).then((members) => ({ deckId, members }))),
  );

  // 攤平成待建清單，再分批以原生 executeBatch 寫入。
  const pending: Array<{ deckId: string; member: ApiDeckMember }> = [];
  for (const { deckId, members } of deckMemberLists) {
    for (const member of members) pending.push({ deckId, member });
  }

  const total = pending.length;
  onProgress?.(0, total);

  for (let offset = 0; offset < total; offset += SEED_BATCH_SIZE) {
    const slice = pending.slice(offset, offset + SEED_BATCH_SIZE);
    const paramSets: Scalar[][] = slice.map(({ deckId, member }) => cardParams(deckId, member));
    // 單一 SQL + 多組參數；executeBatch 於原生端以交易批次執行（已存在的卡經 INSERT OR IGNORE 略過）。
    // INSERT 本體在原生背景執行緒，await 在批次之間讓出 → UI 可更新；每批 commit 仍有短暫同步開銷。
    await db.executeBatch([[INSERT_CARD_SQL, paramSets]]);
    onProgress?.(Math.min(offset + slice.length, total), total);
  }

  console.log(`✅ 已處理 ${total} 筆成員（已存在者經 INSERT OR IGNORE 略過）`);
};
