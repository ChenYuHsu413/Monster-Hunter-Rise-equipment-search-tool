# World 斬味 CSV 列語意考證（Phase 4 前置）

> 本文件是 Phase 4 動 `efr-world.ts` 前的斬味考證產出。結論**推翻** Phase 0/2 的初判
> （`world-data-source-audit.md` 第七節「斬味近似」與 commit `13b4779` 交接備註）。
> 依工作協議「PLAN／交接與實測衝突以實測為準並點名」，衝突逐條列於第五節。
> 考證日：2026-07-22。證據＝7 把武器對 Kiranico MH:World 詳細頁斬味條**逐段數字核對**。

---

## 0. 問題

MHWorldData `weapons/weapon_sharpness.csv` **每把近戰武器僅一列**（2825 melee；
`maxed=FALSE` 2393 / `maxed=TRUE` 432；無武器同時有兩列）。Rise 的斬味結構是
`{ base: number[7], max: number[7] }`（base=匠0、max=匠5，`efr.ts` 依匠等級在兩端插值）。
單列填不滿 base+max 兩端 —— Phase 2 暫取 `base = max = 該列值`，使**匠在 World EFR 中完全無效**。
Phase 4 必須先判定：**該單列到底是匠0（base）還是匠5（max）？** 才能機械推導另一端。

**不可憑記憶假設**（KNOWN_MAX 硬編半數錯的教訓）。以下用實測判定。

---

## 1. 判定方法

Kiranico MH:World 武器詳細頁的斬味列渲染**兩條** bar（DOM 內 `div.sharpness-{color}`，
inline `width:Npx`）：
- **粗 bar（`height:5px`）＝ base（匠0，無匠）**。
- **細 bar（`height:3px`）＝ maxed（匠5，含匠）**，恆 ≥ 粗 bar（匠只增不減）。

比例尺 **1px = 4 sharpness 單位**（實測 Fatalis red 40px = CSV red 160）。逐段抽出兩條 bar
的數值，與 CSV 該列（`red..purple`）比對，即可判定 CSV 對應哪一端。

抽樣涵蓋 PLAN 指定三類：（a）有紫斬畢業武器含 ≥1 把 Fatalis；（b）色帶天生短的武器；
（c）遠程武器無斬味。DOM 抽取方式（可複現）：

```js
// 於 Kiranico 武器頁 console 執行，回傳兩條 bar 的逐色數值（px×4）
row.querySelectorAll('div.d-flex[style*="height"]').forEach(bar => {
  const segs = [...bar.querySelectorAll('div[class^="sharpness-"]')]
    .map(s => s.className.replace('sharpness-','') + ':' +
      parseFloat(s.getAttribute('style').match(/width:\s*([\d.]+)px/)[1]) * 4);
  console.log('h' + bar.style.height + ' => ' + segs.join(' '));
});
```

---

## 2. 逐把核對（7 把，順序 [紅,橙,黃,綠,藍,白,紫]）

| 武器 | `maxed` | Kiranico base（匠0，h5×4） | Kiranico maxed（匠5，h3×4） | CSV 該列 | CSV = ? |
|---|---|---|---|---|---|
| **Fatalis Blade**（GS, R11, 有紫）| FALSE | `[160,20,20,70,40,30,`**`10`**`]` Σ350 | `[160,20,20,70,40,30,`**`60`**`]` Σ400 | `[160,20,20,70,40,30,60]` | **匠5 maxed** |
| **Buster Sword I**（GS, 短帶）| FALSE | `[100,50,`**`50,0`**`,0,0,0]` Σ200 | `[100,50,`**`80,20`**`,0,0,0]` Σ250 | `[100,50,80,20,0,0,0]` | **匠5 maxed** |
| **Defender GS I**（GS, 短帶綠封頂）| FALSE | `[30,60,20,`**`90`**`,0,0,0]` Σ200 | `[30,60,20,`**`140`**`,0,0,0]` Σ250 | `[30,60,20,140,0,0,0]` | **匠5 maxed** |
| **Don Monstro**（GS, Deviljho）| FALSE | `[70,80,30,30,80,`**`60`**`,0]` Σ350 | `[70,80,30,30,80,`**`110`**`,0]` Σ400 | `[70,80,30,30,80,110,0]` | **匠5 maxed** |
| **Nergal Reaver**（LS, HR）| TRUE | `[120,120,40,50,70,0,0]` Σ400 | `[120,120,40,50,70,0,0]` Σ400 | `[120,120,40,50,70,0,0]` | maxed（=base）|
| **Ruinous Atrocity**（GS, Safi R12）| TRUE | `[80,30,30,110,40,110,0]` Σ400 | `[80,30,30,110,40,110,0]` Σ400 | `[80,30,30,110,40,110,0]` | maxed（=base）|

> Kiranico URL 例：Fatalis Blade `mhworld.kiranico.com/en/weapons/jqHy9fvw/fatalis-blade`、
> Buster Sword I `.../r8H9i4/buster-sword-i`、Defender GS I `.../bvHvbHDK/defender-great-sword-i`、
> Don Monstro `.../q8HDcwR/don-monstro`、Nergal Reaver `.../M5u0h3/nergal-reaver`、
> Ruinous Atrocity `.../KbH3hOb/ruinous-atrocity`。

### （c）遠程武器無斬味
`weapon_sharpness.csv` 的 `weapon_type` 集合只含 **11 種近戰**（great-sword…charge-blade；
其中 gunlance 為近戰銃槍，非 bowgun）。bow / light-bowgun / heavy-bowgun 共 719 把**完全無列**
→ import 不寫 `sharpness` 欄，EFR `activeSharpIndex` 回傳中性黃(1.0)。✓

---

## 3. 結論（實測判定）

1. **CSV 該單列 ＝ 匠5（handicraft-maxed）色帶，不是匠0 base。** 五把 `maxed=FALSE` 武器
   （Fatalis / Buster / Defender / Don Monstro，另加 Barroth 抽驗）CSV 皆等於 Kiranico 的
   **細 bar（匠5）**，而非粗 bar（匠0）；兩把 `maxed=TRUE` 的 base=maxed。
2. **`maxed` 欄語意**：
   - `TRUE`  → base 已等於此列（匠加成 **0**）。實測皆為已達 400 上限的武器（Nergal/Safi）。
   - `FALSE` → 匠 Lv5 較 base 恰 **+50**；**base ＝ 由該列最高色端往低色剝除 50**。
     實測 Fatalis purple 60→10、Buster green20→0+yellow80→50、Defender green140→90、
     Don Monstro white110→60，扣除量**皆恰為 50**。
3. **MHWorldData 以二值（0 / 50）建模匠加成——無「加不滿 +50」的中間值。** 連 Σ250 的
   短帶 Buster/Defender 都吃滿 +50。故 PLAN 假設的「（b）色帶天生短、匠加不滿 +50」這一類
   **在本資料源不存在**（見衝突 C-Sharp-2）；真正「匠無效」的武器一律以 `maxed=TRUE` 表達
   （base=maxed，匠 0 效果），而非部分加成。

### 機械推導（寫進 `import-world.mjs`，重跑安全，未手改產出檔）
```
maxedBar = 該列 red..purple            // = 匠5
base = (maxed==TRUE) ? maxedBar        // 匠加成 0
                     : peelFromTop(maxedBar, 50)   // 自最高色端扣 50 → 匠0
sharpness = { base, max: maxedBar }
```
`peelFromTop`：從 index6(紫) 往 index0(紅) 逐色扣，扣滿 50 即止。

---

## 4. 推導結果抽驗（重跑後 `src/data/world/weapons.json` vs Kiranico）

PLAN 要求「至少 1 把『匠5 恰好開出更高色』與 1 把『匠加了但不變色』」對兩端核對：

| 類別 | 武器 | base 生效色（匠0）| max 生效色（匠5）| base/max 兩端對 Kiranico |
|---|---|---|---|---|
| **匠5 開出更高色** | Buster Sword I | 黃（idx2, base 黃封頂）| **綠**（idx3, 匠5 開綠 20）| ✓ 兩端吻合 |
| **匠加了但不變色** | Fatalis Blade | 紫（idx6, base 已有紫 10）| 紫（idx6, 紫延長至 60）| ✓ 兩端吻合 |
| **匠加了但不變色** | Don Monstro | 白（idx5, 60）| 白（idx5, 110）| ✓ 兩端吻合 |
| **匠無效（maxed=TRUE）** | Nergal Reaver | 藍（idx4）| 藍（idx4, base=maxed）| ✓ 兩端吻合 |

重跑後 6 把武器 base 與 max 皆逐段等於 Kiranico（驗證腳本輸出見 commit 訊息 / session log）。

> ⚠️ **對 EFR 的含意（Task B 需知）**：本 EFR 的 `activeSharpIndex` 以「最高填色」為生效色，
> **不建模斬味長度/耗損（uptime）**。故 Fatalis 這種「base 已有紫斬薄層」的武器，匠0 與匠5
> **生效色同為紫**，色不變 → 該武器物理 EFR 不隨匠變。匠的真實收益（紫斬更長、更耐用）
> 在此近似下**不反映於物理 EFR 色乘數**（記為已知限制，寫入 `efr-world-notes.md`）。
> 要展示「匠改變生效色」須用 base 生效色 < max 生效色的武器（如 Buster：黃→綠）。

---

## 5. 與 PLAN／交接的衝突（實測為準，逐條點名）

- **C-Sharp-1（方向相反，阻斷級）**：`world-data-source-audit.md` 第七節與 commit `13b4779`
  交接備註稱「`maxed=FALSE` 為匠0 base、`maxed=TRUE` 為匠5 maxed」。**實測相反**：該單列
  （不論 TRUE/FALSE）＝**匠5 maxed**；`maxed` 只標示「base 是否已等於 maxed」。Phase 2 的
  `base=max=該列值` 等於把**匠5 值當成 base**（非把匠0 當成 max），方向與交接備註所述相反。
  已修正 `import-world.mjs` 並重跑；舊備註同步更新。
- **C-Sharp-2（類別不存在）**：PLAN Phase 4 假設有「（b）色帶天生短、匠加不滿 +50」的武器。
  **實測 MHWorldData 以二值（0/50）建模，無中間值**；短帶武器一律吃滿 +50，匠無效者以
  `maxed=TRUE`（base=maxed）表達。此類別在本資料源不存在，抽樣改以 Buster/Defender（短帶但
  仍 +50）+ Nergal/Safi（maxed=TRUE 匠無效）覆蓋 PLAN 意圖。
- **C-Sharp-3（模型限制，非資料錯）**：色帶語意修正後匠**資料**已正確（base≠max），但
  color-only 的 EFR 對「base 已達最高色」的武器仍無法反映匠的長度收益（見第四節 ⚠️）。
  屬 EFR 近似邊界，記入 `efr-world-notes.md`，非本次資料層問題。
