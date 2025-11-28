const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

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

  // 擷取 headlineDefault_component_headlineDefault__body 內的 text
  const headline = $('[class*="headlineDefault_component_headlineDefault__body"]').text().trim();

  // 擷取 courseSkillEffectTable 底下的所有資訊
  const skillList = [];
  $('[class*="courseSkillEffectTable_component_courseSkillEffectTable"]').each(function () {
    $(this).find('[class*="skillCard"]').each(function () {
      const skillCard = $(this);

      // 基本資訊 - 使用多種可能的選擇器
      const name = skillCard.find('[class*="skillCard__name"], [class*="name"]').first().text().trim();
      const effect = skillCard.find('[class*="skillCard__effect"], [class*="effect"]').first().text().trim();
      const description = skillCard.find('[class*="description"], [class*="desc"]').first().text().trim();

      // 分割 effect 數據（用、或,分隔）
      const effectList = effect ? effect.split(/[、,]/).map(item => item.trim()).filter(item => item.length > 0) : [];

      // 收集所有圖片
      const images = [];
      skillCard.find('img').each(function () {
        const src = $(this).attr('src');
        const alt = $(this).attr('alt');
        if (src) {
          images.push({ src, alt: alt || '' });
        }
      });
      const icon = images.length > 0 ? images[0].src : '';

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

      const skillData = {
        name: name,
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

      // 只加入有實質內容的技能
      if (name || effect || description || elements.length > 0) {
        skillList.push(skillData);
      }
    });
  });

  return {
    headline: headline || '未找到標題',
    skillList: skillList
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

    const fs = require('fs');
    const logToFile = (msg) => {
      fs.appendFileSync('server_log.txt', msg + '\n');
      console.log(msg);
    };

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

    res.json({
      success: true,
      content: content,
      status: 200,
      contentType: 'text/html',
      parsed: parsedData
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
