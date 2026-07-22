# 魔物獵人 Rise：破曉配裝搜尋器 · Sunbreak Build Finder

本專案是一個《Monster Hunter Rise: Sunbreak》配裝搜尋工具,目標是支援全武器的技能條件搜尋、固定部位、排除裝備、保留洞位與裝飾珠自動配置。排名採 **EFR（有效攻擊力／期望傷害）模型**。防具/珠子/技能/武器(含斬味、屬性耐性)為真實破曉 TU5 資料。無後端,資料使用本地 JSON,搜尋與評分邏輯為純 TypeScript utility(可獨立測試)。

## 這個工具為誰而做

網路上的配裝文九成是畢業裝,可是剛入坑的玩家根本一件都做不出來。本工具以**技能條件 + 武器選擇**驅動搜尋,支援全武器,並保留完整的進階控制（固定部位、護石、保留洞位、傀異鍊成）。

> 註:早期版本內建「流派 preset」下拉與 `/guide` 新手引導模式,兩者定位與「推薦配裝」頁籤重疊,已移除。配裝主軸回歸「選技能 + 選武器」。

- **解放條件資料層**:每件裝備（5544 件全覆蓋）都標註可製作的進度里程碑與**信心度**（已確認/推導/未驗證,詳見 [docs/DATA-COVERAGE.md](docs/DATA-COVERAGE.md)）。資料多為任務星級推導,寧可標「未驗證」也不假裝精確;歡迎老手透過 GitHub issue 回報錯誤。
- 進階玩家想要的完整控制（固定部位、護石、保留洞位、傀異鍊成）全部保留。

## 功能

- 武器系統:固定指定武器,或讓系統從同類型武器中搜尋;武器的洞數/攻擊/會心/屬性/自帶技能皆納入計算;全 14 種武器類型均為 Kiranico 真實資料
- 圖示化結果卡:武器與防具部位改用 SVG 圖示(內嵌 MHW MIT 圖示;武器中性色、防具依稀有度上色);稀有度以《破曉》遊戲配色的彩色「RARE N」徽章顯示於結果卡、武器選擇器、防具鎖定面板等處(rarity 1~10,資料 100% 完整)
- 武器屬性篩選:全武器類型(弩槍除外,無屬性)可依屬性(火/水/雷/冰/龍)篩選候選;搜尋模式同步只挑該屬性武器
- 來源怪兩層下拉(全 14 類):固定模式改用「來源怪(派生大分類)→ 該系列各階段武器」兩層選單;無來源(村莊/礦石混合素材)歸「其他」分類
- 派生小字提示:防具/武器旁標示系列名與階級(村/HR/MR,依稀有度推算)
- 手動調整必要 / 排除技能;技能下拉將**套裝技能**(風紋一致/雷紋一致/風雷合一/○之恩惠)獨立分組並標記,方便挑選
- 防禦力 / 屬性耐性(火水雷冰龍)下限過濾:以 5 件防具的基礎防禦與耐性總和為硬條件,空白欄位不設限
- 護石庫:儲存多顆護石、一鍵套用、去重、刪除(localStorage)
- 固定 / 排除指定裝備與武器(可從搜尋結果卡片一鍵操作後再搜)
- 簡化版傀異鍊成(直接輸入鍊成後技能與洞數)
- 三種搜尋模式(快速 / 完整 / 推薦)、自動補裝飾珠、**依 EFR 綜合值(物理＋屬性)降冪排序**、顯示前 100 套;結果可於 UI 三鍵(EFR / 防禦 / 孔位餘裕)即時重排(client 端,不重搜)
- 結果卡片:EFR(期望攻擊值,含屬性)、技能摘要、珠子配置、防禦與屬性耐性總和、剩餘/保留洞位、**可追加技能建議**(依剩餘洞位推算還能塞哪些珠)、複製配裝摘要

## 技術

Next.js 14（App Router）· TypeScript · Tailwind CSS · shadcn/ui · 深色 Dashboard UI。

## 開發

```bash
npm run dev     # 開發伺服器（本機 3000 被占用時可用 -p 指定其他埠）
npm run build   # 生產建置（含 type-check + lint）
npm run start   # 執行生產版本
```

> 注意：本機 3000 埠可能被其他專案占用，`.claude/launch.json` 內建 `mhsb-prod`(3005) / `mhsb-dev`(3006) 兩組設定。

## 架構

```
src/
├── types/build.ts          # 全部核心型別（不寫死特定武器，只以 weaponType 字串區分）
├── data/                   # 本地 JSON 資料（由 Kiranico 匯入）
│   ├── armors.json         #   全防具 1591 件（RARE1-10，含防禦力與五屬性耐性 elementRes）
│   ├── weapons.json        #   全武器 3953 把（含斬味 sharpness base/max；一物件一行 compact 格式）
│   ├── decorations.json    #   裝飾珠 243 顆（含 4 級洞）
│   ├── skills.json         #   147 個技能與上限、特殊標記
│   ├── weaponTypes.json    #   14 種武器（全數 supported: true）
│   └── unlocks.json        #   解放條件（5544 件全覆蓋；里程碑多軸 + 信心度；含魔物→星級映射）
├── lib/                    # 純函式邏輯層（無 React 相依，方便測試）
│   ├── data.ts             #   小型資料（技能/珠子/武器類型）+ 衍生索引
│   ├── game-data.ts        #   防具/武器大資料的延遲載入（不進首屏 bundle）
│   ├── use-local-storage.ts#   SSR 安全的 localStorage 狀態 hook
│   ├── slot-utils.ts       #   洞位：normalize / parse / place / canFit
│   ├── skill-calculator.ts #   技能累加、gap、上限截斷
│   ├── decoration-solver.ts#   自動補珠（必要技能→保留洞位；皆為硬條件）
│   ├── suggest-skills.ts   #   由剩餘洞位推算「可追加技能」建議
│   ├── equipment-pools.ts  #   候選池、固定/排除、單件評分、模式裁切
│   ├── unlocks.ts          #   解放資料延遲載入、isCraftable 多軸判定、解放描述/信心度標籤
│   ├── efr.ts              #   EFR 傷害模型（有效攻擊×斬味×期望會心＋屬性）
│   ├── build-search.ts     #   searchBuilds()（結果固定依 EFR 綜合值降冪）/ formatBuildResult()
│   ├── search.worker.ts    #   Web Worker：直接 import build-search 跑搜尋（不凍結 UI、可取消）
│   ├── builder-import.ts   #   推薦配裝 → 配裝器的匯入通道（核心技能萃取，見「推薦配裝匯出」節）
│   ├── search-conditions.ts#   配裝器單一 state 物件（序列化/反序列化、我的護石清單）
│   └── share-link.ts       #   分享連結：序列化條件子集到 ?c=（刻意不含護石）
├── components/             # UI 元件（每個獨立、可組合）
└── app/page.tsx            # 主 Dashboard 頁面（推薦配裝 + 配裝器）
```

## 搜尋流程

1. 選武器（固定一把，或從同類型武器中搜尋）→ 選必要／排除技能
2. 輸入武器洞數、護石、保留洞位；可建立傀異鍊成自訂防具
3. 三種模式：`fast`（預設，候選裁切）/ `exact`（較大候選池、較慢）/ `greedy`（最快，優先補必要技能）
4. 每套配裝自動補珠：先補必要技能（補不滿即淘汰）→ 檢查保留洞位（硬條件）→ 剩餘空洞留給玩家自由運用
5. 引擎固定依 EFR 綜合值（物理＋屬性）降冪排序，最多顯示前 100 套（UI 可再以 EFR／防禦／孔位餘裕三鍵於 client 端重排）
6. 從結果卡片可「固定此部位 / 排除此裝備」，再搜尋即套用
7. 搜尋在 **Web Worker**（`search.worker.ts`）執行：主執行緒不凍結、搜尋期間可切 Tab / 捲動 / 取消。演算法未改，只是搬移；`?workerParity=1` 可開主執行緒同步重算並比對有序 id（驗證前後一致）。

## 推薦配裝匯出到配裝器

「推薦配裝」頁的卡片可帶入「配裝器」（`builder-import.ts`）。這裡的裁決都有原因，改動前先讀懂：

- **full-build「以此為基礎修改」＝匯核心技能 + 護石**，非全表照搬。核心技能取法（`extractCoreSkills`）：排序鍵 `紅字優先 → 等級÷maxLevel 比值 → 等級 → Game8 原順序`，取前 **N=4**。
  - **為何 N=4**：由 10 筆隨機大師畢業裝校準——N=4 時 9/10 可搜出結果（含 2 筆驗收指定配裝）；N=6 僅 5/10（6 個 maxed 硬技能對「基礎防具」過緊）。
  - **為何比值排序而非裸等級**：一大批定義性技能天生 maxLevel 低（達人藝 1/1、超會心 3/3），裸等級會把它們排在攻擊 4/7 後砍掉。比值讓「作者刻意堆滿的技能」浮上來。
  - **為何紅字只當優先鍵不當全集**：Game8 `required` 紅字實測只在 2/399 full-build 有標（不是 parser 壞，是 Game8 真的幾乎不標）；且那兩筆的紅字集達 9 項全 maxed，全匯反而零結果。
- **排除 `special` 技能**（狂化 / 業鎧【修羅】 / 狂龍症 / 血氣覺醒等，即 `SPECIAL_SKILLS`）：這批是傀異錬成 / 狂竜化衍生，搜尋器不模擬其取得，硬性要求必零結果。匯入時整批排除，並在提示點名（否則匯入畢業裝條件區近乎空白，會被誤認功能壞掉）。
- **等級取 `level` 不取 `augmentedLevel`**：Game8 `Lv4→Lv5` 中 `level=4` 是**錬成前基礎值**（要匯入的）、`augmentedLevel=5` 是錬成後總值。照總值匯入會無解。有此情形時提示「已排除傀異錬成加成的等級」。再 clamp 到 `skillMax`（防禦性）。
- **切換武器種類**為該配裝的武器（用直接 setter，不走 `changeWeapon` 以免其副作用清掉剛匯入的技能）。
- **護石**標 `source:"reco"` 併入清單，與自有護石並存、可單獨刪；**每次 full-build 匯入取代所有舊 reco 護石**（＝從這套重新開始，不跨匯入累積）。
- **覆蓋確認**：配裝器已有非空條件時，full-build 匯入前 `window.confirm`（無 Dialog 原件，最小改動）；`lock-armor` / `lock-weapon` 為 additive 不確認。
- **armor-pieces / weapon-list**「鎖定」：前者反查 `armorById.part` 固定該部位、後者固定武器並帶入武器種類；皆切 Tab 但**不自動搜尋**。

## 資料來源與匯入

防具 / 武器 / 裝飾珠 / 技能為**真實破曉 TU5（Ver16）正體中文資料**,由 [Kiranico](https://mhrise.kiranico.com/zh-Hant) 匯入:

```bash
node scripts/import-kiranico.mjs         # 重新抓取並覆寫 src/data/{armors,decorations,skills,weapons}.json
node scripts/add-armor-resistances.mjs   # 只補防具五屬性耐性 elementRes，併回 armors.json（其他檔不動）
node scripts/add-weapon-sharpness.mjs     # 只補武器斬味 sharpness，逐武器詳細頁抓取後併回 weapons.json（並發＋可續跑）
node scripts/import-unlocks.mjs          # 解放條件：解析任務清單建「魔物→首次出現星級」映射，推導每件裝備的解放里程碑 → unlocks.json
node scripts/validate-unlocks.mjs        # 解放資料驗證：引用完整性、條目有效性、與 rank 矛盾檢查、覆蓋率報告
```

- 防具部位（頭/身/手/腰/腳）Kiranico 未文字標註,由 `import-kiranico.mjs` 以「後綴／【】token 關鍵字 + 系列內位置游標」混合判定(涵蓋主題命名系列如冥淵/脈動鋼龍)。
- 少數套裝加成技能 Kiranico 未提供逐級說明,其最大等級以腳本內 `KNOWN_MAX` 常數表補齊。
- Kiranico 官方譯名與坊間略有差異(例:納刀術→**收刀術**、翔蟲使→**翔蟲能手**、業物→**利刃**、冰氣鍊成→**寒氣鍊成**),資料已對齊官方譯名。
- 武器屬性代碼 1-5（火/水/雷/冰/龍）已以武器名稱交叉驗證（例如「王刀雷切」= 雷）；6-9（毒/睡眠/麻痺/爆破）採用資料排序慣例，信心度較低但不影響搜尋硬條件（僅五屬性觸發 autoRules），純屬顯示用途。
- 弩槍（輕弩/重弩）的彈藥表因巢狀表格結構複雜，本次未解析（`ammo` 欄位留空）；其餘武器類型的攻擊/會心/屬性/洞位/百龍洞/砲擊型/瓶種/獵蟲等級/弓塗料皆已解析。
- **屬性耐性與斬味**在 Kiranico 列表頁不提供（斬味僅在個別武器詳細頁以 SVG 色塊呈現），故拆成兩支獨立合併腳本(`add-armor-resistances.mjs` / `add-weapon-sharpness.mjs`)只補對應欄位、不重跑全流程。斬味以 7 段色帶 `{base, max}`（匠 0 與最大匠）儲存；弩/弓無斬味故省略。EFR 依配裝的「匠」等級在 base↔max 間插值決定生效斬味色。

> 搜尋為相關度裁切後的組合搜尋(全 DB 每部位 300+ 件無法暴力枚舉):各模式先濾除無關裝備、依必要技能相關度取每部位前 N 名(greedy 7 / fast 9 / exact 12,武器候選數 >1 時再縮小)再枚舉補珠評分。結果為高品質啟發解,非保證全域最佳。

### 派生小字提示（系列 / 階級）

結果卡片與武器選擇器會在每件防具/武器旁顯示小字：**系列名**（同批共用的前綴，例如「原初」「冥淵」）與**階級標籤**（村 / HR / MR）。

- 系列名：同一系列 5 部位（防具）或同一強化線（武器，去除Ⅰ/Ⅱ/改等強化階數後綴）的最長共同前綴，純文字推導，客觀可驗證。武器若系列名等於全名則不顯示（避免重複）。
- 階級標籤：**依稀有度區間推算**（稀有度 1-3 → 村、4-7 → HR、8-10 → MR），是 Sunbreak 稀有度慣例的推算值，**不是精確的「第幾星緊急任務解放」資訊**。Kiranico 的防具/武器列表與詳細頁均不提供逐件解放任務資料；更精確的解放條件已另建 `unlocks.json`（任務星級推導 + 信心度標註，見下節與 [docs/DATA-COVERAGE.md](docs/DATA-COVERAGE.md)）。
- 來源怪（推測）：由 `import-kiranico.mjs` 逐把/件抓**詳細頁生產素材**得出。判定優先序：(1) 名稱含怪物名 → 以名稱為準（identity 最可靠，也修正「改」等升級版）；(2) 否則看素材，某怪物佔比 ≥60% 才標。武器約 2620/3953 把有來源；防具約 996/1591 件（**以「系列＋稀有度」聚合，同套 5 部位一致**）。村莊/礦石系等混合素材裝備無來源。標籤一律附「（推測）」，武器詳細頁另保留原始生產素材清單供核對。此為啟發式，非官方標註。

### 解放條件資料（unlocks.json）

每件裝備標註可製作的**進度里程碑**（多軸並存,任一軸達標即可製作,因為素材在哪條線打到都能做裝）:

- `v`＝村莊任務★（1-6）、`h`＝集會所任務★（1-3 初階＝低位、4-8 進階＝上位）、`m`＝Master 集會所★（MR 劇情章節 1-6）、`mr`＝MR 等級門檻（TU 魔物,10~180）
- **推導方式**:解析 Kiranico 四個任務清單（村/集會所初階/進階/Master）建出「每隻魔物首次出現的星級」,再以裝備既有的 `sourceMonster`（來源怪推測）對映,並依裝備階級取對應軌道（村裝看村/低位、HR 裝看上位、MR 裝看 Master）
- **信心度三層**:`confirmed`（遊戲常數 + 人工驗證,4.6%）/ `inferred`（任務星級推導 + 傀異素材門檻 + 素材補判來源 + 素材時期自舉,85.7%）/ `unverified`（活動/初始裝等,9.7%）。變種/傀異克服裝備以名稱覆寫表修正來源誤判;R9+ 裝備逐件掃描生產/強化素材,傀異素材依 Game8 等級表（A1★=MR10 ~ A4★=MR50、A5★+ 標註研究等級）設門檻。細節與待補清單見 [docs/DATA-COVERAGE.md](docs/DATA-COVERAGE.md)
- 已知限制:推導鏈上有兩層啟發式（來源怪 ≥60% 素材佔比、任務目標句比對）,特殊解放套裝（活動/支線/大師之魂類）會落在 unverified;發現錯誤歡迎開 issue 回報

## 效能與持久化

- **延遲載入**:防具(~640K,含耐性)+ 武器(~1.3M,含斬味,一物件一行 compact)+ 解放條件(unlocks.json,由 `unlocks.ts` 比照載入)資料不打進首屏 bundle,改由 `game-data.ts` 以動態 import 拆成獨立 chunk,掛載後於背景載入;大資料只在使用者操作時載一次並快取。武器 JSON 採 compact 一物件一行,避免斬味數字陣列被 indent 垂直爆炸撐大檔案(縮排格式下曾達 2.3M)。
- **無後端 / 無 DB**:遊戲資料是唯讀靜態 JSON(CDN 快取),搜尋跑在前端;不需要資料庫。
- **localStorage 持久化**:武器/搜尋模式、必要·排除技能、護石、護石庫、保留洞位、防禦/屬性耐性下限、顯示上限、固定/排除清單、傀異鍊成、收藏/比較清單皆存 localStorage(`mhsb.*` 前綴),重整後自動還原。使用者資料量小,localStorage 足夠,無需帳號或後端儲存。

## World: Iceborne 支援（多遊戲）

頂欄可切換 **破曉 / Iceborne** 兩款遊戲（URL `?game=world`；rise 省略）。切換以
per-game 元件重掛載 + localStorage 前綴（rise `mhsb.*` / world `mhwib.*`）隔離，兩款
狀態互不污染、各自還原。分享連結帶 `gameId`，舊格式連結（無 gameId）視為 rise。
World 第一版含防具/武器/裝飾珠/技能/護石 + 搜尋 + EFR 排序 + UI；**推薦配裝為 Rise 專屬**
（World 版列為 Phase 6，本次不做）。

### 資料來源

- **主源＝MHWorldData**（gatheringhallstudios/MHWorldData，GitHub raw CSV，**pin commit**、
  重跑安全）：武器 3544（rarity→12，含 Fatalis/Alatreon/Safi）、防具 1595、裝飾珠 404
  （複合珠 234）、技能 178（含 12 個 secret）、set bonus 69、護石 317；內建**繁體**中文。
- **交叉核對＝mhw-db.com API**（僅非武器；其武器停在基礎版 World，rarity≤8 不可用）。
- **Kiranico MH:World**：zh 缺漏裁決、set bonus/secret 抽驗、**斬味語意考證**（見下）。
- 管線：`scripts/world/{fetch-mhwd,import-world,build-zh-name-map,audit-world-data}.mjs`；
  產出檔一律機械產生、**絕不手改**，人工裁決進 `zh-name-overrides.json`。

### 機制與 EFR（`efr-world.ts`，與 `efr.ts` 同介面）

- **set bonus**：2/3/4/5 件門檻觸發（真髓/加護）；結果卡顯示觸發狀態
  （例「黑龍的傳說 ×2 → Inheritance(2件)」「銀火龍的真髓 ×4 → 真‧會心擊【屬性】(4件)」）。
- **secret 動態上限**：○‧極意 / Fatalis Inheritance（全域解放）觸發後上限提升
  （挑戰者 5→7…）；結果卡顯示分母（挑戰者 **7/7** 而非 7/5）。
- **複合珠**：Lv4 雙技能珠（單技能各 Lv1）solver 支援、技能正確累計。
- **護石**：固定可生產清單（資料選單，可固定一顆 / 排除若干顆），非 Rise 的使用者護石庫。
- **武器強化簡化輸入**（覺醒／客製強化，比照 Rise 傀異鍊成哲學：**輸入結果值、不模擬取得過程**）：
  僅固定武器模式，可填攻擊/會心/屬性/追加洞位（1 個，1–4 級）之 delta，套用到武器**淺拷貝**
  （原資料不動）進搜尋/EFR；防禦為 display-only。覺醒賦予的套裝技以「虛擬 set bonus +1 件」下拉
  表達（進件數統計，可讓 3 件門檻用 2 件防具達成，結果卡標「含武器覺醒 +1」）。狀態存 `mhwib.*`、
  share-link 帶入（舊連結無此欄仍可開）。
- **斬味**：`weapon_sharpness.csv` 每把近戰一列 ＝ **匠5 maxed**（考證推翻初判，見
  `docs/world-sharpness-audit.md`）；base 由高色端剝除 50（maxed=FALSE）或 = maxed
  （TRUE），結果卡顯示**生效斬味色**（依匠等級插值）。

### 已知近似（v1；詳見 `docs/efr-world-notes.md`）

- **斬味 期望倍率**（頂端 `EXPECTED_SHARPNESS_USE=60` 單位加權）：EFR 取色帶頂端 60 單位、依落入
  各色段長度**加權平均**倍率（非只取最高色）；故 base 已達最高色的武器（如 Fatalis 薄紫）匠愈高→
  頂端高色段愈厚→物理 EFR 單調上升。**仍未建模**：打鬥中斬味耗損下滑、剃刀銳利/砥石類技能。
- **屬性值上限（elemental cap）不建模** → 高屬性強化配裝屬性 EFR 偏高（已知高估）。
- **弱點特效傷口加成**：v1 假設已軟化/傷口計滿（未軟化時高估）。
- 條件技觸發率沿用 `CONDITIONAL_UPTIME = 0.75`；死裡逃生(World=Resuscitate)為迴避無傷害，不計入 EFR。
- 會心擊【屬性】倍率依武器種（GS/鎚/笛/重弩 較高，來源 Fextralife/社群傷害公式）。
- **複合珠啟發式**：`decorationsBySkill` 以「目標技能等級」排序，另一技能視為附贈不參與排序。
- **中文名 EN-fallback 100 筆**：Fatalis 武器/γ+ 防具件/部分護石·子技能 zh 缺列，顯示層退回
  英文名（不影響 setBonusId 連結與機能）；補齊需再爬 Kiranico 分頁（後續）。

### 未實作（Phase 6，本次不做）

- World 推薦配裝 tab（比照 Game8/Altema 管線）。
- 覺醒武器（皇金/赤龍）**逐能力模擬**（客製強化的**簡化輸入**已做，見上「武器強化簡化輸入」）。
- 屬性值上限納入 EFR。

## 擴充方向

- EFR 模型：尚未建模 寒氣鍊成/業鎧【修羅】等 raw 乘數技能；條件技能觸發率統一 `CONDITIONAL_UPTIME = 0.75`、弱點特效假設命中弱點，可隨實測手感微調（見 `efr.ts`）。候選武器池（`buildWeaponPool` 取候選數）偏窄，可放寬增加多樣性。
- 解放條件精確化：里程碑粒度已完成（`unlocks.json`，見下節）；可再擴：inferred 條目的人工校驗升級 confirmed、特殊解放套裝（活動/支線）的逐件標註。
- 弩槍彈藥表：`Weapon.ammo` 型別已定義，解析邏輯待補（巢狀表格結構較複雜）。
- `data.ts` 是唯一資料來源，可替換為 DB。

## 資料致謝

遊戲資料來源:[Kiranico — Monster Hunter Rise: Sunbreak](https://mhrise.kiranico.com/)。本專案為個人非商業用途的配裝工具。《Monster Hunter Rise: Sunbreak》© CAPCOM。

「推薦配裝」頁的配裝資料參考自 [Game8 — Monster Hunter Rise: Sunbreak Builds](https://game8.co/games/Monster-Hunter-Rise)，並對齊 Kiranico 官方譯名。

武器/防具部位圖示:[OthelloRhin/MHW_Icons_SVG](https://github.com/OthelloRhin/MHW_Icons_SVG)(MIT License, © 2020 Thibault "Othello" BENOIT);已改為 `currentColor` 供依稀有度上色(依破曉 rarity 配色),「腰」沿用 repo 的 Hunter/Torso 圖示。
