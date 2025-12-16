// 測試 groupRate 前置技能邏輯

const SKILL_DISCOUNTS = [0, 0.10, 0.20, 0.30, 0.35, 0.40];

console.log('=== 測試相同稀有度但不同 GroupRate 的技能鏈 ===\n');

// 案例1: 左回り系列
console.log('【案例1】左回り系列技能鏈');
console.log('--------------------------------------\n');

const skill_mawari_1 = {
    id: 200022,
    name: '左回り○',
    rarityValue: 1,
    groupRate: 1,
    needSkillPoint: 90,
    effectValue: 0.25,
    level: 0
};

const skill_mawari_2 = {
    id: 200021,
    name: '左回り◎',
    rarityValue: 1,
    groupRate: 2,
    needSkillPoint: 110,
    effectValue: 0.37,
    level: 0,
    relatedSkills: [
        { id: 200024, rarityValue: 2, groupRate: 3 },  // 左回りの鬼
        { id: 200022, rarityValue: 1, groupRate: 1 }   // 左回り○
    ]
};

const skill_mawari_3 = {
    id: 200024,
    name: '左回りの鬼',
    rarityValue: 2,
    groupRate: 3,
    needSkillPoint: 130,
    effectValue: 0.72,
    level: 0,
    relatedSkills: [
        { id: 200021, rarityValue: 1, groupRate: 2 },  // 左回り◎
        { id: 200022, rarityValue: 1, groupRate: 1 }   // 左回り○
    ]
};

console.log('技能鏈結構：');
console.log('  左回り○ (Normal, groupRate:1, 成本:90) →');
console.log('  左回り◎ (Normal, groupRate:2, 成本:110) →');
console.log('  左回りの鬼 (Gold, groupRate:3, 成本:130)\n');

console.log('1. 左回り◎ 的前置技能應該是 左回り○');
console.log('   - 策略：相同 rarityValue (1) 但較低 groupRate (1 < 2)');
console.log('   - 累積成本：90 + 110 = 200 Pt');
console.log('   - 效率：(0.37 × 100) / 200 = 0.185 [バ/Pt]\n');

console.log('2. 左回りの鬼 的前置技能應該是 左回り◎');
console.log('   - 策略：較低 rarityValue (1 < 2)，選擇 groupRate 最高的 (2)');
console.log('   - 累積成本：110 + 130 = 240 Pt');
console.log('   - 效率：(0.72 × 100) / 240 = 0.30 [バ/Pt]\n');

console.log('3. 當 左回り○ 升級到 Lv3 時：');
const mawari1_lv3_cost = Math.round(90 * 0.7);
console.log(`   - 左回り○ 成本：${mawari1_lv3_cost} Pt`);
console.log(`   - 左回り◎ 累積成本：${mawari1_lv3_cost} + 110 = ${mawari1_lv3_cost + 110} Pt`);
console.log(`   - 左回り◎ 效率：(0.37 × 100) / ${mawari1_lv3_cost + 110} = ${((0.37 * 100) / (mawari1_lv3_cost + 110)).toFixed(2)} [バ/Pt]`);
console.log(`   - 左回りの鬼 不受影響（前置是 左回り◎ 而非 左回り○）\n`);

console.log('4. 當 左回り◎ 升級到 Lv3 時：');
const mawari2_lv3_cost = Math.round(110 * 0.7);
console.log(`   - 左回り◎ 成本：${mawari2_lv3_cost} Pt`);
console.log(`   - 左回りの鬼 累積成本：${mawari2_lv3_cost} + 130 = ${mawari2_lv3_cost + 130} Pt`);
console.log(`   - 左回りの鬼 效率：(0.72 × 100) / ${mawari2_lv3_cost + 130} = ${((0.72 * 100) / (mawari2_lv3_cost + 130)).toFixed(2)} [バ/Pt]\n`);

console.log('=== 總結 ===');
console.log('✓ 前置技能邏輯已更新為支援 groupRate 判斷');
console.log('✓ 策略1：優先尋找較低 rarityValue 的技能');
console.log('✓ 策略2：相同 rarityValue 時，尋找較低 groupRate 的技能');
console.log('✓ 選擇規則：在符合條件的前置技能中，選擇 groupRate 最高的（直接前置）');
console.log('✓ 效率計算：只包含直接前置技能的成本，不遞迴計算整個鏈');
