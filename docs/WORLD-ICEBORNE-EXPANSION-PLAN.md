# 擴充計畫：新增 Monster Hunter World: Iceborne 配裝搜尋（多遊戲架構）
> 本文件是給實作 agent 的完整規劃書。開工前必讀 repo 根目錄 `CLAUDE.md`（禁區 §0、
> 工作協議 §5 全部適用於本計畫）。本計畫的最高原則：**Rise 現有行為零改變**。
> 每個 Phase 結束必須附「當下真實工具輸出」作為佐證，無佐證的宣稱不算完成。
---
## 0. 目標與範圍
- 在現有專案內以「Game Profile 抽象層」支援第二款遊戲 **MHW: Iceborne（最終版 15.2x，資料已凍結）**。
- Rise 走原路徑、結果逐位元一致（以回歸基準驗證，見 Phase 1）。
- World 第一版範圍：防具 / 武器 / 裝飾珠 / 技能 / 護石 五類資料 + 搜尋 + EFR 排序 + 基本 UI。
- **第一版不做**：覺醒武器（皇金/赤龍）逐能力模擬、客製強化模擬、推薦配裝 tab 的 World 版
  （比照傀異鍊成哲學：先以「手動輸入結果值」替代，或直接留待 Phase 6+）。
### 禁區（延伸自 CLAUDE.md §0）
- `searchBuilds` 演算法本體行為不得改變。所有 World 專屬邏輯必須經由 profile 注入或
  資料層差異表達；Rise profile 下的程式路徑行為必須與現況一致。
- schema 擴充一律「加欄位、保留舊欄位、舊資料不動」；不得改寫 `src/data/*.json`（Rise 資料）。
- 每個 Phase 獨立 commit（可多個），commit 只到本地 `main`，不 push（人類親手 push）。
---
## 1. 機制差異總表（Rise → World，決定所有工作項）
| 系統 | Rise（現況） | World: Iceborne | 處理方式 |
|---|---|---|---|
| 護石 | 隨機護石 + 護石庫（使用者輸入） | 固定可生產清單（攻擊護石Ⅲ 等，無孔） | 護石改為「資料驅動的第六件裝備」進候選池 |
| 套裝技能 | 極少，且為逐件技能（風紋一致），現引擎可算 | 真髓/加護 set bonus：2/3/4/5 件門檻觸發技能，meta 核心 | 新增 `SetBonus` 資料 + skill-calculator 判定步驟 |
| 技能上限 | 靜態（skills.json maxLevel） | 動態：「○之力解放」觸發後上限提升（攻擊 4→7 等） | `skillMax` 改為可依已觸發 set bonus 動態解析 |
| 裝飾珠 | 一顆一技能 | Lv4 複合珠：單技能 Lv2 或雙技能各 Lv1 | `Decoration.skills: SkillMap` 擴充 + solver 支援 |
| 百龍孔/百龍技能 | 有 | 無 | profile 功能開關關閉 |
| 傀異鍊成 | 有（簡化輸入） | 無；對應客製強化/覺醒 | 第一版關閉，World 後續可加「簡化輸入」等價物 |
| 斬味 | 7 色帶 base/max（匠插值） | 同為 7 色帶，匠 +10/等（max +50） | 結構沿用；插值步進由 profile 決定 |
| 攻擊力顯示 | Kiranico 顯示值（膨脹） | 顯示值同樣膨脹（各武器種倍率不同） | 沿用「同武器種內比較用顯示值」假設，資料源需統一取 display |
| EFR 技能數值 | efr.ts 內 Rise 逐級表 | 全部數值不同（攻擊 Lv4 起含 %、挑戰者等級表不同…） | 新增 `efr-world.ts`，同介面 |
| 護石支配剪枝 | 依 EFR_RELEVANT_SKILLS 剪隨機護石 | 無隨機護石，剪枝無意義 | profile 開關；World 下停用（不改 Rise 路徑） |
---
## Phase 0 — 資料源盤點與選型（先驗證，再開工）
World 有比爬 Kiranico 更好的結構化資料源，但**覆蓋度必須先實測**，不可假設。
候選（依優先序）：
1. **MHWorldData（gatheringhallstudios/MHWorldData，GitHub）**
   - MHWorld Database App 的上游資料庫：CSV 原始檔 + build 出 SQLite。
   - 已知含防具/武器/技能/珠子/護石/套裝加成，且**內建多語系欄位**（含中文）——
     若中文欄位齊全，可一次解決繁中譯名問題，是首選。
   - 取用方式：clone repo 或抓 raw CSV（`raw.githubusercontent.com` 在允許網域內）。
2. **mhw-db.com API**
   - 免費 JSON API：`/armor`、`/armor/sets`（含 setBonus ranks）、`/weapons`
     （attack.display/raw、durability 逐匠等級斬味）、`/decorations`、`/charms`、`/skills`。
   - 缺點：英文名，需另建中文映射；Iceborne 後期資料（煌黑期）覆蓋度需查證。
3. **Kiranico MHWorld（mhworld.kiranico.com）**
   - 備援/交叉稽核源 + 中文名映射源；爬取模式可沿用 `import-kiranico.mjs` 經驗
     （磁碟快取、2.5s 禮貌間隔）。
### 任務
- [ ] 對 1、2 各做覆蓋度抽查：防具總數、M 位防具是否含 γ 套、武器是否含煌黑龍武器、
      Lv4 複合珠是否存在、set bonus 是否結構化、護石清單是否完整、中文名欄位覆蓋率。
- [ ] 產出 `docs/world-data-source-audit.md`：抽查數字 + 選型結論 + 落差清單。
- [ ] 決策規則：主源取「結構化程度最高者」，中文名不足處以第二源建映射，
      人工裁決一律進 override 檔（延續「絕不手改產出檔」原則）。
### 驗收
- 稽核文件存在且含真實抽查輸出（筆數、範例 JSON/CSV 片段），非推測。
- 交叉核對至少 3 筆已知實體：煌黑龍防具、剛刃・攻擊珠（或任一雙技能 Lv4 珠）、攻擊護石Ⅲ。
---
## Phase 1 — Schema 擴充 + Rise 回歸基準（不改行為）
### 1a. 先建回歸基準（動 schema 之前）
- [ ] 寫 `scripts/regression-baseline.mjs`：以固定的 8–10 組搜尋條件
      （涵蓋：固定武器/搜尋武器、必要技能多寡、保留洞位、排除清單、護石有無）
      呼叫 `searchBuilds`，將完整結果（build id 序列 + 每套 EFR 分數 + 珠子配置）
      序列化存到 `scripts/.regression/baseline.json`。
- [ ] 之後每個 commit 跑 `node scripts/regression-baseline.mjs --check`，
      逐位元比對；不一致即該 commit 不合格。
### 1b. 型別擴充（`src/types/build.ts`）
全部為**新增選填欄位**，不動既有欄位：
```ts
// Decoration：複合珠支援。舊欄位保留，skills 未提供時由舊欄位推導。
export type Decoration = {
  id: string;
  nameZh: string;
  slotLevel: SlotLevel;
  skillName: string;      // 保留（Rise 相容 / 單技能珠主技能）
  skillLevel: number;     // 保留
  skills?: SkillMap;      // 新增：完整技能表（複合珠必填）
  craftable: boolean;
};
// ArmorPiece：套裝加成歸屬
export type ArmorPiece = {
  // ...既有欄位不動...
  setBonusId?: string;    // 新增
};
// 新型別：套裝加成
export type SetBonus = {
  id: string;
  nameZh: string;         // 例：銀火龍的真髓
  ranks: Array<{
    pieces: number;       // 件數門檻（2/3/4/5）
    skillName: string;    // 觸發技能（例：真・會心擊【屬性】）
    skillLevel: number;
  }>;
};
// Skill：技能解放
export type Skill = {
  // ...既有欄位不動...
  secretMaxLevel?: number;    // 新增：解放後上限（例：攻擊 7）
  secretUnlockedBy?: string;  // 新增：解放它的技能名（例：攻擊之力解放）
};
// Charm 固定清單模式（World）：Charm 既有型別已含 id/name/skills/slots，
// 不需改；World 的護石 slots 一律 []。
```
- [ ] `SetBonus` 的解放/真髓清單**必須由資料源機械推導**（skills 描述 + set ranks），
      不得憑記憶硬編（KNOWN_MAX 的教訓：硬編 26 條錯 13 條）。
### 1c. 資料層改造
- [ ] `src/data/` 重組為 `src/data/rise/`（搬移既有檔，內容逐位元不變；git mv）
      與 `src/data/world/`（Phase 2 產出）。import 路徑更新。
- [ ] `game-data.ts`：`loadGameData(gameId: GameId)`，per-game 快取（`Map<GameId, GameData>`）。
- [ ] `data.ts`：小資料（skills/decorations/weaponTypes/setBonuses）同樣依 gameId 提供；
      `decorationsBySkill` 索引改為遍歷 `skills ?? {skillName: skillLevel}`，
      對 Rise 資料輸出必須與現況完全相同（用回歸基準驗）。
### 1d. Game Profile
新增 `src/lib/game-profile.ts`：
```ts
export type GameId = "rise" | "world";
export type GameProfile = {
  id: GameId;
  labelZh: string;                      // 破曉 / Iceborne
  efr: EfrModule;                       // efr-rise.ts / efr-world.ts（同介面）
  charmMode: "talisman-library" | "craftable-list";
  features: {
    rampage: boolean;                   // rise: true / world: false
    qurioAugment: boolean;              // rise: true / world: false
    charmDominancePruning: boolean;     // rise: true / world: false
    setBonus: boolean;                  // rise: false / world: true
    secretSkills: boolean;              // rise: false / world: true
  };
  storagePrefix: string;                // "mhsb." / "mhwib."
  resolveSkillMax(skill: string, activeSetBonusSkills: SkillMap): number;
};
```
- [ ] Rise profile 的每個開關值必須使現有路徑**完全等價於今日行為**。
### 驗收（Phase 1 整體）
- `npm run build` 乾淨通過（停 dev server + `rm -rf .next` 後）。
- `regression-baseline.mjs --check` 通過（附輸出）。
- Rise 站上手動抽查 2 組搜尋，結果與改造前截圖一致。
---
## Phase 2 — World 匯入管線（`scripts/world/`）
比照既有管線慣例：磁碟快取（gitignore）、override 檔、獨立稽核腳本、產出檔不手改。
- [ ] `scripts/world/import-world.mjs`
      → 產出 `src/data/world/{armors,weapons,decorations,skills,charms,setBonuses,weaponTypes}.json`，
      schema 同 Rise + Phase 1 新欄位。要點：
  - 武器攻擊取 display 值；斬味由 durability（匠 0～5）轉為既有 `{base, max}` 7 色帶格式
    （base = 匠0、max = 匠5），weapons.json 沿用 compact 一物件一行。
  - 珠子：單技能珠填舊欄位 + `skills`；複合珠 `skills` 為雙技能、
    舊欄位填第一技能（僅相容用途）。
  - 護石：展開為逐等級一筆（攻擊護石Ⅰ/Ⅱ/Ⅲ 各一筆，World 慣例為取最高級，
    但保留低級供早期階段限裝）。
  - 防具：γ 套必須含入；`setBonusId` 由 armor set 資料建立。
- [ ] `scripts/world/build-zh-name-map.mjs`：中文名映射
      （主源中文欄位優先；缺漏走第二源；人工裁決進 `scripts/world/zh-name-overrides.json`）。
- [ ] `scripts/world/audit-world-data.mjs`：稽核（獨立外部源交叉，非同源自查）：
  - 總數 sanity：防具/武器/珠子/技能/護石各類筆數 vs 已知社群統計（差異 >2% 需解釋）。
  - `secretMaxLevel`/set bonus 抽 10 筆對 Kiranico World 詳細頁核對。
  - 中文名覆蓋率報告（未映射清單輸出成檔）。
### 驗收
- 稽核腳本輸出全綠或落差有書面解釋；`docs/world-data-source-audit.md` 更新最終筆數。
---
## Phase 3 — 引擎差異點（本計畫最高風險區，最小侵入）
三個改動點，每個獨立 commit、每個 commit 後跑 Rise 回歸：
1. **skill-calculator：set bonus + 動態上限**
   - [ ] 累加流程改為：逐件累加技能 → （profile.features.setBonus 時）統計 setBonusId 件數
         → 觸發達門檻的 rank 技能併入 → 以 `profile.resolveSkillMax` 截斷。
   - [ ] Rise profile 下此新步驟不執行，輸出與現況一致（回歸驗證）。
2. **decoration-solver：複合珠**
   - [ ] 求解時以 `skills ?? {skillName: skillLevel}` 為珠子效果；
         複合珠對「必要技能」的貢獻按實際等級計。
   - [ ] 注意 `decorationsBySkill` 排序鍵（覆蓋效率）對複合珠的定義：
         以「目標技能的等級」排序，另一技能視為附贈，不參與排序。
3. **護石作為候選裝備（world charmMode = craftable-list）**
   - [ ] `equipment-pools.ts` 在 world 下由 `charms.json` 建護石候選池
         （與防具同樣走相關度裁切，limit 建議先取 12，觀察後調）；
         Rise 下維持現有「使用者護石庫」路徑不動。
   - [ ] 護石支配剪枝依 profile 開關停用（不動 `EFR_RELEVANT_SKILLS` 本體）。
### 驗收
- Rise 回歸逐位元通過（三個 commit 各附輸出）。
- World 冒煙測試：手動指定「煌黑龍武器 + 必要技能 攻擊7/超會心3/弱點特效3」，
  搜尋器應在無人工提示下組出含煌黑套 4 件（觸發轉禍為福 + 攻擊之力解放）的結果。
  這是 set bonus + 動態上限 + 複合珠三者的整合驗收。
---
## Phase 4 — `efr-world.ts`
- [ ] 與 `efr.ts` 同介面（`computeEfr` / `EFR_RELEVANT_SKILLS` / 斬味倍率表）。
- [ ] 所有逐級數值**從 Phase 2 匯入的 skills.json 描述機械抽取或逐條對源核對**，
      逐條附來源；不確定的條件技能觸發率沿用 `CONDITIONAL_UPTIME = 0.75` 慣例。
- [ ] 必含：攻擊（Lv4+ 含 %）、看破、弱點特效（World 需分傷口/非傷口——第一版可假設
      有傷口計滿並註記）、超會心、匠、屬性強化與屬性上限（World 有屬性值上限規則，
      第一版可先不建模上限、註記於 docs）、挑戰者、無傷、力量解放、拔刀術【技】、
      死裡逃生等條件技；set bonus 觸發技（真・會心擊【屬性】等）納入 relevant set。
- [ ] `docs/efr-world-notes.md`：列出所有近似假設（比照 Rise 的做法）。
### 驗收
- 單元自測腳本：3 組手算範例（純物理 / 屬性 / 條件技混合）與函式輸出一致。
---
## Phase 5 — UI 與持久化
- [ ] 遊戲切換：URL `?game=world`（與 `?tab=` 同步機制併存），頂欄下拉或雙鈕切換。
- [ ] localStorage：world 用 `mhwib.*` 前綴，兩款遊戲狀態互不污染；
      分享連結（share-link）序列化需帶 gameId。
- [ ] world 模式：隱藏百龍/傀異/護石庫面板；護石改為選單（可固定/排除，同防具邏輯）；
      結果卡顯示 set bonus 觸發狀態（例：「銀火龍的真髓 ×4 → 真・會心擊【屬性】」）
      與解放後上限（攻擊 5/7 這類分母變化）。
- [ ] 圖示：沿用 MHW_Icons_SVG（本來就是 World 圖示，零工作量）；
      rarity 徽章配色改用 World 的 R1–R12 區間（`rarity.ts` 依 profile 給色表）。
### 驗收
- 乾淨 build 通過；兩款遊戲來回切換 UI 狀態互不遺失；Rise 回歸最後再跑一次全綠。
---
## Phase 6（後續，本次不做，先立牌）
- World 推薦配裝 tab：複製 `scrape-game8.js` → `scripts/world/scrape-game8-mhwi.js`
  + validate 管線；階段劃分改為「下位 / 上位 / M位前期 / 畢業（煌黑期）」。
- 覺醒武器與客製強化的簡化輸入（比照傀異鍊成 UI 哲學）。
- 屬性值上限（屬性強化 vs 武器屬性 cap）納入 EFR。
---
## 整合驗收清單（全部完成才算收工）
1. `regression-baseline.mjs --check` 全綠（附最終輸出）。
2. 乾淨 `next build` 通過（停 dev server、清 `.next`）。
3. World 冒煙五連測（每筆附結果卡截圖或序列化輸出）：
   - 煌黑畢業裝整合測試（見 Phase 3 驗收）。
   - 銀火龍屬性弓/雙刀：必要「真・會心擊【屬性】」→ 引擎應自動湊 4 件銀火龍γ。
   - 龍紋（Safi）3 件觸發測試：真・龍脈覺醒出現於結果卡 set bonus 區。
   - 複合珠驗證：搜出的配裝中出現雙技能 Lv4 珠且技能累計正確。
   - 護石驗證：結果中的護石來自 charms.json 且可被固定/排除。
4. 首屏 bundle 未因 world 資料變大（world JSON 必須同樣走動態 import 獨立 chunk；
   附 build 輸出的 chunk 尺寸對照）。
5. 文件：README 新增 World 章節（資料源、已知近似、未實作清單）、
   CLAUDE.md 增補本計畫產生的新裁決（如有）。
## 給 agent 的執行守則（重申）
- 依 Phase 順序做，**每 Phase 結束停下來回報 + 附佐證**，不可跨 Phase 連做後補報告。
- 任何「對不上」先分類：名稱差異 vs 真的缺（用顆數/等級收支鑑別）。
- 人工判斷一律進 override 檔；重跑匯入必須是安全的。
- 遇到本文件與實測衝突時：實測為準，把衝突寫進 docs 並回報，不要沉默繞過。
