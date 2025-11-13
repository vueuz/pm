#!/usr/bin/env node

/**
 * 许可证生成工具
 * 用法: node tools/license-generator.js <机器指纹> <过期日期> [产品ID]
 * 示例: node tools/license-generator.js ABC123DEF456 2025-12-31 PRODUCT-001
 */

const { generateLicense } = require('../utils/license');
const { isValidMachineId } = require('../utils/fingerprint');

// 获取命令行参数
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('用法: node tools/license-generator.js <机器指纹> <过期日期> [产品ID]');
  console.log('');
  console.log('参数说明:');
  console.log('  机器指纹: 32位十六进制字符串 (必需)');
  console.log('  过期日期: YYYY-MM-DD 格式 (必需)');
  console.log('  产品ID:   产品标识符 (可选)');
  console.log('');
  console.log('示例:');
  console.log('  node tools/license-generator.js ABC123DEF456 2025-12-31');
  console.log('  node tools/license-generator.js ABC123DEF456 2026-06-30 PRODUCT-001');
  process.exit(1);
}

const machineId = args[0];
const expiryDate = args[1];
const productId = args[2] || 'DEFAULT';

// 验证机器指纹格式
if (!isValidMachineId(machineId)) {
  console.error('❌ 错误: 机器指纹格式无效');
  console.error('   机器指纹应为32位十六进制字符串');
  console.error('   示例: ABC123DEF456789012345678901234');
  process.exit(1);
}

// 验证日期格式
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(expiryDate)) {
  console.error('❌ 错误: 日期格式无效');
  console.error('   日期格式应为 YYYY-MM-DD');
  console.error('   示例: 2025-12-31');
  process.exit(1);
}

// 验证日期是否有效
const expiryDateObj = new Date(expiryDate);
if (isNaN(expiryDateObj.getTime())) {
  console.error('❌ 错误: 无效的日期');
  process.exit(1);
}

// 检查日期是否在未来
const now = new Date();
if (expiryDateObj <= now) {
  console.warn('⚠️  警告: 过期日期早于或等于当前日期');
  console.warn('   生成的许可证将立即过期或已过期');
}

try {
  // 生成许可证
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 许可证生成工具');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('输入信息:');
  console.log(`  机器指纹: ${machineId}`);
  console.log(`  过期日期: ${expiryDate}`);
  console.log(`  产品ID:   ${productId}`);
  console.log('');
  
  const license = generateLicense(machineId, expiryDate);
  
  console.log('✅ 许可证生成成功!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('授权码:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(license);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 计算剩余天数
  const remainingDays = Math.ceil((expiryDateObj - now) / (1000 * 60 * 60 * 24));
  console.log('有效期信息:');
  console.log(`  过期日期: ${expiryDateObj.toLocaleDateString('zh-CN')}`);
  if (remainingDays > 0) {
    console.log(`  剩余天数: ${remainingDays} 天`);
  } else {
    console.log(`  状态: 已过期 (${Math.abs(remainingDays)} 天前)`);
  }
  console.log('');
  
  console.log('💡 使用提示:');
  console.log('   1. 将上述授权码复制给用户');
  console.log('   2. 用户在激活窗口粘贴授权码');
  console.log('   3. 点击"激活"按钮完成激活');
  console.log('');
  
} catch (error) {
  console.error('❌ 生成许可证失败:', error.message);
  process.exit(1);
}
