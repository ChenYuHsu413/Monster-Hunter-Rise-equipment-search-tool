# HANDOFF — 換機接續開發交接

> 給接手的新機器 session。先讀本檔快速定位，深入的裁決與教訓在 `CLAUDE.md`（repo 根）。
> 最後更新：2026-07-10。本輪移除「流派 preset」下拉與 `/guide` 新手引導模式（A1/A2 兩 commit，
> 本地已 commit、尚未 push）。

## 1. 專案現況

MHR: Sunbreak 破曉配裝網站（Next.js 14 / React 18 / TypeScript）。雙 Tab：**推薦配裝**
（Game8 各階段實戰配裝）＋**配裝器**（以「選技能 + 選武器」驅動、EFR 排序搜尋、護石清單、
可分享連結、可匯入推薦配裝）。

> ⚠️ 本輪（2026-07-10）移除「流派 preset」下拉與 `/guide` 新手引導模式——兩者定位與推薦配裝
> 頁籤重疊。配裝器主軸回歸「選技能 + 選武器」。刪除面：`BuildPresetSelector.tsx`、
> `buildPresets.json`、`guide.ts`、`app/guide/page.tsx`、`data.ts` 的 preset 存取層、`build.ts`
> 的 `BuildPreset/PresetTier/TIER_MAX_RARITY/ResolvedSkillConditions`、`preset-resolver.ts` 的
> `resolvePresetSkills`、`SkillRequirementEditor` 常用技能改凍結硬編、`page.tsx` 的 `/guide` 入口。
> **搜尋引擎（`build-search`/`equipment-pools`/`efr`）完全未動**；其 `autoRules/maxRarity/
> preferElement/progress` 能力欄位現已無 caller 但屬禁區保留（見 §2 禁區）。

### 四階段完成摘要（本輪工作主軸）

| 階段 | 內容 | 關鍵 commit |
|---|---|---|
| ① 資料管線 | Game8 推薦配裝離線爬蟲（14 武種×6 類 → 542 builds）、日文名對照、override 架構、A/B 二擇一 schema、孤兒歸零、KNOWN_MAX 全表稽核 | `fea258d` `27af757` `2c69930` `ede1a9b` `e62f3f8` `6761d44` `1d15d35` |
| ② 配裝器重構 | 移除評分/偏好系統、護石清單制、EFR 三鍵排序、單一 SearchConditions state、可分享連結（不含護石） | `ec14a36` |
| ③ 雙 Tab 推薦頁 | `?tab=` 雙 Tab 殼（keep-mounted）、推薦配裝三形態卡片 UI、Game8 三階呈現 | `d4687ea` |
| ④ 匯出+互動+Worker | **commit 0** skills.json 7 條 maxLevel 修正（`61bff75`）→ A+B+C 匯出/鎖排/可搜尋技能選擇器（`b88fa7b`）→ D 搜尋移入 Web Worker（`5adf738`）→ 拋光+文件（`3bd7365`） |

> **commit 0（`61bff75`）** 是四階前置的資料修正：匯出稽核時發現 7 條技能 maxLevel 被我方低估
> （弱點特效【屬性】2→3、狂化 1→2 等），比照 KNOWN_MAX 稽核線核 Kiranico 效果表後修正。

### 其他已完成的大型工作線（非本輪，但屬同專案）

- **解放條件資料層**：`unlocks.json` 5544 件全覆蓋（confirmed/inferred/unverified
  三層信心度）、`import-unlocks.mjs` + 多輪社群回報修正（`f4081af`…`9f2309f`、`bcea90b`）。
  詳見 `docs/ROADMAP.md`、`docs/DATA-COVERAGE.md`。**原以此運作的 `/guide` 新手引導模式已於
  2026-07-10 移除；資料層（`unlocks.json` + `unlocks.ts`）與搜尋引擎 progress 篩選能力保留，目前無 UI caller。**
- **武器派生樹**：`derive-weapon-trees.mjs`，14 武種 757 樹全覆蓋、74 筆門檻傳播回寫（`5c9100b`）。
  詳見 `docs/WEAPON-TREE-DERIVATION-TODO.md`。

## 2. 關鍵裁決速查（新 session 動工前先讀）

**推薦配裝 schema 三形態**（真相源＝`scripts/scrape-game8.js` 的 `SCHEMA_DOC`，顯示端型別
`src/types/recommended.ts`）：
- `full-build`＝5 件成套+護石+`skillTotals`，匯出＝核心技能+護石預選。
- `armor-pieces`＝單件推薦、`slot=null`、無技能總表，匯出＝反查部位鎖定單件。
- `weapon-list` / `kinsect-list`＝純武器/獵蟲。
- 名稱一律存**專案內部 ID**（skills 的 id＝繁中名字串），對不到時 `id` 省略、顯示端 fallback
  `rawNameJa` 加警告樣式。`alternatives`＝A/B 二擇一（顯示「A 或 B」）；`placeholder:true`＝
  屬性佔位珠（顯示「對應屬性珠」）；`free`＝留空洞。

**B′ 匯出語意**（`src/lib/builder-import.ts`，詳見 README「推薦配裝匯出到配裝器」節）：
- 核心技能排序 `紅字優先 → 等級÷maxLevel 比值 → 等級 → Game8 原順序`，取前 **N=4**（校準值）。
- 排除 `special` 技能（錬成/狂竜化衍生，搜尋器無法重現）並在提示點名。
- 等級取 `level`（錬成前基礎值），**非 `augmentedLevel`**（錬成後總值，照匯會無解）；clamp 到 skillMax。
- reco 護石標 `source:"reco"`、每次 full-build 匯入取代舊 reco、保留自有護石。

**禁區（不得改行為）**：`efr.ts` 的 `EFR_RELEVANT_SKILLS`、`equipment-pools.ts` 候選集 limit
邏輯、`searchBuilds` 演算法本體；`scripts/` 與頂層 `data/` 唯讀（例外＝授權的資料修正走稽核線）。

> 移除 preset/guide 後，下列為**無 caller 但刻意保留**的引擎通用能力（型別/元件處均有註解，
> 勿因 grep 無 caller 誤判為死碼）：`BuildSearchRequest.autoRules/maxRarity/preferElement/progress`、
> `PresetAutoRules` 型別、`preset-resolver.ts` 的 `resolveAutoSkills/resolveAutoSkillsFromElement/
> mergeMaxSkills/elementSkillMap`、`BuildResultCard` 的 autoSkills 顯示分支、`unlocks.ts` 全體。

## 3. 待辦尾巴

**本輪已收掉（勿重做）**：
- ✅ special 技能未匯入時提示點名（`3bd7365`）。
- ✅ B′ 匯出語意文件化——寫在 **README**（`3bd7365`）；刻意不進 `SCHEMA_DOC`（那是資料形態的
  真相源，匯出是配裝器行為，放進去是類別錯置）。

**仍待辦**：
- ⏳ **production 環境抽測**：`npm run build && npm start` 後，抽測 Web Worker 搜尋（含 50 顆護石
  不凍結、可取消）與推薦配裝頁 2.4MB JSON 的 code-split 載入。目前只在 dev（3006）驗過；
  worker 的 `new Worker(new URL(...))` 已確認 build 通過，但 production chunk 實跑未抽測。
- ⏳ 武器派生樹 295 筆可疑邊界影片抽驗（`docs/WEAPON-TREE-DERIVATION-TODO.md`）。
- ⏳ inferred 解放條目人工校驗升 confirmed、特殊解放套裝標註（`docs/DATA-COVERAGE.md` 待補清單）。
  （原「guide 泛用鏈/屬性鏈引導」待辦隨 `/guide` 移除作廢。）
- ⏳ 發布 Part 2：英文 README / Reddit 未做（巴哈文使用者說暫緩）。
- 🔹 `migrateLegacyConditions`（舊 localStorage 一次性遷移）日後可考慮移除。

## 4. 新機器環境重建

```bash
# 1. Node：本機開發用 v18.20.8（package.json 未鎖 engines；Next 14.2.35 需 Node >=18.17）
node -v            # 確認 >= 18.17

# 2. 相依
npm install        # node_modules 不備份，靠這裝回

# 3. 開發 / 建置
npm run dev        # localhost:3006（.claude/launch.json 的 mhsb-dev）
npm run build && npm start   # production 抽測（見待辦）

# 4. 資料管線重跑（需要時；順序固定）
node scripts/build-jp-name-map.js          # Kiranico ja 列表 → jp-name-map
node scripts/scrape-game8.js               # Game8 → data/recommended-builds.json
node scripts/validate-recommended-builds.js
node scripts/audit-known-max.mjs           # KNOWN_MAX 對 Kiranico 效果表核對
```

**快取說明**：`scripts/.cache`（Kiranico ja 列表+技能詳細頁）、`scripts/.game8-cache`（Game8 文章
84 頁）、`scripts/.kiranico-cache`（Kiranico 裝備詳細頁 5544 件，import-unlocks 用）皆 **gitignore**。
快取**在**＝重跑零抓取；快取**缺**＝腳本會禮貌重抓（2.5s 間隔，Game8 84 頁約數分鐘、Kiranico 5544
頁很久）。已把三個快取備份到 `D:\claude-backup\cache\`——新機器把它們放回 `scripts/` 對應目錄即免重抓。

**破曉已停更（TU5 為最終版）**，資料凍結，管線通常不需重跑，除非改 override 或補資料。
