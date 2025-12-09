# Effect 數據解析分析報告

## 概述

本報告分析了賽道技能的 effect 數據與 needSkillPoint 之間的關係。

## 數據提取結果

✅ 成功從 effect 字串中提取以下數據：
- `effectValue`: 效果值（例：0.37）
- `effectPerPoint`: 官方提供的每點效率（例：0.19）
- `effectRangeMin/Max`: 效果範圍（如果有）
- `calculatedEfficiency`: 計算的效率 = effectValue / needSkillPoint × 100

## 關鍵發現

### 1. 效率公式吻合度統計

- **總技能數**: 406 個有完整 effect 數據
- **吻合**: 295 個 (72.7%)
- **不吻合**: 111 個 (27.3%)

### 2. needSkillPoint 與吻合率的關係

| needSkillPoint | 吻合率 | 說明 |
|---|---|---|
| 70 | 100% | 公式完全適用 |
| 90 | 100% | 公式完全適用 |
| 100 | 100% | 公式完全適用 |
| 110 | 6.7% | 公式幾乎不適用 |
| 120 | 50% | 公式部分適用 |
| 130-200 | 40-66% | 公式中等適用 |

**結論**: needSkillPoint 較低 (≤100) 的技能，簡單公式完全適用。

### 3. 不吻合技能的特徵

#### 按稀有度分析：
- **Gold 稀有度**: 96 個不吻合 (86.5%)
- **Normal 稀有度**: 15 個不吻合 (13.5%)

**結論**: Gold 稀有度技能有不同的效率計算方式。

#### 按名稱符號分析：
- 包含 "◎" 符號: 15 個不吻合
- 包含 "○" 符號: 0 個不吻合
- 包含 "の鬼": 2 個不吻合

**結論**: ○ 符號技能使用簡單公式，◎ 符號技能使用特殊計算。

#### 效率比值分析：
- **平均比值**: 2.02x (calculatedEfficiency / effectPerPoint)
- **比值範圍**: 1.53x ~ 2.89x

**結論**: 不吻合的技能，計算效率約為實際效率的 2 倍，暗示存在約 50% 的效率懲罰。

## 公式推論

### 適用簡單公式的技能：
```
effectPerPoint = effectValue / needSkillPoint × 100
```

**條件**:
- needSkillPoint ≤ 100，或
- 稀有度為 Normal，或
- 技能名稱包含 "○" 符號

### 使用特殊計算的技能：
```
effectPerPoint ≈ effectValue / needSkillPoint × 100 / 2
```

**條件**:
- 稀有度為 Gold，或
- 技能名稱包含 "◎" 符號，或
- needSkillPoint > 100 且為特殊技能

## 範例

### 吻合範例 (公式適用):
```
技能: 左回り○
needSkillPoint: 90
effectValue: 0.25
計算: 0.25 / 90 × 100 = 0.2778
實際: 0.28
結果: ✅ 吻合
```

### 不吻合範例 (特殊計算):
```
技能: 左回り◎
needSkillPoint: 110
effectValue: 0.37
計算: 0.37 / 110 × 100 = 0.3364
實際: 0.19
比值: 0.3364 / 0.19 = 1.77x
結果: ❌ 不吻合 (可能有效率懲罰)
```

## 建議

1. 在數據中同時保留 `calculatedEfficiency` 和 `effectPerPoint`
2. 提供 `efficiencyRatio` 欄位來標示兩者的比值
3. 根據稀有度和符號自動標註計算方式
4. 進一步研究 Gold 稀有度技能的實際計算公式

## 結論

effect 數據已成功解析並提取。發現了明確的模式：
- 低 needSkillPoint 和 Normal 稀有度技能遵循簡單公式
- Gold 稀有度和高等級符號技能存在約 2 倍的效率差異
- 這可能是遊戲平衡機制，對強力技能施加效率懲罰
