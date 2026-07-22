# World 推薦配裝來源盤點（Game8 MHW，Phase 6 Task A）

> Phase 6（World 推薦配裝 tab）動工前的來源實測。所有數字為 2026-07-22 對 game8.co
> MHW Iceborne 各武器種 build 頁的**實測抽查**（快取於 `scripts/world/.game8-mhwi-cache/`，
> gitignore）。與 Rise 的 Game8 管線（`scrape-game8.js`）差異逐條列於第五節。

---

## 一、來源與 URL 結構

- **來源＝game8.co（英文 Game8）的 MHW 區**，每武器種一頁「Best {Weapon} Builds for Iceborne」。
  （Rise 管線爬的是**日文** Game8／Altema，名稱走 `jp-name-map`；World 走英文頁，名稱走
  MHWorldData `name_en`——見第四節。）
- URL 格式：`https://game8.co/games/Monster-Hunter-World/archives/{id}`。14 武器種 id：

| 武器種 | id | 武器種 | id |
|---|---|---|---|
| great-sword | 314144 | switch-axe | 314805 |
| long-sword | 314083 | charge-blade | 314812 |
| sword-and-shield | 314170 | insect-glaive | 314855 |
| dual-blades | 314162 | bow | 314871 |
| hammer | 314192 | light-bowgun | 314934 |
| hunting-horn | 314231 | heavy-bowgun | 314965 |
| lance | 314772 | gunlance | 314799 |

- base-game（下位/上位，非 Iceborne）另有 `Best Builds for {W} (Base Game)`（315xxx）與
  `Best Progression Builds for Low Rank/High Rank`（313887）——**本次不納入**（World 第一版
  聚焦 Iceborne MR，比照 Rise 推薦頁只做畢業/進度階段）。

## 二、頁面結構（parser 設計依據）

heading 驅動（不依版型），每頁：
- `<h2 class='a-header--2' id='hl_N'>` ＝**階段區塊**：`{W} Endgame Meta Build` / `{W} Meta Builds` /
  `{W} Progression Build`（外加 `Best {W} Weapons and Skills`、`Best Counter Builds`、
  `Related Guides` 等**非配裝**區塊，靜默略過）。
- `<h2>` 下的 `<h3 class='a-header--3' id='hm_N'>` ＝**單一配裝名**（如 Full Fatalis Armor Build）。
- 每個 build 下接數張 `<table>`：
  1. **Weapon 表**（表頭 `Weapon | Decorations`）：武器名 + 武器珠。
  2. **Armor 表**（表頭 `Armor | Decorations`）：**5 列防具（依位置＝head/chest/arms/waist/legs，
     首欄部位 label 不可靠，用列序）** + 末列 `Charm | 護石名`。每列附該部位裝飾珠（可多顆）。
  3. **Skills 表**：2 欄一列的技能對（`Critical Eye 7 | Agitator 7`…）。
- 裝備名為**英文**且用 `Alpha +/Beta +/Gamma +`（MHWorldData 用 `α+/β+/γ+`）、
  珠名如 `Attack Jewel+ 4`、`Critical/Protection Jewel 4`（複合珠斜線分隔）、護石 `Challenger Charm V`。

## 三、覆蓋度（實測，僅計 Meta/Progression 區塊下的真實配裝）

| 武器種 | 配裝數 | meta | progression | Safi 依賴 | Kjarr 依賴 |
|---|---|---|---|---|---|
| great-sword | 7 | 4 | 3 | 1 | 0 |
| long-sword | 8 | 5 | 3 | 3 | 0 |
| sword-and-shield | 8 | 5 | 3 | 2 | 0 |
| dual-blades | 11 | 8 | 3 | 4 | 2 |
| hammer | 8 | 5 | 3 | 3 | 0 |
| hunting-horn | 9 | 6 | 3 | 3 | 0 |
| lance | 7 | 4 | 3 | 2 | 0 |
| gunlance | 10 | 7 | 3 | 3 | 0 |
| switch-axe | 8 | 5 | 3 | 3 | 0 |
| charge-blade | 9 | 6 | 3 | 3 | 1 |
| insect-glaive | 8 | 5 | 3 | 2 | 0 |
| bow | 14 | 11 | 3 | 10 | 2 |
| light-bowgun | 8 | 5 | 3 | 3 | 0 |
| heavy-bowgun | 9 | 6 | 3 | 2 | 0 |
| **合計** | **124** | **82** | **42** | **44（35%）** | **5（4%）** |

- **每武器種恰有 3 筆 progression**（Starter Iceborne / Early Iceborne / Mid-Late Iceborne），
  其餘為 meta（含 1 筆 Endgame Meta 旗艦，通常 Fatalis）。
- **依賴未模擬系統的佔比**：Safi 覺醒武器 **35%**、Kjarr 自帶技武器 **4%**；bow 最重（10/14 用 Safi，
  屬性弓 meta 幾乎全靠 Safi/Kjarr 覺醒屬性）。**客製強化（custom augment）**在 meta 武器上近乎普遍
  （攻擊/會心強化），但 Game8 表格多未逐條列出，屬**隱性依賴**——一律以「含客製強化」旗標保守標示。

## 四、名稱映射策略（Game8 EN → 專案 id）

- **防具**：`armors.json` 的 `nameEn` 欄即 MHWorldData `name_en`（`Dragonhead α+`）。Game8
  `Dragonhead Beta +` → 正規化 `Beta +`→`β+`、`Alpha +`→`α+`、`Gamma +`→`γ+`、去空白，比對 `nameEn`。
- **武器**：同理走 `weapons.json` 的 `nameEn`（`Black Fatalis Blade` 直接吻合）。
- **裝飾珠 / 護石**：產出 JSON **無 EN 名**，但 id ＝ `wdeco_{mhwdId}` / `wcharm_{mhwdId}`；
  由 `.cache/mhwd/{decorations,charms}__*_base*.csv`（含 id + `name_en`）建 EN→id 映射
  （實測 `Attack Jewel+ 4`、`Attack Charm III` 與 Game8 命名吻合）。
- 對不上者**先分類**（顯示名差異 vs 真的缺，用技能/顆數收支鑑別），差異進
  `scripts/world/game8-en-overrides.json` 逐筆附出處（延續 Rise「人工裁決進 override」原則）。

## 五、與 Rise `scrape-game8.js` 的差異（不可照抄，需新解析器）

| 面向 | Rise（日文 Game8/Altema） | World（英文 Game8） |
|---|---|---|
| 語言/名稱源 | 日文名 → `jp-name-map.json`（`normalizeJa`） | 英文名 → MHWorldData `name_en` |
| 套裝機制 | 百龍孔/百龍技能表、傀異錬成欄 | **無百龍/傀異**；改為 set bonus（由防具件數觸發，引擎已模擬） |
| 防具列 | 部位 label 驅動 | **列序驅動**（label 不可靠，位置＝5 部位） |
| 技能表 | 發動技能總表（含紅字 required/augmentedLevel） | 2 欄技能對；無傀異 augmentedLevel |
| 未模擬系統 | special（狂化/業鎧等錬成衍生） | **Safi 覺醒能力 / Kjarr 自帶技 / 客製強化** |
| 階段 taxonomy | 下位/上位/畢業/M位前期… | 見下（實測收斂為 3 階） |

## 六、階段 taxonomy（實測收斂，PLAN↔實測衝突點名）

- **PLAN 建議**：「下位 / 上位 / M位前期 / 畢業（煌黑期）」。
- **實測**：Game8 MHW 的 Iceborne build 頁**只有** `Endgame Meta` + `Meta` + `Progression`
  （progression 內部再分 Starter / Early / Mid-Late 三筆），**沒有**下位/上位分階（base-game
  builds 在另外的 315xxx 頁，本次不做）。→ **實測為準，收斂為 3 階**：
  - `worldEndgame`（畢業旗艦 meta，通常 Fatalis；每武器 1 筆）
  - `worldMeta`（其餘畢業 meta：Velkhana/Raging Brachy/Safi/屬性等）
  - `worldProgression`（Starter / Early / Mid-Late Iceborne，每武器 3 筆）
- Rise 的 5 階類別（`riseLow`…`mrEndgame`）不套用於 World；World 用上列 3 個新 category。
- **A2 追加 `worldHighRank`（base-game 上位）**：見「六之三」。Iceborne 三階不動。

## 六之二、驗證與匯入校準（Task C，`scripts/world/validate-mhwi-builds.mjs`）

### skillTotals 重算 vs Game8 宣稱
用我方資料（防具技能 + 珠 + 護石 + set bonus，動態上限 clamp）重算每套 → 對 Game8 宣稱：
- **99/124 套 ±1 相符**；25 套有 >1 級差，分類：
  - **10 套**：覺醒/Kjarr 未模擬武器貢獻（我方重算 < Game8，如 long-sword_worldMeta_2 攻擊 2 vs 7
    來自 Safi「Attack Increase」覺醒能力）——**非資料錯，屬引擎不模擬**（已打 unmodeled 旗標）。
  - **15 套**：主因 **Game8 per-slot 珠標註不全**——例 hammer_worldEndgame_0 有 14 洞但 Game8 只列
    13 顆珠、且無任何超會心珠，卻於 skillTotals 宣稱超會心 3。**印證 CLAUDE.md「Game8 孔位標註
    不可信、skillTotals 才是權威」**。少數為我方防具技能欄小差（±1~2）。
- **結論**：無系統性我方資料錯。匯入一律取 **skillTotals（權威）** 的核心技能，不依 per-slot 珠重算，
  故匯入穩健。

### 核心技能 N 校準（10 筆畢業裝，top-N → World 搜尋有無結果）
- **N=3 / 4 / 5 / 6 皆 10/10 有結果**。World 因 set bonus + secret 解放 + 洞位充足，核心技能匯入
  **不受結果數約束**（與 Rise 不同——Rise N=6 掉到 5/10）。
- **裁決：World `WORLD_CORE_SKILL_COUNT = 5`**（Rise 的 N=4 為 Rise 資料校準，實測不可照抄）。
  取 5 兼顧「匯入接近該套識別度」與「全數樣本仍有結果」；clamp/ratio 用 **World `resolveSkillMax`
  含該套 set bonus 的動態上限**，故 secret 延伸級（挑戰者7、精神抖擻5）得以保留為必要技能。

## 六之三、A2：base-game 上位（worldHighRank）+ 下位缺源點名

- **來源**：`Best Builds for {W} (Base Game)` 各武器種頁（14 頁；GS=314993，其餘 315xxx；
  id 表見 `scrape-game8-mhwi.mjs` 的 `BASE_PAGES`）。頁面結構與 Iceborne 頁**相同**（Weapon 表 /
  Armor 表 5 件+護石 / Skills 表），沿用同一 parser；只換 `categoryOfBase`（h2 認「{W} Best Builds」
  → `worldHighRank`，Best Skills/Related Links 略過）。
- **★ PLAN↔實測衝突點名（實測為準）**：任務原設「下位/上位」兩 category，**實測 Game8 MHW
  base-game 各武器種頁的 build 全為上位（HR）**——14 頁 55 筆，逐套解析後其防具 rarity **一律 8**
  （Nergigante/Kulve/Drachen 級 HR 畢業裝）。**零下位（LR）全配裝**：
  - base-game 頁**無** Low Rank / Beginner / Starter 任何 h2 區塊（14 頁機械掃描皆空）。
  - 標題「Best Progression Builds for **Low Rank/High Rank**」（313887）實為**純導覽 hub**
    ——僅 3 張連結表、零 build 表；各武器 H3 段內 0 tables。
  - 別無 LR 全配裝頁（僅「Beginner's Guide/Best Weapons for Beginners」等散文導引，非 build 表）。
  - 成因＝MHW 下位裝即用即棄，社群不出下位全配裝。**裁決（經確認）：A2 只落 `worldHighRank`；
    `worldLowRank` 因來源無資料不建立**（非漏做）。
- **名稱新落差（已進 override）**：Game8 拼字 `Kulve Taroth's Malic β/γ`（漏 e）＝MHWorldData
  `Malice β/γ`（warmor_662 / warmor_776）。其餘沿用 Phase 6 override；base-game 新增 0 筆未解
  （殘 2 筆 `Adept Stormslinger`/`Buff Arms Alpha+` 皆 Phase 6 既有 Iceborne meta 落差，非 A2 引入）。
- **N 校準（worldHighRank 獨立抽驗 10 筆）**：`validate-mhwi-builds.mjs` calibrateN() →
  **N=3/4/5 皆 10/10 有結果**、N=6 掉到 9/10（switch-axe/Paralysis Evasion 零結果）。
  上位裝洞位/技能較畢業略簡，但 **`WORLD_CORE_SKILL_COUNT = 5` 仍 10/10 適用**（沿用畢業值，
  無須為上位另設 N）。
- **UI**：`WORLD_STAGE_CATEGORY_ORDER` 改實力遞增序 **上位→進度→meta→畢業旗艦**
  （`worldHighRank`→`worldProgression`→`worldMeta`→`worldEndgame`）；空 category 不渲染。
  端到端抽驗：大劍上位卡「以此為基礎修改」→ 搜尋得「前 100 套 · 有效組合 20981」（HR 防具結果）。

## 七、結論

- 來源可用、結構穩定、覆蓋 14 武器種：Iceborne **124 筆** + A2 base-game 上位 **55 筆** = **179 筆**。
- **35% 配裝依賴 Safi 覺醒、4% 依賴 Kjarr、meta 普遍隱含客製強化**——這些**不丟棄**，
  Task B 完整保留並打 `awakened`/`kjarr`/`customAugment` 結構化旗標，供 UI 標示與匯入時排除
  （引擎不模擬這些系統，硬匯入必零結果——比照 Rise 對 special 技能的「排除並點名」哲學）。
- 名稱映射走 MHWorldData `name_en`，人工裁決進 `game8-en-overrides.json`（重跑安全）。
