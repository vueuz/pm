const crypto = require('crypto');

// 默认密钥（实际使用时应该使用环境变量或配置文件）
const DEFAULT_SECRET_KEY = 'PM-LICENSE-2025-SECRET-KEY-NANTIAN';

/**
 * 生成授权码
 * @param {string} machineId 机器指纹
 * @param {string} expiryDate 过期时间 (YYYY-MM-DD)
 * @param {string} secretKey 自定义密钥（可选）
 * @returns {string} 授权码
 */
function generateLicense(machineId, expiryDate, secretKey = DEFAULT_SECRET_KEY) {
  if (!machineId || !expiryDate) {
    throw new Error('机器指纹和过期时间不能为空');
  }

  // 验证日期格式
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(expiryDate)) {
    throw new Error('过期时间格式错误，应为 YYYY-MM-DD');
  }

  // 将过期时间转换为时间戳
  const expiryTimestamp = new Date(expiryDate).getTime();
  
  // 组合数据
  const data = `${machineId}|${expiryTimestamp}`;
  
  // 使用 HMAC-SHA256 生成签名
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(data);
  const signature = hmac.digest('hex');
  
  // 组合授权码：机器指纹前8位-过期时间戳-签名前16位
  const licenseCode = `${machineId.substring(0, 8)}-${expiryTimestamp}-${signature.substring(0, 16)}`;
  
  // Base64 编码
  const encodedLicense = Buffer.from(licenseCode).toString('base64');
  
  // 格式化为易读格式（每4个字符一组）
  return formatLicense(encodedLicense);
}

/**
 * 验证授权码
 * @param {string} machineId 当前机器指纹
 * @param {string} license 授权码
 * @param {string} secretKey 自定义密钥（可选）
 * @returns {object} 验证结果
 */
function verifyLicense(machineId, license, secretKey = DEFAULT_SECRET_KEY) {
  try {
    // 移除格式化的破折号
    const cleanLicense = license.replace(/-/g, '');
    
    // Base64 解码
    const decodedLicense = Buffer.from(cleanLicense, 'base64').toString('utf-8');
    
    // 解析授权码
    const parts = decodedLicense.split('-');
    if (parts.length !== 3) {
      return {
        valid: false,
        message: '授权码格式错误'
      };
    }
    
    const [machineIdPrefix, expiryTimestamp, signature] = parts;
    
    // 验证机器指纹前缀
    if (!machineId.startsWith(machineIdPrefix)) {
      return {
        valid: false,
        message: '授权码与当前机器不匹配'
      };
    }
    
    // 验证签名
    const data = `${machineId}|${expiryTimestamp}`;
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex').substring(0, 16);
    
    if (signature !== expectedSignature) {
      return {
        valid: false,
        message: '授权码签名验证失败'
      };
    }
    
    // 验证过期时间
    const expiryDate = new Date(parseInt(expiryTimestamp));
    const now = new Date();
    
    if (now > expiryDate) {
      return {
        valid: false,
        expired: true,
        message: '授权码已过期',
        expiryDate: expiryDate.toLocaleDateString('zh-CN')
      };
    }
    
    return {
      valid: true,
      message: '授权码有效',
      expiryDate: expiryDate.toLocaleDateString('zh-CN'),
      remainingDays: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
    };
    
  } catch (error) {
    return {
      valid: false,
      message: '授权码解析失败: ' + error.message
    };
  }
}

/**
 * 格式化授权码为易读格式
 * @param {string} license 原始授权码
 * @returns {string} 格式化后的授权码
 */
function formatLicense(license) {
  const formatted = license.match(/.{1,4}/g) || [];
  return formatted.join('-');
}

module.exports = {
  generateLicense,
  verifyLicense,
  formatLicense
};
