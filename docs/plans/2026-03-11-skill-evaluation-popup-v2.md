# 技能評價 Popup 優化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 優化技能評價 Popup：技能名稱查詢 skillsDatabase、Popup 限高可捲動、分類改為 Tab 頁簽形式。

**Architecture:** 純前端，只修改 `public/index.html`。三個獨立 Task：CSS 調整、HTML 插入 Tab 列、JS 重構 openSkillEvaluationPopup() 並新增 renderEvalTab()。JS 重構需要在 script 區增加 4 個模組級變數儲存 Popup 狀態供 Tab 切換使用。

**Tech Stack:** Vanilla JS、HTML/CSS（無框架）

---

## 背景知識

**現有相關程式碼（public/index.html）：**

- `skillsDatabase`（全域 Map）：鍵為技能日文名稱，值為 `{ jpName, enName, icon }`
- `availableSkills`、`selectedSkills`：全域陣列
- `selectedCourse`、`selectedRunningStyle`：全域變數
- `calculateSkillStats(skill, allSkills)`：回傳含 `efficiency` 的物件
- `calculateEfficiencyTiers(skills, allSkills)`：回傳 `Map<id, tier>`
- `classifySkill(skill)`：回傳 'unique'|'accel'|'speed'|'inherited'|'combined'|'other'
- `SKILL_CATEGORIES`：`{ unique:'固有技能', accel:'加速技能', speed:'速度技能', inherited:'繼承技能', combined:'複合型技能', other:'其他' }`

**現有 CSS 行號（偏移後）：**
- `.eval-modal` 在 line 721–727：無 max-height，無 flex
- `.eval-modal-body` 在 line 751–756：`display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 20px;`
- `.eval-tab-bar`：不存在

**現有 HTML 行號：**
- Modal 在 line 2407–2417：header → body（無 tab bar）

**現有 JS 行號：**
- `openSkillEvaluationPopup()` 在 line 2288–2393

---

## Task 1: 修改 CSS（eval-modal 限高 + eval-modal-body 捲動 + Tab 樣式）

**Files:**
- Modify: `public/index.html:721-756`

### Step 1: 修改 `.eval-modal` 規則（line 721–727）

找到：
```css
        .eval-modal {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 900px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
```

替換為：
```css
        .eval-modal {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 900px;
            max-height: calc(100vh - 80px);
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
```

### Step 2: 修改 `.eval-modal-body` 規則（line 751–756）

找到：
```css
        .eval-modal-body {
            padding: 16px 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }
```

替換為：
```css
        .eval-modal-body {
            padding: 0;
            overflow-y: auto;
            flex: 1;
        }
```

### Step 3: 在 `.eval-modal-body` 規則之後插入 Tab 相關樣式

在修改後的 `.eval-modal-body { }` 規則結尾後插入：
```css
        .eval-tab-bar {
            display: flex;
            overflow-x: auto;
            white-space: nowrap;
            border-bottom: 2px solid #eee;
            padding: 0 16px;
            flex-shrink: 0;
            background: white;
        }
        .eval-tab-bar::-webkit-scrollbar {
            height: 4px;
        }
        .eval-tab-bar::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 2px;
        }
        .eval-tab-btn {
            display: inline-block;
            padding: 10px 14px;
            font-size: 13px;
            color: #666;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            cursor: pointer;
            white-space: nowrap;
            transition: color 0.2s;
        }
        .eval-tab-btn:hover {
            color: #667eea;
        }
        .eval-tab-btn.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: bold;
        }
        .eval-tab-content {
            padding: 12px 20px;
        }
```

### Step 4: 驗證

開啟 `http://localhost:10010`，開啟 DevTools Console，確認無 CSS 錯誤。

### Step 5: Commit

```bash
git add public/index.html
git commit -m "feat: update eval modal CSS for tab layout and viewport height limit"
```

---

## Task 2: 在 HTML Modal 中插入 Tab 列容器

**Files:**
- Modify: `public/index.html:2410-2415`（行號因 Task 1 CSS 插入而偏移，請以內容定位）

### Step 1: 在 `.eval-modal-header` 與 `.eval-modal-body` 之間插入 Tab 列

找到：
```html
            <div class="eval-modal-header">
                <span class="eval-modal-title" id="evalModalTitle">📊 技能評價清單</span>
                <button class="eval-modal-close" onclick="closeSkillEvaluationPopup()">✕</button>
            </div>
            <div class="eval-modal-body" id="evalModalBody">
            </div>
```

替換為：
```html
            <div class="eval-modal-header">
                <span class="eval-modal-title" id="evalModalTitle">📊 技能評價清單</span>
                <button class="eval-modal-close" onclick="closeSkillEvaluationPopup()">✕</button>
            </div>
            <div class="eval-tab-bar" id="evalTabBar"></div>
            <div class="eval-modal-body" id="evalModalBody">
            </div>
```

### Step 2: 驗證

重新整理頁面，選好賽道+跑法，點擊「📊 技能評價」，確認 Modal 結構中有 `id="evalTabBar"` 的 div（DevTools Elements）。

### Step 3: Commit

```bash
git add public/index.html
git commit -m "feat: add tab bar container to eval modal HTML"
```

---

## Task 3: 重構 JS — openSkillEvaluationPopup() 改為 Tab 架構

**Files:**
- Modify: `public/index.html`（script 區塊）

### Step 1: 在現有模組級變數宣告區（`availableSkills`、`selectedSkills` 附近）新增 4 個 Popup 狀態變數

找到（約 line 1358）：
```javascript
        let availableSkills = []; // C區：可選技能
        let selectedSkills = []; // D區：已選技能
```

在這兩行之後新增：
```javascript
        // 技能評價 Popup 狀態
        let evalGroups = {};
        let evalStatsCache = new Map();
        let evalAllSkills = [];
        let evalActiveType = null;
```

### Step 2: 完整替換 `openSkillEvaluationPopup()` 函數

找到整個函數（從 `function openSkillEvaluationPopup() {` 到對應的結尾 `}`）並完整替換為：

```javascript
        // 開啟技能評價 Popup
        function openSkillEvaluationPopup() {
            if (availableSkills.length === 0) return;

            // 更新標題
            const title = document.getElementById('evalModalTitle');
            const courseLabel = selectedCourse
                ? `${selectedCourse.courseName} ${selectedCourse.distance}(${selectedCourse.surface}) ${selectedRunningStyle}`
                : '';
            if (title) title.textContent = `📊 技能評價清單  ${courseLabel}`;

            // 建立全技能池（供效率計算）
            evalAllSkills = [...availableSkills, ...selectedSkills];

            // 預先計算 stats 快取
            evalStatsCache = new Map();
            availableSkills.forEach(skill => {
                evalStatsCache.set(skill.id, calculateSkillStats(skill, evalAllSkills));
            });

            // 分類
            evalGroups = {};
            availableSkills.forEach(skill => {
                const type = classifySkill(skill);
                if (!evalGroups[type]) evalGroups[type] = [];
                evalGroups[type].push(skill);
            });

            // 各分類依效率降序排序
            const categoryOrder = ['unique', 'accel', 'speed', 'inherited', 'combined', 'other'];
            categoryOrder.forEach(type => {
                if (!evalGroups[type]) return;
                evalGroups[type].sort((a, b) => {
                    return (evalStatsCache.get(b.id).efficiency || 0) - (evalStatsCache.get(a.id).efficiency || 0);
                });
            });

            // 渲染 Tab 按鈕列
            const tabBar = document.getElementById('evalTabBar');
            if (tabBar) {
                tabBar.innerHTML = '';
                categoryOrder.forEach(type => {
                    if (!evalGroups[type] || evalGroups[type].length === 0) return;
                    const btn = document.createElement('button');
                    btn.className = 'eval-tab-btn';
                    btn.dataset.type = type;
                    btn.textContent = `${SKILL_CATEGORIES[type]} (${evalGroups[type].length})`;
                    btn.onclick = () => switchEvalTab(type);
                    tabBar.appendChild(btn);
                });
            }

            // 選中第一個有技能的分類
            const firstType = categoryOrder.find(t => evalGroups[t] && evalGroups[t].length > 0);
            if (firstType) {
                switchEvalTab(firstType);
            }

            // 開啟 Modal
            document.getElementById('skillEvalModal').classList.add('open');
        }
```

### Step 3: 在 `openSkillEvaluationPopup()` 之後（`closeSkillEvaluationPopup` 之前）插入兩個新函數

```javascript
        // 切換 Tab
        function switchEvalTab(type) {
            evalActiveType = type;

            // 更新 Tab 按鈕 active 狀態
            const tabBar = document.getElementById('evalTabBar');
            if (tabBar) {
                tabBar.querySelectorAll('.eval-tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.type === type);
                });
            }

            // 渲染技能清單
            renderEvalTab(type);
        }

        // 渲染指定分類的技能清單
        function renderEvalTab(type) {
            const body = document.getElementById('evalModalBody');
            if (!body) return;

            body.scrollTop = 0;
            body.innerHTML = '';

            const skills = evalGroups[type];
            if (!skills || skills.length === 0) {
                body.innerHTML = '<div style="padding: 20px; color: #999; text-align: center;">此分類無技能</div>';
                return;
            }

            const tierMap = calculateEfficiencyTiers(skills, evalAllSkills);

            const list = document.createElement('ul');
            list.className = 'eval-category-list eval-tab-content';

            skills.forEach(skill => {
                const stats = evalStatsCache.get(skill.id);
                const tier = tierMap.get(skill.id);

                // 名稱轉換（查詢 skillsDatabase）
                const displayName = skillsDatabase.has(skill.name)
                    ? (skillsDatabase.get(skill.name).jpName || skill.name)
                    : skill.name;

                const row = document.createElement('li');
                row.className = 'eval-skill-row';

                // 圖示
                const img = document.createElement('img');
                img.className = 'eval-skill-icon';
                img.src = skill.icon || '';
                img.alt = displayName;
                row.appendChild(img);

                // 技能名稱（套用效率顏色）
                const nameEl = document.createElement('span');
                nameEl.className = 'eval-skill-name' + (tier ? ` efficiency-tier-${tier}` : '');
                nameEl.textContent = displayName;
                row.appendChild(nameEl);

                // 效率值
                if (stats && stats.efficiency > 0) {
                    const effEl = document.createElement('span');
                    effEl.className = 'eval-skill-efficiency' + (tier ? ` efficiency-tier-${tier}` : '');
                    effEl.textContent = `${stats.efficiency.toFixed(2)} [バ/Pt]`;
                    row.appendChild(effEl);
                }

                // 繼承技能來源（memo）
                if (type === 'inherited' && skill.memo) {
                    const memoEl = document.createElement('span');
                    memoEl.className = 'eval-skill-memo';
                    memoEl.textContent = skill.memo;
                    row.appendChild(memoEl);
                }

                list.appendChild(row);
            });

            body.appendChild(list);
        }
```

### Step 4: 驗證

1. 選擇賽道（例如：京都 2200m 逃げ），點擊「📊 技能評價」
2. 確認：
   - Popup 高度不超出頁面（不需要整個頁面捲動）
   - 頂部有 Tab 按鈕列，格式為 `固有技能 (N)` 等
   - 空分類無 Tab
   - 點擊不同 Tab 切換技能清單
   - 技能名稱顯示為 jpName（例如「左回りの鬼」而非原始名）
   - 效率顏色正常顯示（紅/橘/紫/藍/黑）
   - 繼承技能 Tab 顯示 memo（來源角色）
   - 技能清單超過 Modal 高度時可在 body 內部捲動

### Step 5: Commit

```bash
git add public/index.html
git commit -m "feat: refactor eval popup to tab layout with skill name translation"
```

---

## 完成驗證清單

- [ ] Popup 高度不超過 viewport，內部清單可捲動
- [ ] Tab 按鈕格式：`{類別名稱} ({數量})`
- [ ] 空分類不顯示 Tab 按鈕
- [ ] 預設選中第一個有技能的 Tab
- [ ] 切換 Tab 時清單更新且捲動回頂部
- [ ] 技能名稱使用 skillsDatabase 的 jpName
- [ ] 效率顏色各 Tab 獨立排名，顏色正確
- [ ] 繼承技能顯示 memo 來源
- [ ] 點擊 ✕ 或遮罩可關閉
