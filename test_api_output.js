const axios = require('axios');
const fs = require('fs');

async function testAPI() {
  console.log('=== 測試 API 輸出格式 ===\n');

  try {
    // 使用測試 URL
    const url = 'https://xn--gck1f423k.xn--1bvt37a.tools/race/courses/10708/effects/leader';

    console.log('發送請求到:', url);
    console.log('等待回應...\n');

    const response = await axios.post('http://localhost:3000/api/fetch', {
      url: url
    });

    if (response.data.success) {
      const parsed = response.data.parsed;

      console.log('✅ 請求成功\n');
      console.log('--- 解析結果 ---');
      console.log(`標題: ${parsed.headline}`);
      console.log(`數據來源: ${parsed.dataSource}`);
      console.log(`技能總數: ${parsed.skillList.length}`);
      console.log(`群組總數: ${parsed.totalGroups}\n`);

      // 顯示標題解析結果
      if (parsed.headlineInfo) {
        console.log('=== 標題解析 ===\n');
        console.log(`原始標題: ${parsed.headlineInfo.raw}`);
        console.log(`賽道名稱: ${parsed.headlineInfo.courseName || 'N/A'}`);
        console.log(`距離: ${parsed.headlineInfo.distance || 'N/A'}`);
        console.log(`賽道類型: ${parsed.headlineInfo.surface || 'N/A'}`);
        console.log(`跑法: ${parsed.headlineInfo.runningStyle || 'N/A'}`);
        console.log(`其他資訊: ${parsed.headlineInfo.additionalInfo || 'N/A'}`);
        console.log('');
      }

      // 找 "伝説降臨" 技能
      const legendSkill = parsed.skillList.find(s => s.name === '伝説降臨');

      if (legendSkill) {
        console.log('=== "伝説降臨" 技能詳情 ===\n');
        console.log(`ID: ${legendSkill.id}`);
        console.log(`名稱: ${legendSkill.name}`);
        console.log(`稀有度: ${legendSkill.rarity} (值: ${legendSkill.rarityValue})`);
        console.log(`群組 ID: ${legendSkill.groupId}`);
        console.log(`群組等級: ${legendSkill.groupRate}`);
        console.log(`Grade Value: ${legendSkill.gradeValue}`);
        console.log(`Icon ID: ${legendSkill.iconId}`);
        console.log(`所需技能點數: ${legendSkill.needSkillPoint !== null ? legendSkill.needSkillPoint : 'N/A'}`);
        console.log(`描述: ${legendSkill.description}`);
        console.log(`Memo: ${legendSkill.memo || '(無)'}`);
        console.log(`Effect: ${legendSkill.effect || '(無)'}`);
        console.log(`\n相關技能數量: ${legendSkill.relatedSkillsCount}`);

        if (legendSkill.relatedSkills && legendSkill.relatedSkills.length > 0) {
          console.log('\n相關的其他稀有度版本:');
          legendSkill.relatedSkills.forEach((related, index) => {
            console.log(`  ${index + 1}. [${related.rarity.toUpperCase()}] ${related.name}`);
            console.log(`     ID: ${related.id}, Grade: ${related.gradeValue}, Rate: ${related.groupRate}`);
          });
        }

        // 保存完整的技能數據到檔案
        fs.writeFileSync(
          'legend_skill_output.json',
          JSON.stringify(legendSkill, null, 2),
          'utf-8'
        );
        console.log('\n✅ 完整數據已保存至: legend_skill_output.json');
      } else {
        console.log('❌ 未找到 "伝説降臨" 技能');
      }

      // 統計稀有度分布
      console.log('\n\n=== 稀有度分布 ===\n');
      const rarityCount = {};
      parsed.skillList.forEach(s => {
        rarityCount[s.rarity] = (rarityCount[s.rarity] || 0) + 1;
      });

      Object.entries(rarityCount).sort((a, b) => b[1] - a[1]).forEach(([rarity, count]) => {
        console.log(`${rarity.toUpperCase()}: ${count} 個`);
      });

      // 統計有關聯的技能
      const withRelated = parsed.skillList.filter(s => s.relatedSkillsCount > 0).length;
      console.log(`\n有稀有度關聯的技能: ${withRelated} / ${parsed.skillList.length}`);

    } else {
      console.log('❌ 請求失敗');
    }

  } catch (error) {
    console.error('錯誤:', error.message);
    if (error.response) {
      console.error('狀態碼:', error.response.status);
      console.error('錯誤訊息:', error.response.data);
    }
  }
}

testAPI();
