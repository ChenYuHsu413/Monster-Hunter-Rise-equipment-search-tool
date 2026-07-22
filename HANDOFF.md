# HANDOFF — 換機接續開發交接

> 給接手的新機器 session。先讀本檔快速定位，深入的裁決與教訓在 `CLAUDE.md`（repo 根）。
> 最後更新：**2026-07-22**。本輪完成 **World: Iceborne 擴充（多遊戲）Phase 0–6** 與**四條尾巴**
> （World 推薦分頁、期望斬味倍率、武器強化簡化輸入、複合珠 solver 有界修復）。全部已 commit
> **並 push**（`origin/main` 同步於 `463cee2`）。以下 §0 為本輪主軸，§1 起為原 Rise 專案背景。

## 0. World: Iceborne 擴充（本輪主軸，多遊戲）

Rise 專案上疊加 **MHW: Iceborne** 為第二款遊戲（同一 UI、`gameId` 切換、`key=gameId` 重掛載）。
**最高原則：Rise 現有行為逐位元零改變**，由 `scripts/regression-baseline.mjs --check`（10/10）背書；
所有 World 行為經 `deps.world` 閘門或資料層差異表達。深入裁決見 `CLAUDE.md` §6 與 `docs/WORLD-*.md`。

**抽象層**：`game-profile.ts`（EFR 模組/features/charmMode/storagePrefix/resolveSkillMax）、
`game-data.ts`（per-game 動態 import）、`data.ts`（`getGameStaticData`）、`world-registry.ts`
（動態註冊 world profile+靜態+護石池+搜尋 deps）。資料分 `src/data/rise/` 與 `src/data/world/`。
localStorage 前綴 rise `mhsb.*` / world `mhwib.*`（Rise 既有鍵一個未動）。

### 本輪 commit（新→舊，皆已 push）

| 尾巴 | 內容 | commit |
|---|---|---|
| **D 複合珠 solver** | 貪婪失敗後 gated 有界局部搜尋（偏好單珠+複合珠 seed depth≤2），字典序嚴格更優才換；Rise 逐位元不變 | `463cee2` |
| **C 武器強化簡化輸入** | 覺醒/客製強化：固定武器輸入攻擊/會心/屬性/追加洞 delta（武器淺拷貝）+ 虛擬 set bonus +1 件 | `0f8a4d6` |
| **B 期望斬味倍率** | 斬味尾巴：頂端 `EXPECTED_SHARPNESS_USE=60` 單位加權平均倍率（取代 color-only），Fatalis 匠0→5 單調上升 | `e9bce29` |
| **A World 推薦分頁** | worldHighRank（base-game 上位）+ zh EN-fallback 補齊 + World 推薦配裝 UI/匯入 | `3492708` `167ef28` `067ce71` |
| Phase 0–5 | 資料管線 `scripts/world/*`、efr-world、抽象層、UI 切換（見 `docs/WORLD-ICEBORNE-EXPANSION-PLAN.md`） | 更早 |

錨點 tag：`pre-iceborne`（回滾點）、`iceborne-v1`、`pre-phase6-world-reco`。

### 四條尾巴各自的關鍵裁決（程式碼看不出「為什麼」）

- **B 期望斬味**（`efr-world.ts` `expectedSharp`，`docs/efr-world-notes.md` §5）：匠仍在 base↔max
  插值定色帶，改「取頂色」為「頂端 60 單位依各色段長加權平均 raw/element」。`EXPECTED_SHARPNESS_USE`
  是可調校準常數（非遊戲硬常數）。**只動 `efr-world.ts`，Rise `efr.ts` 一行未動**（§0 同介面義務）。
- **C 武器強化**（`world-weapon-augment.ts` + `WorldWeaponAugmentPanel`）：僅固定武器模式。數值 delta
  由 **worker** 套進武器淺拷貝（重建 `weaponById` 覆蓋單一 id，不 mutate 共享快取；`searchBuilds`
  未改）。防禦 display-only。虛擬 set bonus 走 `computeSetBonusSkills` 選填 `extraCounts`（Rise 不傳＝
  不變）。share-link 選填帶入、舊連結無欄視為無強化。
- **D 複合珠 solver**（`decoration-solver.ts`）：`solveDecorations` = 貪婪（`greedySolve` 逐位元未改）+
  **貪婪失敗後** gated 有界修復。gate＝候選珠含覆蓋 ≥2 必要技能之複合珠（Rise 珠無 `.skills` → 恆空
  短路）。**spec↔實測衝突（實測為準）**：貪婪對單純 2-in-1 本已最優，真正次優是反方向的 (E) 過度搶
  大洞餓死大洞技能、(F) 多複合珠選錯首顆；故修復雙向。效能 +16%（≤30%）。`__setDecorationRepairEnabled`
  是 bench-only seam，生產恆 true。

### World 驗收腳本（`scripts/world/`）

`smoke-world.mjs`（引擎機制 10/10）、`test-efr-world.mjs`（斬味手算 23/23）、
`smoke-efr-integration.mjs`（Fatalis 匠 EFR 7/7）、`smoke-weapon-augment.mjs`（9/9）、
`test-decoration-repair.mjs`（複合珠修復 8/8）、`smoke-repair-realdata.mjs`（真實前後對照 5/5）、
`bench-repair-perf.mjs`（效能 +16%）、`smoke-cross-session.mjs`（跨 session A/B/C 4/4）。
**執行需 Node 24（型別剝除）**；皆自 register `scripts/regression-loader.mjs` 載 TS + `@/` alias。

---

## 1. 專案現況（Rise 背景）

MHR: Sunbreak 破曉配裝網站（Next.js 14 / React 18 / TypeScript）。雙 Tab：**推薦配裝**
（Game8 各階段實戰配裝）＋**配裝器**（以「選技能 + 選武器」驅動、EFR 排序搜尋、護石清單、
可分享連結、可匯入推薦配裝）。**現為雙遊戲**（Rise 破曉 / World Iceborne，見 §0）。

> ⚠️ 前一輪（2026-07-10）移除「流派 preset」下拉與 `/guide` 新手引導模式——兩者定位與推薦配裝
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
> **World 追加禁區**：**Rise 路徑逐位元不變是絕對底線**——動 `searchBuilds`/`decoration-solver`/
> `skill-calculator` 等共用路徑後**必跑 `regression-baseline.mjs --check`（10/10）**，不過即停在該
> commit 修復、不得帶病前進。World 專屬邏輯一律 gated by `deps.world`（或資料層差異），不用 if-rise
> 硬判、以回歸證明短路。`efr-world.ts` 與 `efr.ts` 共用 `EfrInput/EfrResult`（同介面義務，改一個要同步）；
> `decoration-solver` 的 `greedySolve` 主體逐位元未改（修復是失敗後的 gated 後處理）。

> 移除 preset/guide 後，下列為**無 caller 但刻意保留**的引擎通用能力（型別/元件處均有註解，
> 勿因 grep 無 caller 誤判為死碼）：`BuildSearchRequest.autoRules/maxRarity/preferElement/progress`、
> `PresetAutoRules` 型別、`preset-resolver.ts` 的 `resolveAutoSkills/resolveAutoSkillsFromElement/
> mergeMaxSkills/elementSkillMap`、`BuildResultCard` 的 autoSkills 顯示分支、`unlocks.ts` 全體。

## 3. 待辦尾巴

**World 本輪已收掉（勿重做）**：
- ✅ World: Iceborne 擴充 Phase 0–6（多遊戲抽象層、資料管線、UI 切換、推薦分頁）。
- ✅ 四條尾巴：World 推薦分頁（A）、期望斬味倍率（B）、武器強化簡化輸入（C）、複合珠 solver 有界修復（D）。
  全部 push，`origin/main` @ `463cee2`。驗收腳本見 §0。

**World 已知近似 / 未做（v1，`docs/efr-world-notes.md`）**：
- ⏳ 屬性值上限（elemental cap）不建模 → 高屬性配裝 EFR 偏高；屬性 delta 亦共此高估。
- ⏳ 斬味期望倍率不模擬打鬥中耗損下滑、剃刀銳利/砥石類技能。
- ⏳ 覺醒武器（皇金/赤龍）**逐能力模擬**未做（客製強化的**簡化輸入**已做）。
- ⏳ 中文名 EN-fallback 100 筆（Fatalis 武器/γ+ 防具/部分護石子技能 zh 缺列，需再爬 Kiranico）。

**Rise 舊輪已收掉（勿重做）**：
- ✅ special 技能未匯入時提示點名（`3bd7365`）。
- ✅ B′ 匯出語意文件化——寫在 **README**（`3bd7365`）；刻意不進 `SCHEMA_DOC`（那是資料形態的
  真相源，匯出是配裝器行為，放進去是類別錯置）。

**仍待辦（Rise）**：
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
# 1. Node：Next 14.2.35 build 需 >=18.17；但 World 驗收腳本用「型別剝除」跑 .ts，需 Node >=22.6
#    （本輪實跑 v24.16.0）。統一裝 Node 24 最省事。
node -v            # 確認 >= 22.6（跑 scripts/world/* 與 regression-baseline）

# 2. 相依
npm install        # node_modules 不備份，靠這裝回

# 3. 開發 / 建置
npm run dev        # localhost:3006（.claude/launch.json）
npm run build && npm start   # production 抽測（見待辦）

# 4a. 三綠燈（動共用路徑後必跑；push 閘門）
node scripts/regression-baseline.mjs --check   # Rise 逐位元回歸 10/10
npx tsc --noEmit                               # 乾淨 rm -rf .next && npm run build 亦然

# 4b. World 驗收腳本（見 §0；動 World 對應面向時跑）
node scripts/world/smoke-world.mjs
node scripts/world/test-decoration-repair.mjs
node scripts/world/smoke-cross-session.mjs     # 跨 session A/B/C 回歸

# 5. Rise 資料管線重跑（需要時；順序固定）
node scripts/build-jp-name-map.js          # Kiranico ja 列表 → jp-name-map
node scripts/scrape-game8.js               # Game8 → data/recommended-builds.json
node scripts/validate-recommended-builds.js
node scripts/audit-known-max.mjs           # KNOWN_MAX 對 Kiranico 效果表核對

# 6. World 資料管線重跑（需要時；順序固定，重跑安全、只改腳本不手改產出）
node scripts/world/fetch-mhwd.mjs          # pin commit 抓 MHWorldData raw CSV → .cache
node scripts/world/import-world.mjs        # → src/data/world/*.json
node scripts/world/build-zh-name-map.mjs   # Kiranico id 配對補 zh
node scripts/world/audit-world-data.mjs    # 獨立外部源交叉稽核
```

**快取說明**：`scripts/.cache`（Kiranico ja 列表+技能詳細頁）、`scripts/.game8-cache`（Game8 文章
84 頁）、`scripts/.kiranico-cache`（Kiranico 裝備詳細頁 5544 件，import-unlocks 用）皆 **gitignore**。
快取**在**＝重跑零抓取；快取**缺**＝腳本會禮貌重抓（2.5s 間隔，Game8 84 頁約數分鐘、Kiranico 5544
頁很久）。已把三個快取備份到 `D:\claude-backup\cache\`——新機器把它們放回 `scripts/` 對應目錄即免重抓。

**破曉已停更（TU5 為最終版）**，資料凍結，管線通常不需重跑，除非改 override 或補資料。
