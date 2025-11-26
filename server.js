const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');

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

function parseRaceCourseData(html) {
  const $ = cheerio.load(html);

  // 擷取 headlineDefault_component_headlineDefault__body 內的 text
  const headline = $('[class*="headlineDefault_component_headlineDefault__body"]').text().trim();

  // 擷取 courseSkillEffectTable 底下的所有資訊
  const skillList = [];
  $('[class*="courseSkillEffectTable_component_courseSkillEffectTable"]').each(function() {
    $(this).find('[class*="skillCard"]').each(function() {
      const skillCard = $(this);

      // 基本資訊 - 使用多種可能的選擇器
      const name = skillCard.find('[class*="skillCard__name"], [class*="name"]').first().text().trim();
      const effect = skillCard.find('[class*="skillCard__effect"], [class*="effect"]').first().text().trim();
      const description = skillCard.find('[class*="description"], [class*="desc"]').first().text().trim();

      // 分割 effect 數據（用、或,分隔）
      const effectList = effect ? effect.split(/[、,]/).map(item => item.trim()).filter(item => item.length > 0) : [];

      // 收集所有圖片
      const images = [];
      skillCard.find('img').each(function() {
        const src = $(this).attr('src');
        const alt = $(this).attr('alt');
        if (src) {
          images.push({ src, alt: alt || '' });
        }
      });
      const icon = images.length > 0 ? images[0].src : '';

      // 收集所有 input 元素
      const inputs = [];
      skillCard.find('input').each(function() {
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
      skillCard.find('div, span').each(function() {
        const elem = $(this);
        const elemClass = elem.attr('class') || '';
        const elemText = elem.contents().filter(function() {
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

app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});
