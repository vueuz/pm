#!/usr/bin/env node

/**
 * 许可证测试工具
 * 用于测试许可证系统的完整功能
 */

const { getMachineId, isValidMachineId } = require('../utils/fingerprint');
const { generateLicense, verifyLicense } = require('../utils/license');
const { generateKeyPairSync } = require('crypto');

async function testLicenseSystem() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 许可证系统测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. 测试机器指纹生成
    console.log('1️⃣  测试机器指纹生成...');
    const machineId = await getMachineId();
    console.log(`   ✅ 机器指纹: ${machineId}`);
    console.log(`   ✅ 格式验证: ${isValidMachineId(machineId) ? '通过' : '失败'}\n`);

    // 2. 测试许可证生成 - 有效期1年
    console.log('2️⃣  测试许可证生成 (有效期1年)...');
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    const license = generateLicense(machineId, expiryDateStr, privateKey);
    console.log(`   ✅ 过期日期: ${expiryDateStr}`);
    console.log(`   ✅ 授权码长度: ${license.length} 字符`);
    console.log(`   ✅ 授权码: ${license}\n`);

    // 3. 测试许可证验证 - 有效许可证
    console.log('3️⃣  测试许可证验证 (有效许可证)...');
    const validResult = verifyLicense(machineId, license, publicKey);
    console.log(`   ✅ 验证结果: ${validResult.valid ? '有效' : '无效'}`);
    console.log(`   ✅ 消息: ${validResult.message}`);
    console.log(`   ✅ 过期日期: ${validResult.expiryDate}`);
    console.log(`   ✅ 剩余天数: ${validResult.remainingDays} 天\n`);

    // 4. 测试许可证验证 - 无效机器指纹
    console.log('4️⃣  测试许可证验证 (错误的机器指纹)...');
    const wrongMachineId = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    const invalidResult1 = verifyLicense(wrongMachineId, license, publicKey);
    console.log(`   ✅ 验证结果: ${invalidResult1.valid ? '有效' : '无效'} (预期: 无效)`);
    console.log(`   ✅ 消息: ${invalidResult1.message}\n`);

    // 5. 测试许可证验证 - 过期许可证
    console.log('5️⃣  测试许可证验证 (过期许可证)...');
    const expiredDate = '2020-01-01';
    const expiredLicense = generateLicense(machineId, expiredDate, privateKey);
    const invalidResult2 = verifyLicense(machineId, expiredLicense, publicKey);
    console.log(`   ✅ 验证结果: ${invalidResult2.valid ? '有效' : '无效'} (预期: 无效)`);
    console.log(`   ✅ 消息: ${invalidResult2.message}`);
    console.log(`   ✅ 是否过期: ${invalidResult2.expired ? '是' : '否'}\n`);

    // 6. 测试许可证验证 - 格式错误
    console.log('6️⃣  测试许可证验证 (格式错误的授权码)...');
    const malformedLicense = 'INVALID-LICENSE-CODE';
    const invalidResult3 = verifyLicense(machineId, malformedLicense, publicKey);
    console.log(`   ✅ 验证结果: ${invalidResult3.valid ? '有效' : '无效'} (预期: 无效)`);
    console.log(`   ✅ 消息: ${invalidResult3.message}\n`);

    // 7. 测试许可证验证 - 即将过期
    console.log('7️⃣  测试许可证验证 (即将过期 - 15天后)...');
    const soonExpireDate = new Date();
    soonExpireDate.setDate(soonExpireDate.getDate() + 15);
    const soonExpireDateStr = soonExpireDate.toISOString().split('T')[0];
    const soonExpireLicense = generateLicense(machineId, soonExpireDateStr, privateKey);
    const soonExpireResult = verifyLicense(machineId, soonExpireLicense, publicKey);
    console.log(`   ✅ 验证结果: ${soonExpireResult.valid ? '有效' : '无效'}`);
    console.log(`   ✅ 剩余天数: ${soonExpireResult.remainingDays} 天`);
    console.log(`   ✅ 是否需要续期提醒: ${soonExpireResult.remainingDays < 30 ? '是' : '否'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有测试完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 快速生成许可证命令:');
    console.log(`   node tools/license-generator.js ${machineId} ${expiryDateStr}\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
testLicenseSystem();
