# efr-world.ts 近似假設與已知限制（Phase 4）

> `src/lib/efr-world.ts` 的 EFR（期望有效傷害）是**同一武器種類內排序用**的相對指標，
> 非絕對傷害。本文件列出所有近似與已知高估/低估來源（比照 Rise `efr.ts` 的做法）。
> 逐級數值來源見 efr-world.ts 各常數上方註解（機械抽取自 MHWorldData `skill_levels.csv`，
> 描述無數字者對 Fextralife/社群傷害公式核對）。斬味色帶 base/max 的考證見
> `docs/world-sharpness-audit.md`。

---

## 1. 沿用 Rise 的模型層近似（同 efr.ts）
- **略去招式倍率（motion value）與肉質**：同武器種為常數，不影響同種內排序。
- **攻擊力採 Kiranico 顯示值**（膨脹）：同武器種內可比。**flat 攻擊技**（攻擊/挑戰者/無傷/
  怨恨/轉禍為福）直接加在顯示值上 → 相對真值**略低估 flat**（真值 flat 會被武器種倍率放大）；
  **% 攻擊技**（火場怪力/攻擊守勢）加在顯示值 → 與真值等價（線性）。此為 Rise 既有近似，沿用。
- **期望會心**：正會心以會心傷害倍率、負會心以 −25%（×0.75）計期望值；不模擬會心的方差。
- **條件技統一觸發率 `CONDITIONAL_UPTIME = 0.75`**（可由 `EfrInput.conditionalUptime` 覆寫）。
  套用於：挑戰者、無傷、精神抖擻、力量解放、拔刀術【技】、火場怪力、怨恨、攻擊守勢、轉禍為福。
- **弱點特效**：由 `assumeWeakpoint`（預設 true）閘控，假設命中弱點計滿（非 × uptime）。

## 2. World 特有規則的第一版處理（PLAN Phase 4 指定）
- **弱點特效的傷口（clagger/軟化）加成**：World 弱點特效 = 弱點 +10/15/30%、**傷口再
  +5/15/20%**。**v1 假設傷口已軟化、計滿** → 取合計 `WEX_AFF = [0,15,30,50]`。未軟化時
  會**高估**弱點特效（實際弱點-only 為 10/15/30）。（恰與 Rise WEX 數值相同，但語意不同。）
- **屬性值上限（elemental cap）**：World 對「武器基礎屬性 + 屬性攻擊強化/龍脈覺醒」有上限
  （約 base 的 1.3×，龍脈覺醒再抬高）。**v1 不建模上限** → 高屬性強化配裝的屬性 EFR **高估**，
  為**已知高估來源**。屬性攻擊強化 flat（+30/60/100）與龍脈覺醒 flat（+80/150）皆直接累加。
- **secret 解放**：挑戰者/火場怪力/力量解放 5→7、精神抖擻 3→5 等由 set bonus 的「○‧極意」或
  Fatalis Inheritance（全域）解放。本模型的逐級表已涵蓋到解放後最高級；截斷由
  `profile.resolveSkillMax` 於 skill-calculator 完成，computeEfr 直接吃最終等級。

## 3. 會心擊【屬性】倍率依武器種（已建模）
World 的 on-crit 屬性倍率**依武器種**不同（來源：Fextralife / 社群傷害公式；Kiranico 只暴露
on/off 旗標，無數值）：

| | GS / 鎚 / 笛 / 重弩 | 其餘武器種 |
|---|---|---|
| 會心攻擊【屬性】(Critical Element) | ×1.50 | ×1.35 |
| 真‧會心擊【屬性】(True Critical Element, set bonus) | ×1.70 | ×1.55 |

`critElemFactor(weaponType, …)` 依此取值；真‧會心擊【屬性】優先於會心攻擊【屬性】（不疊加）。
輕弩(light-bowgun) 歸入「其餘」組（1.35/1.55）——v1 假設，實務影響小（弩以彈藥為主）。

## 4. Rise ↔ World 差異點名（實測為準，非沿用 Rise 數字）
- **攻擊 Attack Boost**：World L4–7 給「flat +12/15/18/21 **且會心 +5%**」，**非** Rise 的攻擊 %。
  已改為 `ATTACK_FLAT` + `ATTACK_AFF`（會心），無攻擊 %。
- **挑戰者 Agitator**：World flat +4…28 / 會心 +5…20%，逐級表與 Rise 不同（且 secret 到 7）。
- **拔刀術【技】 Critical Draw**：World 會心 +30/60/100%（Rise 為 +10/20/40）。
- **力量解放 Latent Power vs 精神抖擻 Maximum Might**：World 為**兩個不同技能**（Rise 的
  「力量解放」語意對應 World 的 Maximum Might=耐力滿）。本模型分別建模：力量解放（受傷/時間，
  會心 10…60%，secret→7）、精神抖擻（耐力滿，會心 10…40%，secret→5）。
- **死裡逃生 Resuscitate**：**World 版為迴避無敵/耐力（無傷害）**，與 Rise（攻擊）不同。
  故**刻意不計入 EFR、未納入 `EFR_RELEVANT_SKILLS`**。World 的「低血攻擊」技是火場怪力(Heroics)。
- **拔刀術【力】 Punishing Draw**：World 版加擊暈 + 「略微提升攻擊」（無明確數值）→ v1 不計入。
- **狀態值武器（毒/麻/睡/爆破）**：其 element.value 為**狀態積累非屬性傷害**，故 **EFR 屬性項只計
  五屬性（火水雷冰龍）**，狀態值不計（避免把 540 毒值當屬性傷害灌大 total；此點比 Rise 更收斂）。

## 5. 斬味/匠與本模型的互動（重要，接 world-sharpness-audit）
- 生效斬味色 = `activeSharpIndex`：在 base(匠0)↔max(匠5) 間**依總長插值**求 reach，於 max 色帶上
  定位落點色（與 efr.ts 同）。Task A 修正後 base≠max，故**匠會改變 reach**。
- **限制**：本模型以「最高填色」為生效色，**不建模斬味長度/耗損（uptime）**。故對
  **base 已達最高色**的武器（如 Fatalis：base 已有紫斬薄層 10），匠0 與匠5 **生效色同為紫**，
  物理 EFR 不隨匠變（匠的真實收益是紫斬更長更耐用，此近似不反映）。要展示「匠改變生效色」
  需 base 生效色 < max 生效色的武器（如 Buster Sword：黃→綠）。詳見 world-sharpness-audit 第四節。

## 6. 自測
`scripts/world/test-efr-world.mjs`：3 組手算範例（純物理 / 屬性+匠改色 / 條件技+secret 混合），
手算過程寫在腳本註解，函式輸出逐項一致（16/16）。
