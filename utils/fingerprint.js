const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const os = require('os');

/**
 * 获取机器唯一标识
 * @returns {Promise<string>} 机器指纹
 */
async function getMachineId() {
  try {
    // 获取机器ID
    const machineId = machineIdSync({ original: true });
    
    // 获取额外的机器信息
    const platform = os.platform();
    const hostname = os.hostname();
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
    
    // 组合信息生成更稳定的指纹
    const fingerprint = `${machineId}-${platform}-${cpuModel}`;
    
    // 生成哈希值
    const hash = crypto.createHash('sha256').update(fingerprint).digest('hex');
    
    return hash.substring(0, 32).toUpperCase();
  } catch (error) {
    throw new Error('获取机器指纹失败: ' + error.message);
  }
}

/**
 * 验证机器指纹格式
 * @param {string} machineId 机器指纹
 * @returns {boolean} 是否有效
 */
function isValidMachineId(machineId) {
  return /^[A-F0-9]{32}$/.test(machineId);
}

module.exports = {
  getMachineId,
  isValidMachineId
};
