# 技能評價 Popup 優化設計文件 (v2)

**日期**：2026-03-11
**功能**：優化現有技能評價 Popup 的三項體驗問題

---

## 需求

1. **名稱轉換**：技能名稱查詢 `skillsDatabase`，顯示 `jpName`（與正常技能清單一致）
2. **視窗限高**：Popup 不超過 viewport 高度，內部技能清單可捲動
3. **頁簽改版**：技能分類從 flex grid 改為 Tab 形式，頁簽顯示類別名稱與數量

---

## 設計

### 一、名稱轉換

在 `openSkillEvaluationPopup()` 的技能列渲染段，插入與 `createSkillCard` 相同的查詢邏輯：

```javascript
const displayName = skillsDatabase.has(skill.name)
    ? (skillsDatabase.get(skill.name).jpName || skill.name)
    : skill.name;
```

將原本的 `nameEl.textContent = skill.name || ''` 改為使用 `displayName`。

---

### 二、Popup 視窗限高

#### CSS 修改

`.eval-modal` 新增：
- `max-height: calc(100vh - 80px)`
- `display: flex; flex-direction: column`

`.eval-modal-body` 新增：
- `overflow-y: auto`
- `flex: 1`
- 移除原有固定 padding（改由 tab 容器與清單各自管理）

#### 結構層次
```
.eval-modal (flex column, max-height 限制)
  ├── .eval-modal-header   (固定高度)
  ├── .eval-tab-bar        (固定高度，Tab 列)
  └── .eval-modal-body     (flex: 1, overflow-y: auto, 技能清單)
```

---

### 三、頁簽（Tab）設計

#### 頁簽列（.eval-tab-bar）
- 放在 `.eval-modal-header` 與 `.eval-modal-body` 之間
- `overflow-x: auto`（橫向捲動，防止 Tab 太多時溢出）
- `white-space: nowrap`

#### 頁簽按鈕（.eval-tab-btn）
- 每個非空分類一個按鈕
- 顯示格式：`{類別名稱} ({數量})`，例如 `固有技能 (12)`
- Active 狀態：底部 border + 顏色區分

#### 分類順序
`['unique', 'accel', 'speed', 'inherited', 'combined', 'other']`（與現有相同）

#### 互動行為
- 初始選中第一個有技能的 Tab
- 切換 Tab 時：更新 `.eval-modal-body` 內容為該分類技能列表，並將 body scrollTop 歸零
- 空分類不產生 Tab 按鈕

#### 移除項目
- 移除 `.eval-category`、`.eval-category-full`（不再需要 flex grid 排版）
- `openSkillEvaluationPopup` 不再一次渲染全部分類，改為渲染單一 Tab 內容的函數 `renderEvalTab(type)`

---

## 不在範疇內

- 不新增後端 API
- 不修改 server.js
- Tab 內不支援技能選取操作
