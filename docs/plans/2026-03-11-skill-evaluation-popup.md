# 技能評價清單 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在賽道資訊分析頁籤新增「技能評價」按鈕，點擊後以 Modal Popup 顯示技能依類型分組的效率排行清單。

**Architecture:** 純前端方案，只修改 `public/index.html`。新增 `classifySkill()` 工具函數根據 skill.id 與 skill.iconId 判斷技能類型（繼承/固有/加速/速度/複合/其他），Popup 開啟時對 `availableSkills` 陣列執行分類、排序、套用現有效率顏色函數後渲染。

**Tech Stack:** Vanilla JS、HTML/CSS（無框架、無測試工具）

---

## 背景知識

本專案是單一 HTML 檔案應用，所有邏輯在 `public/index.html` 內：
- **`availableSkills`**（line 1230）：C 區目前的技能陣列，選好賽道+跑法後填入
- **`calculateEfficiencyTiers(skills, allSkills)`**（line 1700）：計算效率分級，回傳 `Map<id, tier>` ('highest'/'high'/'medium'/'low'/'lowest')
- **`calculateSkillStats(skill, allSkills)`**（line 1312）：計算單一技能效率值

分類規則（依優先序）：
| 條件 | 類型鍵值 | 中文名稱 |
|---|---|---|
| `skill.id >= 900000` | `inherited` | 繼承技能 |
| `skill.iconId` 10011–10062 | `unique` | 固有技能 |
| `skill.iconId` in [20041, 20042] | `accel` | 加速技能 |
| `skill.iconId` in [20011, 20012] | `speed` | 速度技能 |
| `skill.iconId` in [20051, 20052, 20021, 20022] | `combined` | 複合型技能 |
| 其他 | `other` | 其他 |

---

## Task 1: 新增 Modal CSS 樣式

**Files:**
- Modify: `public/index.html:642`（在現有效率顏色樣式 `.skill-range-indicator` 之後插入）

**Step 1: 在 `.skill-range-indicator` 區塊結尾（約 line 654）後插入 Modal CSS**

找到這段：
```css
        .skill-range-indicator {
            display: inline-block;
            font-size: 9px;
            color: #ff9800;
            background: rgba(255, 152, 0, 0.1);
            padding: 1px 4px;
            border-radius: 3px;
            margin-left: 4px;
            border: 1px solid rgba(255, 152, 0, 0.3);
            font-weight: bold;
        }
```

在其後插入：
```css
        /* 技能評價 Popup */
        .eval-btn {
            margin-top: 12px;
            padding: 8px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s;
        }
        .eval-btn:hover:not(:disabled) {
            opacity: 0.85;
            transform: translateY(-1px);
        }
        .eval-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .eval-modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            justify-content: center;
            align-items: flex-start;
            padding: 40px 16px;
            overflow-y: auto;
        }
        .eval-modal-overlay.open {
            display: flex;
        }
        .eval-modal {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 900px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .eval-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #eee;
        }
        .eval-modal-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
        }
        .eval-modal-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
            padding: 4px 8px;
            border-radius: 4px;
            line-height: 1;
        }
        .eval-modal-close:hover { background: #f0f0f0; }
        .eval-modal-body {
            padding: 16px 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }
        .eval-category {
            flex: 1 1 calc(50% - 8px);
            min-width: 260px;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        }
        .eval-category-full {
            flex: 1 1 100%;
        }
        .eval-category-header {
            padding: 8px 12px;
            font-size: 13px;
            font-weight: bold;
            background: #f8f8f8;
            border-bottom: 1px solid #eee;
            color: #333;
        }
        .eval-category-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        .eval-skill-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-bottom: 1px solid #f5f5f5;
            font-size: 13px;
        }
        .eval-skill-row:last-child { border-bottom: none; }
        .eval-skill-icon {
            width: 32px;
            height: 32px;
            object-fit: contain;
            flex-shrink: 0;
        }
        .eval-skill-name {
            flex: 1;
            color: #333;
        }
        .eval-skill-efficiency {
            color: #666;
            font-size: 12px;
            white-space: nowrap;
        }
        .eval-skill-memo {
            font-size: 10px;
            color: #999;
            white-space: nowrap;
        }
```

**Step 2: 驗證**
- `npm start` 啟動伺服器
- 開啟 `http://localhost:10010`，開啟開發者工具 Console，確認無 CSS 錯誤

**Step 3: Commit**
```bash
git add public/index.html
git commit -m "feat: add CSS for skill evaluation modal"
```

---

## Task 2: 新增「技能評價」按鈕與 Modal HTML

**Files:**
- Modify: `public/index.html:937`（B 區跑法選擇 `</div></div>` 後插入按鈕）
- Modify: `public/index.html:991`（`</div>` analysis tab 結束前插入 Modal）

**Step 1: 在 B 區結尾後新增按鈕**

找到（約 line 936-937）：
```html
                </div>
            </div>

            <!-- C區 + 箭頭 + D區 -->
```

在兩個 `</div>` 與 `<!-- C區` 之間插入：
```html
            <!-- 技能評價按鈕 -->
            <div class="analysis-section" style="padding-top: 0;">
                <button id="skillEvalBtn" class="eval-btn" disabled onclick="openSkillEvaluationPopup()">
                    📊 技能評價
                </button>
            </div>
```

**Step 2: 在 analysis tab 結束 `</div>` 前（約 line 991）插入 Modal HTML**

找到：
```html
        </div>
    </div>

    <script>
```

在第一個 `</div>` 前插入：
```html
        <!-- 技能評價 Modal -->
        <div id="skillEvalModal" class="eval-modal-overlay" onclick="handleEvalOverlayClick(event)">
            <div class="eval-modal">
                <div class="eval-modal-header">
                    <span class="eval-modal-title" id="evalModalTitle">📊 技能評價清單</span>
                    <button class="eval-modal-close" onclick="closeSkillEvaluationPopup()">✕</button>
                </div>
                <div class="eval-modal-body" id="evalModalBody">
                </div>
            </div>
        </div>
```

**Step 3: 驗證**
- 重新整理頁面，確認 B 區下方出現灰色「📊 技能評價」按鈕
- 確認按鈕目前為 disabled 狀態（無法點擊）

**Step 4: Commit**
```bash
git add public/index.html
git commit -m "feat: add skill evaluation button and modal HTML"
```

---

## Task 3: 新增 classifySkill() 函數

**Files:**
- Modify: `public/index.html`（在 `calculateEfficiencyTiers` 函數之後，約 line 1769，插入新函數）

**Step 1: 在 `calculateEfficiencyTiers` 函數結尾（`return tierMap; }` 後）插入**

找到：
```javascript
            return tierMap;
        }

        // 技能搜尋過濾
        function filterSkills(keyword) {
```

在 `return tierMap; }` 與 `// 技能搜尋過濾` 之間插入：

```javascript
        // 技能分類函數
        const SKILL_CATEGORIES = {
            inherited: '繼承技能',
            unique:    '固有技能',
            accel:     '加速技能',
            speed:     '速度技能',
            combined:  '複合型技能',
            other:     '其他'
        };

        function classifySkill(skill) {
            const id = skill.id;
            const iconId = skill.iconId;

            if (id >= 900000)                                           return 'inherited';
            if (iconId >= 10011 && iconId <= 10062)                     return 'unique';
            if (iconId === 20041 || iconId === 20042)                   return 'accel';
            if (iconId === 20011 || iconId === 20012)                   return 'speed';
            if ([20051, 20052, 20021, 20022].includes(iconId))          return 'combined';
            return 'other';
        }
```

**Step 2: 驗證**
- 開啟開發者工具 Console
- 確認 `classifySkill` 函數可呼叫（輸入測試）：
  ```javascript
  // 在 Console 執行（先載入一個賽道讓 availableSkills 有資料）
  console.log(classifySkill({ id: 900041, iconId: 20041 })); // → "inherited"
  console.log(classifySkill({ id: 200021, iconId: 10011 })); // → "unique"
  console.log(classifySkill({ id: 202741, iconId: 20012 })); // → "speed"
  console.log(classifySkill({ id: 201602, iconId: 20042 })); // → "accel"
  console.log(classifySkill({ id: 201131, iconId: 20052 })); // → "combined"
  ```

**Step 3: Commit**
```bash
git add public/index.html
git commit -m "feat: add classifySkill utility function"
```

---

## Task 4: 新增 openSkillEvaluationPopup() 與 closeSkillEvaluationPopup()

**Files:**
- Modify: `public/index.html`（在 `resetSkillPanels` 函數之後，`</script>` 之前插入）

**Step 1: 在 `resetSkillPanels` 函數結尾後（約 line 2095）插入兩個函數**

找到：
```javascript
        // 重置技能面板
        function resetSkillPanels() {
            ...
        }
    </script>
```

在 `}` 與 `</script>` 之間插入：

```javascript
        // 開啟技能評價 Popup
        function openSkillEvaluationPopup() {
            if (availableSkills.length === 0) return;

            // 更新標題
            const title = document.getElementById('evalModalTitle');
            const courseLabel = selectedCourse
                ? `${selectedCourse.courseName} ${selectedCourse.distance}(${selectedCourse.surface}) ${selectedRunningStyle}`
                : '';
            title.textContent = `📊 技能評價清單  ${courseLabel}`;

            // 分類所有技能
            const groups = {};
            const allSkills = [...availableSkills, ...selectedSkills];

            availableSkills.forEach(skill => {
                const type = classifySkill(skill);
                if (!groups[type]) groups[type] = [];
                groups[type].push(skill);
            });

            // 各分類內依效率降序排序
            Object.keys(groups).forEach(type => {
                groups[type].sort((a, b) => {
                    const sa = calculateSkillStats(a, allSkills);
                    const sb = calculateSkillStats(b, allSkills);
                    return sb.efficiency - sa.efficiency;
                });
            });

            // 渲染 Modal 內容
            const body = document.getElementById('evalModalBody');
            body.innerHTML = '';

            const categoryOrder = ['unique', 'accel', 'speed', 'inherited', 'combined', 'other'];
            const fullWidthCategories = new Set(['inherited', 'other']);

            categoryOrder.forEach(type => {
                const skills = groups[type];
                if (!skills || skills.length === 0) return;

                // 計算此分類的效率分級
                const tierMap = calculateEfficiencyTiers(skills, allSkills);

                const section = document.createElement('div');
                section.className = 'eval-category' + (fullWidthCategories.has(type) ? ' eval-category-full' : '');

                const header = document.createElement('div');
                header.className = 'eval-category-header';
                header.textContent = SKILL_CATEGORIES[type];
                section.appendChild(header);

                const list = document.createElement('ul');
                list.className = 'eval-category-list';

                skills.forEach(skill => {
                    const stats = calculateSkillStats(skill, allSkills);
                    const tier = tierMap.get(skill.id);

                    const row = document.createElement('li');
                    row.className = 'eval-skill-row';

                    // 圖示
                    const img = document.createElement('img');
                    img.className = 'eval-skill-icon';
                    img.src = skill.icon || '';
                    img.alt = skill.name || '';
                    row.appendChild(img);

                    // 技能名稱（套用效率顏色）
                    const nameEl = document.createElement('span');
                    nameEl.className = 'eval-skill-name' + (tier ? ` efficiency-tier-${tier}` : '');
                    nameEl.textContent = skill.name || '';
                    row.appendChild(nameEl);

                    // 效率值
                    if (stats.efficiency > 0) {
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

                section.appendChild(list);
                body.appendChild(section);
            });

            // 開啟 Modal
            document.getElementById('skillEvalModal').classList.add('open');
        }

        // 關閉技能評價 Popup
        function closeSkillEvaluationPopup() {
            document.getElementById('skillEvalModal').classList.remove('open');
        }

        // 點擊遮罩關閉
        function handleEvalOverlayClick(event) {
            if (event.target === event.currentTarget) {
                closeSkillEvaluationPopup();
            }
        }
```

**Step 2: 驗證**
- 選擇任意賽道與跑法
- 確認「📊 技能評價」按鈕變為可點擊（enabled）
- 點擊按鈕，確認 Modal 出現且顯示技能分組
- 確認效率值有顏色（紅/橘/紫/藍/黑）
- 確認繼承技能列有顯示 memo 來源
- 點擊 ✕ 或背景遮罩，確認 Modal 關閉

**Step 3: Commit**
```bash
git add public/index.html
git commit -m "feat: add skill evaluation popup open/close logic"
```

---

## Task 5: 技能載入後啟用評價按鈕

**Files:**
- Modify: `public/index.html:1578-1585`（`loadSkillsForCourse` 函數內，技能載入成功後啟用按鈕）

**Step 1: 在 `availableSkills = Array.from(...)` 賦值後啟用按鈕**

找到（約 line 1578）：
```javascript
                    availableSkills = Array.from(uniqueSkillsMap.values());
                    selectedSkills = []; // 重置D區
                    selectedAvailableSkillIds.clear();
                    selectedSelectedSkillIds.clear();

                    renderAvailableSkills();
                    renderSelectedSkills();
                    updateArrowButtons();
```

在 `updateArrowButtons();` 後新增一行：
```javascript
                    // 啟用技能評價按鈕
                    const evalBtn = document.getElementById('skillEvalBtn');
                    if (evalBtn) evalBtn.disabled = false;
```

**Step 2: 在 `resetSkillPanels()` 函數內重置按鈕為 disabled**

找到 `resetSkillPanels` 函數內 `updateArrowButtons();` 後插入：
```javascript
            // 停用技能評價按鈕
            const evalBtn = document.getElementById('skillEvalBtn');
            if (evalBtn) evalBtn.disabled = true;
```

**Step 3: 驗證完整流程**
- 重新整理頁面：「技能評價」按鈕為 disabled（灰色）
- 選擇賽道（不選跑法）：按鈕仍 disabled
- 選擇跑法：按鈕變為可用（紫色漸層）
- 點擊按鈕：Modal 開啟，顯示 6 分類中有資料的分類
- 切換至其他跑法：按鈕仍可用，點擊後顯示新資料
- 選擇不同賽道：按鈕重置為 disabled，選跑法後重新啟用

**Step 4: Commit**
```bash
git add public/index.html
git commit -m "feat: enable evaluation button after skills load, disable on reset"
```

---

## 完成驗證清單

- [ ] 按鈕預設 disabled，選好賽道+跑法後才啟用
- [ ] Popup 標題顯示賽道名稱與跑法
- [ ] 技能正確分成 固有/加速/速度/繼承/複合型/其他 六類
- [ ] 各類內按效率降序排列
- [ ] 效率顏色（紅/橘/紫/藍/黑）套用正確，各類獨立排名
- [ ] 繼承技能顯示 memo 來源欄位
- [ ] 空分類不顯示
- [ ] 點擊 ✕ 或遮罩可關閉 Modal
- [ ] 切換賽道/跑法後，重新點擊按鈕顯示新資料
