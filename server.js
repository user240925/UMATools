const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = 3000;

// 輔助函數：生成檔案名稱（時間戳記 + 語系）
function generateFileName(language = 'tw') {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  return `${timestamp}_${language}.json`;
}

// 輔助函數：確保目錄存在
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// 輔助函數：檢查檔案是否存在
function fileExists(filePath) {
  try {
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}

// 輔助函數：下載圖片
async function downloadImage(imageUrl, savePath) {
  try {
    // 確保圖片 URL 是完整的
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      // 假設圖片來自 gametora.com
      fullUrl = `https://gametora.com${imageUrl}`;
    }

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    // 確保目錄存在
    const dir = path.dirname(savePath);
    await ensureDirectoryExists(dir);

    // 寫入圖片
    await fs.writeFile(savePath, response.data);
    return true;
  } catch (error) {
    console.error(`下載圖片失敗 ${imageUrl}:`, error.message);
    return false;
  }
}

// 輔助函數：儲存技能數據並下載圖片
async function saveSkillsData(skillsData, language = 'tw') {
  try {
    // 確保 data/skills 目錄存在
    await ensureDirectoryExists('./data/skills');

    // 生成檔案名稱
    const fileName = generateFileName(language);
    const filePath = path.join('./data/skills', fileName);

    // 只保留 skills 陣列，移除 debugInfo 等其他資訊
    const cleanedData = {
      skills: skillsData.skills || []
    };

    // 儲存 JSON 檔案
    await fs.writeFile(filePath, JSON.stringify(cleanedData, null, 2), 'utf-8');
    console.log(`已儲存技能數據: ${filePath}`);

    // 下載所有技能圖示
    if (skillsData.skills && Array.isArray(skillsData.skills)) {
      let downloadCount = 0;
      let skipCount = 0;

      for (const skill of skillsData.skills) {
        if (skill.icon) {
          // 從 icon 路徑提取檔案名稱
          const iconFileName = path.basename(skill.icon);
          const imageSavePath = path.join('./data/images/umamusume/skill_icons', iconFileName);

          // 檢查圖片是否已存在
          if (fileExists(imageSavePath)) {
            skipCount++;
            console.log(`圖片已存在，略過: ${iconFileName}`);
          } else {
            // 下載圖片
            const success = await downloadImage(skill.icon, imageSavePath);
            if (success) {
              downloadCount++;
              console.log(`已下載圖片: ${iconFileName}`);
            }
          }
        }
      }

      console.log(`圖片下載完成！新下載: ${downloadCount} 個，略過: ${skipCount} 個`);
    }

    return {
      success: true,
      filePath: filePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('儲存技能數據時發生錯誤:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

app.use(express.json());
app.use(express.static('public'));

function parseUrlParameters(url) {
  try {
    // 解析 URL: https://xn--gck1f423k.xn--1bvt37a.tools/race/courses/10301/effects/betweener
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part);

    let courseId = '';
    let effectType = '';

    // 尋找 courses 和 effects 的索引
    const coursesIndex = pathParts.indexOf('courses');
    const effectsIndex = pathParts.indexOf('effects');

    if (coursesIndex !== -1 && coursesIndex + 1 < pathParts.length) {
      courseId = pathParts[coursesIndex + 1];
    }

    if (effectsIndex !== -1 && effectsIndex + 1 < pathParts.length) {
      effectType = pathParts[effectsIndex + 1];
    }

    return {
      courseId: courseId || '未找到',
      effectType: effectType || '未找到'
    };
  } catch (error) {
    return {
      courseId: '解析失敗',
      effectType: '解析失敗'
    };
  }
}

function parseSkillData(html) {
  const $ = cheerio.load(html);

  const skillList = [];
  const debugInfo = {
    foundElements: {},
    searchAttempts: []
  };

  // 尋找所有 skills_table_row 的 div 元素
  $('[class*="skills_table_row"]').each(function (index) {
    const row = $(this);

    // 獲取圖標路徑
    const iconElement = row.find('[class*="skills_table_icon"] img');
    const iconSrc = iconElement.attr('src') || '';

    // 獲取翻譯名稱（日文名稱）- 使用更精確的選擇器
    const jpNameElement = row.children('[class*="skills_table_jpname"]').first();
    const jpName = jpNameElement.text().trim();

    // 獲取原始名稱（英文名稱）- 先嘗試直接子元素,如果找不到則在整個 row 內搜索
    let enNameElement = row.children('[class*="skills_table_enname"]').first();
    let enName = enNameElement.text().trim();

    // 如果直接子元素沒找到,嘗試在 row 內部搜索
    if (!enName) {
      enNameElement = row.find('[class*="skills_table_enname"]').first();
      enName = enNameElement.text().trim();
    }

    // 調試：記錄找到的元素的詳細資訊
    const allDirectChildren = [];
    row.children('div').each(function () {
      const childClass = $(this).attr('class') || '';
      const childText = $(this).text().trim();
      allDirectChildren.push({
        class: childClass,
        text: childText.substring(0, 50),
        hasJpName: childClass.includes('skills_table_jpname'),
        hasEnName: childClass.includes('skills_table_enname'),
        hasIcon: childClass.includes('skills_table_icon')
      });
    });

    debugInfo.foundElements[index] = {
      row_html: row.html()?.substring(0, 400),
      icon_src: iconSrc,
      icon_found: !!iconSrc,
      jpName: jpName,
      jpName_found: !!jpName,
      jpName_classes: jpNameElement.attr('class') || 'NOT_FOUND',
      jpName_html: jpNameElement.html()?.substring(0, 100) || 'NOT_FOUND',
      enName: enName,
      enName_found: !!enName,
      enName_classes: enNameElement.attr('class') || 'NOT_FOUND',
      enName_html: enNameElement.html()?.substring(0, 100) || 'NOT_FOUND',
      direct_children: allDirectChildren
    };

    // 只添加有內容的技能
    if (iconSrc || jpName || enName) {
      skillList.push({
        icon: iconSrc,
        jpName: jpName,
        enName: enName
      });
    }
  });

  debugInfo.searchAttempts.push({
    method: 'search_skills_table_row_divs',
    found: skillList.length
  });

  // 如果還是沒有找到，提供詳細的調試資訊
  if (skillList.length === 0) {
    const detailedDebug = [];
    $('.skills_skill_table__ZoEHP').find('[class*="skills_table"]').each(function () {
      const elem = $(this);
      detailedDebug.push({
        class: elem.attr('class'),
        tag: this.name,
        text: elem.text().trim().substring(0, 100),
        html: elem.html()?.substring(0, 300)
      });
    });

    return {
      totalSkills: 0,
      skills: [],
      debug: detailedDebug,
      debugInfo: debugInfo,
      message: '未找到符合條件的技能資料，請檢查 HTML 結構'
    };
  }

  return {
    totalSkills: skillList.length,
    skills: skillList,
    debugInfo: debugInfo
  };
}

function parseRaceCourseData(html) {
  const $ = cheerio.load(html);

  // ========== 步驟 1: 從 <script> 標籤提取完整技能 JSON 數據 ==========
  let scriptSkillsMap = new Map(); // id -> skill data
  let groupIdMap = new Map(); // groupId -> [skill ids]

  try {
    // 尋找包含技能數據的 script 標籤
    let scriptData = null;
    $('script').each(function() {
      const content = $(this).html();
      if (content && content.includes('skillName') && content.includes('groupId') && content.length > 100000) {
        scriptData = content;
        return false; // 找到後停止
      }
    });

    if (scriptData) {
      console.log('[Script解析] 找到技能數據 script，長度:', scriptData.length);

      // 使用正則提取所有技能物件
      // 匹配模式：{"id":數字,"rarity":數字,...}
      const skillPattern = /\\"id\\":(\d+),\\"rarity\\":(\d+),\\"groupId\\":(\d+),\\"groupRate\\":(\d+),\\"gradeValue\\":(\d+)[^}]*\\"skillName\\":\\"([^"\\]+)[^}]*\\"skillDesc\\":\\"([^"\\]*)/g;

      let match;
      let skillCount = 0;

      while ((match = skillPattern.exec(scriptData)) !== null) {
        const [, id, rarity, groupId, groupRate, gradeValue, skillName, skillDesc] = match;

        // 在匹配位置附近查找 iconId 和 needSkillPoint
        const pos = match.index;
        const context = scriptData.substring(Math.max(0, pos - 100), Math.min(scriptData.length, pos + 500));
        const iconMatch = context.match(/\\"iconId\\":(\d+)/);
        const iconId = iconMatch ? iconMatch[1] : null;

        const needSkillPointMatch = context.match(/\\"needSkillPoint\\":(\d+|null)/);
        let needSkillPoint = null;
        if (needSkillPointMatch) {
          needSkillPoint = needSkillPointMatch[1] === 'null' ? null : parseInt(needSkillPointMatch[1]);
        }

        const skill = {
          id: parseInt(id),
          rarity: parseInt(rarity),
          groupId: parseInt(groupId),
          groupRate: parseInt(groupRate),
          gradeValue: parseInt(gradeValue),
          iconId: iconId ? parseInt(iconId) : null,
          needSkillPoint: needSkillPoint,
          name: skillName,
          description: skillDesc.replace(/\\\\n/g, '\n')
        };

        scriptSkillsMap.set(skill.id, skill);

        // 建立 groupId 索引
        if (!groupIdMap.has(skill.groupId)) {
          groupIdMap.set(skill.groupId, []);
        }
        groupIdMap.get(skill.groupId).push(skill.id);

        skillCount++;
      }

      console.log(`[Script解析] 成功提取 ${skillCount} 個技能`);
      console.log(`[Script解析] 共 ${groupIdMap.size} 個不同的群組`);
    } else {
      console.log('[Script解析] 未找到技能數據 script，將只使用 HTML 解析');
    }
  } catch (error) {
    console.error('[Script解析] 錯誤:', error.message);
  }

  // 輔助函數：從 skillCard 元素提取技能資訊
  function extractSkillInfo(skillCard, containerIndex = 0) {
    // 基本資訊 - 使用多種可能的選擇器
    const name = skillCard.find('[class*="skillCard__name"]').first().text().trim();
    const effect = skillCard.find('[class*="skillCard__effect"]').first().text().trim();
    const memo = skillCard.find('[class*="skillCard__memo"]').first().text().trim();
    const description = skillCard.find('[class*="description"], [class*="desc"]').first().text().trim();

      // 分割 effect 數據（用、或,分隔）
      const effectList = effect ? effect.split(/[、,]/).map(item => item.trim()).filter(item => item.length > 0) : [];

      // 提取圖片 - 優先從 background-image 提取
      let icon = '';
      const iconDiv = skillCard.find('[class*="skillCard__icon"]').first();
      if (iconDiv.length > 0) {
        const styleAttr = iconDiv.attr('style') || '';
        const bgMatch = styleAttr.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/);
        if (bgMatch) {
          // 移除 &amp; 並解碼 HTML 實體
          icon = bgMatch[1].replace(/&amp;/g, '&');
        }
      }

      // 如果沒找到 background-image，嘗試找 img 標籤
      if (!icon) {
        const imgElement = skillCard.find('img').first();
        if (imgElement.length > 0) {
          icon = imgElement.attr('src') || '';
        }
      }

      // 收集所有圖片（包括 img 標籤）
      const images = [];
      if (icon) {
        images.push({ src: icon, alt: name });
      }
      skillCard.find('img').each(function () {
        const src = $(this).attr('src');
        const alt = $(this).attr('alt');
        if (src && src !== icon) {
          images.push({ src, alt: alt || '' });
        }
      });

      // 收集所有 input 元素
      const inputs = [];
      skillCard.find('input').each(function () {
        const input = $(this);
        inputs.push({
          type: input.attr('type') || '',
          value: input.val() || input.attr('value') || '',
          max: input.attr('max') || '',
          min: input.attr('min') || '',
          placeholder: input.attr('placeholder') || '',
          name: input.attr('name') || '',
          class: input.attr('class') || ''
        });
      });

      // 獲取主要的 input value
      const spinnerInput = skillCard.find('[class*="hintSpinner"] input, [class*="spinner"] input').first();
      const value = spinnerInput.val() || spinnerInput.attr('value') || '';
      const maxValue = spinnerInput.attr('max') || '';
      const minValue = spinnerInput.attr('min') || '';

      // 收集所有帶有 class 的 div 和 span 元素
      const elements = [];
      skillCard.find('div, span').each(function () {
        const elem = $(this);
        const elemClass = elem.attr('class') || '';
        const elemText = elem.contents().filter(function () {
          return this.type === 'text';
        }).text().trim();

        if (elemText && elemClass) {
          elements.push({
            tag: this.name,
            class: elemClass,
            text: elemText
          });
        }
      });

      // 額外的數據屬性
      const dataAttributes = {};
      const attrs = skillCard.get(0)?.attribs || {};
      Object.keys(attrs).forEach(key => {
        if (key.startsWith('data-')) {
          dataAttributes[key] = attrs[key];
        }
      });

      // 收集所有 class 名稱
      const classes = skillCard.attr('class') || '';

      // 檢測顏色/樣式資訊
      const style = skillCard.attr('style') || '';

      // 檢查是否有顏色相關的 class
      let colorIndicator = '';
      let rowType = '';

      // 檢查常見的顏色/樣式 class 名稱
      if (classes.includes('yellow') || classes.includes('highlight') || classes.includes('odd')) {
        colorIndicator = 'yellow';
      } else if (classes.includes('white') || classes.includes('even')) {
        colorIndicator = 'white';
      }

      // 檢查 style 屬性中的背景顏色
      if (style.includes('background')) {
        colorIndicator = style.match(/background[^;]*/)?.[0] || '';
      }

      // 檢查在父元素中的索引（奇數/偶數行）
      const index = skillCard.parent().children().index(skillCard);
      rowType = index % 2 === 0 ? 'even' : 'odd';

      // 檢查所有可能包含顏色資訊的屬性
      const allAttribs = skillCard.get(0)?.attribs || {};
      const styleRelatedAttribs = {};
      Object.keys(allAttribs).forEach(key => {
        if (key.includes('color') || key.includes('style') || key.includes('theme') ||
          key.includes('variant') || key.includes('type')) {
          styleRelatedAttribs[key] = allAttribs[key];
        }
      });

    // 獲取 skillCard 的 HTML 結構（僅前 500 字符，用於調試）
    const htmlStructure = skillCard.html()?.substring(0, 500) || '';

    return {
      name: name,
      memo: memo,
      effect: effect,
      effectList: effectList,
      description: description,
      icon: icon,
      images: images,
      value: value,
      maxValue: maxValue,
      minValue: minValue,
      inputs: inputs,
      elements: elements,
      dataAttributes: dataAttributes,
      classes: classes,
      style: style,
      colorIndicator: colorIndicator,
      rowType: rowType,
      rowIndex: index,
      styleRelatedAttribs: styleRelatedAttribs,
      htmlStructure: htmlStructure
    };
  }

  // 擷取 headlineDefault_component_headlineDefault__body 內的 text
  const headline = $('[class*="headlineDefault_component_headlineDefault__body"]').text().trim();

  // 擷取 courseSkillEffectTable 底下的所有資訊
  const skillList = [];

  // 只查找最外層的 container
  $('[class*="courseSkillEffectTable_component_courseSkillEffectTable"]').each(function () {
    $(this).find('[class*="courseSkillEffectTableRow_component_container"]').each(function (containerIndex) {
      const container = $(this);

      // 找出 container 內的所有 skillCard（包含所有稀有度類型）
      // 優先查找帶稀有度標記的 skillCard (normal, unique, ur, ssr 等)
      let allSkillCards = container.find('[class*="skillCard--"]');

      // 如果沒找到帶稀有度標記的，則查找 skillCard__body
      if (allSkillCards.length === 0) {
        allSkillCards = container.find('[class*="skillCard__body"]');
      }

      if (allSkillCards.length === 0) return; // 如果沒找到任何 skillCard，跳過

      // 提取主技能（第一個 skillCard）
      const mainSkillCard = allSkillCards.first();

      // 提取稀有度類型（只保留類型名稱，去掉 CSS 模組後綴）
      const rarityMatch = mainSkillCard.attr('class')?.match(/skillCard--(\w+?)(?:__|$)/);
      const rarity = rarityMatch ? rarityMatch[1] : 'normal';

      const mainSkillData = extractSkillInfo(mainSkillCard, containerIndex);
      mainSkillData.rarity = rarity;

      // 從 HTML 提取 needSkillPoint（作為備用，如果 script 中沒有）
      const spinnerInput = container.find('[class*="hintSpinner_component_spinner__input"] input');
      if (spinnerInput.length > 0) {
        const value = spinnerInput.attr('value');
        // 只有當值不是 "-" 時才設置
        if (value && value !== '-') {
          mainSkillData.needSkillPointFromHTML = parseInt(value);
        }
      }

      // 檢查是否有巢狀元素（超過一個 skillCard）
      const hasNested = allSkillCards.length > 1;
      const nestedSkills = [];

      if (hasNested) {
        // 提取所有巢狀技能（從第二個開始）
        allSkillCards.slice(1).each(function () {
          const nestedSkillCard = $(this);
          const nestedSkillData = extractSkillInfo(nestedSkillCard, containerIndex);

          // 提取巢狀技能的稀有度類型（只保留類型名稱，去掉 CSS 模組後綴）
          const nestedRarityMatch = nestedSkillCard.attr('class')?.match(/skillCard--(\w+?)(?:__|$)/);
          nestedSkillData.rarity = nestedRarityMatch ? nestedRarityMatch[1] : 'normal';

          // 只加入有實質內容的巢狀技能
          if (nestedSkillData.name || nestedSkillData.effect || nestedSkillData.description) {
            nestedSkills.push(nestedSkillData);
          }
        });
      }

      // 組合最終的技能資料
      const finalSkillData = {
        ...mainSkillData,
        hasNested: hasNested,
        nestedSkills: nestedSkills
      };

      // 只加入有實質內容的主技能
      if (mainSkillData.name || mainSkillData.effect || mainSkillData.description || mainSkillData.elements.length > 0) {
        skillList.push(finalSkillData);
      }
    });
  });

  // ========== 步驟 2: 合併 script 數據與 HTML 數據 ==========
  let finalSkillList = [];

  if (scriptSkillsMap.size > 0) {
    console.log('[數據合併] 使用 script 數據作為主要來源');

    // 定義稀有度名稱映射
    const rarityNames = {
      0: 'common',
      1: 'normal',
      2: 'gold',
      3: 'r',
      4: 'sr',
      5: 'ssr',
      6: 'ur'
    };

    // 從 script 數據建立技能列表
    scriptSkillsMap.forEach((skill) => {
      // 查找 HTML 中對應的技能資料（透過名稱匹配）來補充額外資訊
      const htmlSkill = skillList.find(s => s.name === skill.name);

      // 建立稀有度關聯資訊
      const relatedSkills = [];
      const seenIds = new Set(); // 用於去重

      if (groupIdMap.has(skill.groupId)) {
        const groupSkillIds = groupIdMap.get(skill.groupId);

        groupSkillIds.forEach(relatedId => {
          if (relatedId !== skill.id && !seenIds.has(relatedId)) {
            seenIds.add(relatedId);
            const relatedSkill = scriptSkillsMap.get(relatedId);
            if (relatedSkill) {
              relatedSkills.push({
                id: relatedSkill.id,
                name: relatedSkill.name,
                rarity: rarityNames[relatedSkill.rarity] || `unknown_${relatedSkill.rarity}`,
                rarityValue: relatedSkill.rarity,
                groupRate: relatedSkill.groupRate,
                gradeValue: relatedSkill.gradeValue
              });
            }
          }
        });

        // 按稀有度從高到低排序
        relatedSkills.sort((a, b) => b.rarityValue - a.rarityValue);
      }

      // 構建最終的技能物件
      const finalSkill = {
        // 主要來自 script 的數據
        id: skill.id,
        name: skill.name,
        description: skill.description,
        rarity: rarityNames[skill.rarity] || `unknown_${skill.rarity}`,
        rarityValue: skill.rarity,
        groupId: skill.groupId,
        groupRate: skill.groupRate,
        gradeValue: skill.gradeValue,
        iconId: skill.iconId,
        // needSkillPoint: 優先使用 script 的值，如果沒有則使用 HTML 的備用值
        needSkillPoint: skill.needSkillPoint !== null ? skill.needSkillPoint : (htmlSkill?.needSkillPointFromHTML || null),

        // 從 HTML 補充的數據（如果有的話）
        memo: htmlSkill?.memo || '',
        effect: htmlSkill?.effect || '',
        icon: htmlSkill?.icon || '',

        // 稀有度關聯
        relatedSkills: relatedSkills,
        relatedSkillsCount: relatedSkills.length
      };

      finalSkillList.push(finalSkill);
    });

    console.log(`[數據合併] 完成，共 ${finalSkillList.length} 個技能`);

  } else {
    // 如果沒有 script 數據，使用原始的 HTML 解析結果
    console.log('[數據合併] 使用 HTML 數據作為來源');
    finalSkillList = skillList;
  }

  return {
    headline: headline || '未找到標題',
    skillList: finalSkillList,
    dataSource: scriptSkillsMap.size > 0 ? 'script' : 'html',
    totalGroups: groupIdMap.size
  };
}

app.post('/api/fetch', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: '請提供網址' });
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const urlParams = parseUrlParameters(url);
    const parsedData = parseRaceCourseData(response.data);

    res.json({
      success: true,
      content: response.data,
      status: response.status,
      contentType: response.headers['content-type'],
      urlParams: urlParams,
      parsed: parsedData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/fetch-basic', async (req, res) => {
  let browser = null;
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: '請提供網址' });
    }

    // 使用 Puppeteer 抓取動態渲染的網頁 (無痕模式)
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // 創建無痕模式的瀏覽器上下文
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // 設置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 設置視窗大小
    await page.setViewport({ width: 1920, height: 1080 });

    // 訪問網頁
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('頁面已載入,開始處理伺服器設定...');

    // 點擊右上角齒輪圖標並勾選台灣伺服器選項
    try {
      console.log('嘗試尋找並點擊右上角齒輪圖標...');

      // 尋找齒輪圖標 (img src包含 settings.png)
      await page.waitForSelector('img[src*="settings.png"]', { timeout: 5000 });

      // 點擊齒輪圖標
      const settingsClicked = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        const settingsIcon = images.find(img => img.src && img.src.includes('settings.png'));

        if (settingsIcon) {
          settingsIcon.click();
          return true;
        }
        return false;
      });

      if (settingsClicked) {
        console.log('已點擊齒輪圖標');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 勾選台灣伺服器選項
        console.log('嘗試尋找並勾選台灣伺服器選項...');

        try {
          // 使用精確的 ID 選擇器
          await page.waitForSelector('#serverTwCheckbox', { timeout: 5000 });

          // 點擊對應的 input
          const taiwanChecked = await page.evaluate(() => {
            const input = document.getElementById('serverTwCheckbox');
            if (input) {
              input.click();
              return true;
            }
            return false;
          });

          if (taiwanChecked) {
            console.log('已勾選台灣伺服器選項');

            // 等待頁面更新 - 增加等待時間
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 明確等待技能表格的 enName 元素出現並可見
            try {
              await page.waitForSelector('[class*="skills_table_enname"]', {
                timeout: 10000,
                visible: true
              });
              console.log('找到 skills_table_enname 元素');

              // 額外等待確保所有元素都已渲染
              await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (e) {
              console.log('等待 enName 元素時發生錯誤: ' + e.message);
              console.log('將繼續嘗試抓取資料...');
            }
          } else {
            throw new Error('無法點擊台灣伺服器選項');
          }
        } catch (e) {
          console.log('勾選台灣伺服器失敗: ' + e.message);
        }
      } else {
        console.log('未找到齒輪圖標');
      }
    } catch (e) {
      console.log('設定伺服器選項時發生錯誤:', e.message);
      console.log('繼續進行資料抓取...');
    }

    // 等待特定元素加載
    try {
      await page.waitForSelector('.skills_skill_table__ZoEHP', { timeout: 10000 });
      console.log('找到 skills_skill_table__ZoEHP');

      // 額外等待 enName 元素出現
      await page.waitForSelector('[class*="skills_table_enname"]', { timeout: 5000 });
      console.log('找到 skills_table_enname 元素');
    } catch (e) {
      // 如果找不到特定元素，繼續執行
      console.log('某些元素未找到:', e.message);
    }

    // 額外等待 2 秒確保所有動態內容都已載入
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 獲取完整的 HTML 內容
    const content = await page.content();

    await browser.close();
    browser = null;

    // 解析技能數據
    const parsedData = parseSkillData(content);

    // 自動儲存技能數據和下載圖片
    const language = 'tw'; // 預設語系為台灣
    const saveResult = await saveSkillsData(parsedData, language);

    res.json({
      success: true,
      content: content,
      status: 200,
      contentType: 'text/html',
      parsed: parsedData,
      saved: saveResult
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
