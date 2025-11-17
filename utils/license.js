const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadPublicKey(provided) {
  if (provided) return provided;
  if (process.env.PM_LICENSE_PUBLIC_KEY) return process.env.PM_LICENSE_PUBLIC_KEY;
  if (process.env.PM_LICENSE_PUBLIC_KEY_FILE) {
    const f = process.env.PM_LICENSE_PUBLIC_KEY_FILE;
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
  const p = path.join(__dirname, '..', 'keys', 'public.pem');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  if (process.resourcesPath) {
    const r1 = path.join(process.resourcesPath, 'keys', 'public.pem');
    if (fs.existsSync(r1)) return fs.readFileSync(r1, 'utf8');
    const r2 = path.join(process.resourcesPath, 'app.asar.unpacked', 'keys', 'public.pem');
    if (fs.existsSync(r2)) return fs.readFileSync(r2, 'utf8');
  }
  return null;
}

function loadPrivateKey(provided) {
  if (provided) return provided;
  if (process.env.PM_LICENSE_PRIVATE_KEY) return process.env.PM_LICENSE_PRIVATE_KEY;
  const p = path.join(__dirname, '..', 'keys', 'private.pem');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return null;
}

/**
 * 生成授权码
 * @param {string} machineId 机器指纹
 * @param {string} expiryDate 过期时间 (YYYY-MM-DD)
 * @param {string} privateKey 私钥（可选）
 * @returns {string} 授权码
 */
function generateLicense(machineId, expiryDate, privateKey) {
  if (!machineId || !expiryDate) {
    throw new Error('机器指纹和过期时间不能为空');
  }

  // 验证日期格式
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(expiryDate)) {
    throw new Error('过期时间格式错误，应为 YYYY-MM-DD');
  }

  const expiryTimestamp = new Date(expiryDate).getTime();
  
  const data = `${machineId}|${expiryTimestamp}`;
  const pk = loadPrivateKey(privateKey);
  if (!pk) {
    throw new Error('缺少私钥');
  }
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  const signature = signer.sign(pk, 'base64');
  
  const licenseCode = `${machineId.substring(0, 8)}-${expiryTimestamp}-${signature}`;
  
  const encodedLicense = Buffer.from(licenseCode).toString('base64');
  
  return formatLicense(encodedLicense);
}

/**
 * 验证授权码
 * @param {string} machineId 当前机器指纹
 * @param {string} license 授权码
 * @param {string} publicKey 公钥（可选）
 * @returns {object} 验证结果
 */
function verifyLicense(machineId, license, publicKey) {
  try {
    // 检查输入参数
    if (!machineId || !license) {
      return {
        valid: false,
        message: '机器指纹或授权码为空'
      };
    }
    
    const cleanLicense = license.replace(/-/g, '');
    
    // 检查许可证格式
    if (!cleanLicense) {
      return {
        valid: false,
        message: '授权码格式错误'
      };
    }
    
    let decodedLicense;
    try {
      decodedLicense = Buffer.from(cleanLicense, 'base64').toString('utf-8');
    } catch (decodeError) {
      return {
        valid: false,
        message: '授权码解码失败'
      };
    }
    
    const parts = decodedLicense.split('-');
    if (parts.length !== 3) {
      return {
        valid: false,
        message: '授权码格式错误'
      };
    }
    
    const [machineIdPrefix, expiryTimestamp, signature] = parts;
    
    const timestamp = parseInt(expiryTimestamp);
    if (isNaN(timestamp)) {
      return {
        valid: false,
        message: '授权码时间戳无效'
      };
    }
    
    if (!machineId.startsWith(machineIdPrefix)) {
      return {
        valid: false,
        message: '授权码与当前机器不匹配'
      };
    }
    
    const data = `${machineId}|${expiryTimestamp}`;
    const pub = loadPublicKey(publicKey);
    if (!pub) {
      return {
        valid: false,
        message: '缺少公钥'
      };
    }
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    const ok = verifier.verify(pub, signature, 'base64');
    if (!ok) {
      return {
        valid: false,
        message: '授权码签名验证失败'
      };
    }
    
    const expiryDate = new Date(parseInt(expiryTimestamp));
    const now = new Date();
    
    if (isNaN(expiryDate.getTime())) {
      return {
        valid: false,
        message: '授权码日期无效'
      };
    }
    
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
    console.error('许可证验证过程中发生错误:', error);
    return {
      valid: false,
      message: '授权码验证过程出错: ' + error.message
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
