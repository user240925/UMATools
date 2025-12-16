// 验证递归前置技能链的成本计算

const SKILL_DISCOUNTS = [0, 0.10, 0.20, 0.30, 0.35, 0.40];

console.log('=== 验证递归前置技能链成本计算 ===\n');

// 左回り系列：左回り○ -> 左回り◎ -> 左回りの鬼
console.log('【技能链】左回り○ -> 左回り◎ -> 左回りの鬼');
console.log('--------------------------------------\n');

const mawari_1 = {
    name: '左回り○',
    needSkillPoint: 90,
    effectValue: 0.25,
    level: 0
};

const mawari_2 = {
    name: '左回り◎',
    needSkillPoint: 110,
    effectValue: 0.37,
    level: 0,
    prerequisite: mawari_1  // 前置：左回り○
};

const mawari_3 = {
    name: '左回りの鬼',
    needSkillPoint: 130,
    effectValue: 0.72,
    level: 0,
    prerequisite: mawari_2  // 前置：左回り◎
};

// 递归计算前置技能链的总成本
function calculateChainCost(skill, allSkills) {
    let totalCost = 0;
    let chain = [];

    // 递归追踪前置技能
    function tracePrerequsites(currentSkill) {
        if (currentSkill.prerequisite) {
            tracePrerequsites(currentSkill.prerequisite);
        }

        const level = currentSkill.level || 0;
        const discount = SKILL_DISCOUNTS[level];
        const cost = Math.round(currentSkill.needSkillPoint * (1 - discount));

        chain.push({
            name: currentSkill.name,
            level: level,
            originalCost: currentSkill.needSkillPoint,
            discount: discount,
            actualCost: cost
        });

        totalCost += cost;
    }

    tracePrerequsites(skill);

    return { totalCost, chain };
}

// 测试1：所有技能都在 Lv0
console.log('测试1：所有技能都在 Lv0');
console.log('--------------------------------------');

let result = calculateChainCost(mawari_3, [mawari_1, mawari_2, mawari_3]);

console.log('技能链详细成本：');
result.chain.forEach(skill => {
    console.log(`  ${skill.name} Lv${skill.level}: ${skill.originalCost} Pt × (1-${(skill.discount*100).toFixed(0)}%) = ${skill.actualCost} Pt`);
});

console.log(`\n累积总成本: ${result.totalCost} Pt`);
console.log(`左回りの鬼 效率: (0.72 × 100) / ${result.totalCost} = ${((0.72 * 100) / result.totalCost).toFixed(3)} [バ/Pt]`);

// 测试2：左回り○ 升到 Lv3 (30% 折扣)
console.log('\n\n测试2：左回り○ 升到 Lv3 (30% 折扣)');
console.log('--------------------------------------');

mawari_1.level = 3;
result = calculateChainCost(mawari_3, [mawari_1, mawari_2, mawari_3]);

console.log('技能链详细成本：');
result.chain.forEach(skill => {
    console.log(`  ${skill.name} Lv${skill.level}: ${skill.originalCost} Pt × (1-${(skill.discount*100).toFixed(0)}%) = ${skill.actualCost} Pt`);
});

console.log(`\n累积总成本: ${result.totalCost} Pt`);
console.log(`左回りの鬼 效率: (0.72 × 100) / ${result.totalCost} = ${((0.72 * 100) / result.totalCost).toFixed(3)} [バ/Pt]`);

// 测试3：左回り○ Lv3 + 左回り◎ Lv2 (20% 折扣)
console.log('\n\n测试3：左回り○ Lv3 + 左回り◎ Lv2 (20% 折扣)');
console.log('--------------------------------------');

mawari_1.level = 3;
mawari_2.level = 2;
result = calculateChainCost(mawari_3, [mawari_1, mawari_2, mawari_3]);

console.log('技能链详细成本：');
result.chain.forEach(skill => {
    console.log(`  ${skill.name} Lv${skill.level}: ${skill.originalCost} Pt × (1-${(skill.discount*100).toFixed(0)}%) = ${skill.actualCost} Pt`);
});

console.log(`\n累积总成本: ${result.totalCost} Pt`);
console.log(`左回りの鬼 效率: (0.72 × 100) / ${result.totalCost} = ${((0.72 * 100) / result.totalCost).toFixed(3)} [バ/Pt]`);

// 验证用户提到的公式
console.log('\n\n验证用户提到的公式');
console.log('--------------------------------------');
console.log('用户说：左回りの鬼 的 0.24[バ/Pt] 收益公式为 0.72 / (130+110+60)');
console.log('假设 60 是 左回り○ 获得某个折扣后的成本：');
console.log('');

// 计算什么折扣率会让 90 变成 60
const targetCost = 60;
const originalCost = 90;
const impliedDiscount = 1 - (targetCost / originalCost);
const impliedLevel = SKILL_DISCOUNTS.findIndex(d => Math.abs(d - impliedDiscount) < 0.01);

console.log(`如果 左回り○ 从 90 Pt 降到约 60 Pt：`);
console.log(`  推算折扣率: ${(impliedDiscount * 100).toFixed(1)}%`);
console.log(`  对应等级: Lv${impliedLevel >= 0 ? impliedLevel : '自定义'}`);
console.log(`  实际成本: ${Math.round(90 * (1 - impliedDiscount))} Pt`);
console.log('');
console.log(`总成本: 130 + 110 + 60 = 300 Pt`);
console.log(`效率: (0.72 × 100) / 300 = ${((0.72 * 100) / 300).toFixed(3)} [バ/Pt]`);
console.log(`用户说的: 0.24 [バ/Pt]`);
console.log(`匹配: ${Math.abs(((0.72 * 100) / 300) - 0.24) < 0.01 ? '✓' : '✗'}`);

console.log('\n\n=== 结论 ===');
console.log('✓ 需要递归计算整个前置技能链的成本');
console.log('✓ 左回りの鬼 的总成本 = 左回り○成本 + 左回り◎成本 + 左回りの鬼成本');
console.log('✓ 当链中任何一个技能升级时，都会影响最终技能的效率');
console.log('✓ 需要修改 calculateSkillStats 函数来实现递归成本计算');
