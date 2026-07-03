# 魔物獵人 Rise：破曉配裝搜尋器 · Sunbreak Build Finder

本專案是一個《Monster Hunter Rise: Sunbreak》配裝搜尋工具,目標是支援全武器的技能條件搜尋、固定部位、排除裝備、保留洞位與裝飾珠自動配置。防具/珠子/技能為真實破曉 TU5 資料。無後端,資料使用本地 JSON,搜尋邏輯為純 TypeScript utility(可獨立測試)。

## 功能

- 武器系統:固定指定武器,或讓系統從同類型武器中搜尋;武器的洞數/攻擊/會心/屬性/自帶技能皆納入計算;全 14 種武器類型均為 Kiranico 真實資料
- 武器流派 preset(15 套,涵蓋太刀/大劍/片手劍/雙刀/輕弩/弓),選取自動帶入推薦技能
- 屬性自動技能:屬性雙刀/屬性弓等 preset 依武器屬性自動加入對應「○屬性攻擊強化」(硬條件)
- 派生小字提示:防具/武器旁標示系列名與階級(村/HR/MR,依稀有度推算)
- 手動調整必要 / 偏好 / 排除技能;護石、武器洞數、保留洞位輸入
- 固定 / 排除指定裝備與武器(可從搜尋結果卡片一鍵操作後再搜)
- 簡化版傀異鍊成(直接輸入鍊成後技能與洞數)
- 三種搜尋模式(快速 / 完整 / 推薦)、自動補裝飾珠、評分排序、顯示前 100 套
- 結果卡片:分數細項、技能摘要、珠子配置、剩餘/保留洞位、複製配裝摘要

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
│   ├── armors.json         #   全防具 1591 件（RARE1-10，含破曉 TU5 全系列）
│   ├── weapons.json        #   全武器 3953 把（14 類全開放，含 Kiranico 真實數值/屬性/瓶種等）
│   ├── decorations.json    #   裝飾珠 243 顆（含 4 級洞）
│   ├── skills.json         #   147 個技能與上限、特殊標記
│   ├── weaponTypes.json    #   14 種武器（全數 supported: true）
│   └── buildPresets.json   #   15 個武器流派 preset（6 武器類型已有 preset，含 autoRules；其餘 8 類已有真實武器資料，尚待補 preset）
├── lib/                    # 純函式邏輯層（無 React 相依，方便測試）
│   ├── data.ts             #   小型資料（技能/珠子/武器類型/preset）+ 衍生索引
│   ├── game-data.ts        #   防具/武器大資料的延遲載入（不進首屏 bundle）
│   ├── use-local-storage.ts#   SSR 安全的 localStorage 狀態 hook
│   ├── slot-utils.ts       #   洞位：normalize / parse / place / canFit
│   ├── skill-calculator.ts #   技能累加、gap、上限截斷
│   ├── decoration-solver.ts#   自動補珠（必要→保留洞位→偏好）
│   ├── equipment-pools.ts  #   候選池、固定/排除、單件評分、模式裁切
│   ├── score-build.ts      #   scoreBuild()（分數細項）
│   └── build-search.ts     #   searchBuilds() / formatBuildResult()
├── components/             # UI 元件（每個獨立、可組合）
└── app/page.tsx            # 主 Dashboard 頁面
```

## 搜尋流程

1. 選武器 → 選流派 preset → 自動帶入必要／偏好／排除技能（可再手動調整）
2. 輸入武器洞數、護石、保留洞位；可建立傀異鍊成自訂防具
3. 三種模式：`fast`（預設，候選裁切）/ `exact`（較大候選池、較慢）/ `greedy`（最快，優先補必要技能）
4. 每套配裝自動補珠：先補必要技能（補不滿即淘汰）→ 檢查保留洞位（硬條件）→ 剩餘補偏好
5. 依 `scoreBuild()` 排序，最多顯示前 100 套
6. 從結果卡片可「固定此部位 / 排除此裝備」，再搜尋即套用

## 資料來源與匯入

防具 / 武器 / 裝飾珠 / 技能為**真實破曉 TU5（Ver16）正體中文資料**,由 [Kiranico](https://mhrise.kiranico.com/zh-Hant) 匯入:

```bash
node scripts/import-kiranico.mjs   # 重新抓取並覆寫 src/data/{armors,decorations,skills,weapons}.json
```

- 防具部位（頭/身/手/腰/腳）Kiranico 未文字標註,由 `import-kiranico.mjs` 以「後綴／【】token 關鍵字 + 系列內位置游標」混合判定(涵蓋主題命名系列如冥淵/脈動鋼龍)。
- 少數套裝加成技能 Kiranico 未提供逐級說明,其最大等級以腳本內 `KNOWN_MAX` 常數表補齊。
- Kiranico 官方譯名與坊間略有差異(例:納刀術→**收刀術**、翔蟲使→**翔蟲能手**、業物→**利刃**、冰氣鍊成→**寒氣鍊成**),preset 已對齊官方譯名。
- 武器屬性代碼 1-5（火/水/雷/冰/龍）已以武器名稱交叉驗證（例如「王刀雷切」= 雷）；6-9（毒/睡眠/麻痺/爆破）採用資料排序慣例，信心度較低但不影響搜尋硬條件（僅五屬性觸發 autoRules），純屬顯示用途。
- 弩槍（輕弩/重弩）的彈藥表因巢狀表格結構複雜，本次未解析（`ammo` 欄位留空）；其餘武器類型的攻擊/會心/屬性/洞位/百龍洞/砲擊型/瓶種/獵蟲等級/弓塗料皆已解析。

> 搜尋為相關度裁切後的組合搜尋(全 DB 每部位 300+ 件無法暴力枚舉):各模式先濾除無關裝備、依 preset 相關度取每部位前 N 名(greedy 7 / fast 9 / exact 12,武器候選數 >1 時再縮小)再枚舉補珠評分。結果為高品質啟發解,非保證全域最佳。

### 派生小字提示（系列 / 階級）

結果卡片與武器選擇器會在每件防具/武器旁顯示小字：**系列名**（同批共用的前綴，例如「原初」「冥淵」）與**階級標籤**（村 / HR / MR）。

- 系列名：同一系列 5 部位（防具）或同一強化線（武器，去除Ⅰ/Ⅱ/改等強化階數後綴）的最長共同前綴，純文字推導，客觀可驗證。武器若系列名等於全名則不顯示（避免重複）。
- 階級標籤：**依稀有度區間推算**（稀有度 1-3 → 村、4-7 → HR、8-10 → MR），是 Sunbreak 稀有度慣例的推算值，**不是精確的「第幾星緊急任務解放」資訊**。Kiranico 的防具/武器列表頁不提供逐怪物解放任務資料；若需要精確解放條件，需另外對照任務資料庫（目前未實作）。
- 武器來源（推測）：由 `import-kiranico.mjs` 逐把抓武器詳細頁的**生產素材**得出。判定優先序：(1) 武器名含怪物名 → 以名稱為準（identity 最可靠，也修正「改」等升級版）；(2) 否則看生產+強化素材，某怪物佔比 ≥60% 才標。約 2620/3953 把有推測來源；村莊/礦石系等混合素材武器無來源。標籤一律附「（推測）」,詳細頁也保留原始生產素材清單供核對。此為啟發式,非官方標註。

## 效能與持久化

- **延遲載入**:防具(428K)+ 武器(1.4M)資料不打進首屏 bundle,改由 `game-data.ts` 以動態 import 拆成獨立 chunk,掛載後於背景載入。首屏 JS 從 ~295KB 降到 ~152KB;大資料只在使用者操作時載一次並快取。
- **無後端 / 無 DB**:遊戲資料是唯讀靜態 JSON(CDN 快取),搜尋跑在前端;不需要資料庫。
- **localStorage 持久化**:武器/流派/搜尋模式、必要·偏好·排除技能、護石、保留洞位、固定/排除清單、傀異鍊成、收藏/比較清單皆存 localStorage(`mhsb.*` 前綴),重整後自動還原。使用者資料量小,localStorage 足夠,無需帳號或後端儲存。

## 擴充方向

- 新流派：8 種武器類型（大錘/狩獵笛/長槍/銃槍/斬擊斧/盾斧/操蟲棍/重弩）已有真實武器資料，僅缺 `buildPresets.json` 流派 preset；補上即可搜尋。
- 精確任務解放條件：目前階級標籤為稀有度推算值，如需精確「第幾星緊急任務解放」，需另外建立任務/怪物解放資料並與系列名比對。
- 弩槍彈藥表：`Weapon.ammo` 型別已定義，解析邏輯待補（巢狀表格結構較複雜）。
- `data.ts` 是唯一資料來源，可替換為 DB。
- 已預留：護石收藏、裝備庫存、收藏／比較的持久化。

## 資料致謝

遊戲資料來源:[Kiranico — Monster Hunter Rise: Sunbreak](https://mhrise.kiranico.com/)。本專案為個人非商業用途的配裝工具。《Monster Hunter Rise: Sunbreak》© CAPCOM。
