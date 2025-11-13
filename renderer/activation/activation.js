// DOM 元素
const machineIdInput = document.getElementById('machineId');
const copyBtn = document.getElementById('copyBtn');
const licenseInput = document.getElementById('licenseInput');
const activateBtn = document.getElementById('activateBtn');
const checkBtn = document.getElementById('checkBtn');
const messageDiv = document.getElementById('message');
const statusSection = document.getElementById('statusSection');
const statusContent = document.getElementById('statusContent');

// 初始化页面
async function init() {
  try {
    // 获取机器指纹
    const machineId = await window.electronAPI.getMachineId();
    machineIdInput.value = machineId;
    
    // 自动检查许可证状态
    await checkLicenseStatus();
  } catch (error) {
    showMessage('获取机器指纹失败: ' + error.message, 'error');
  }
}

// 显示消息
function showMessage(text, type = 'info') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type} show`;
  
  // 3秒后自动隐藏（错误消息除外）
  if (type !== 'error') {
    setTimeout(() => {
      messageDiv.classList.remove('show');
    }, 3000);
  }
}

// 复制机器指纹
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(machineIdInput.value);
    
    // 视觉反馈
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    
    showMessage('机器指纹已复制到剪贴板', 'success');
    
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
    }, 2000);
  } catch (error) {
    showMessage('复制失败，请手动复制', 'error');
  }
});

// 激活许可证
activateBtn.addEventListener('click', async () => {
  const license = licenseInput.value.trim();
  
  if (!license) {
    showMessage('请输入授权码', 'warning');
    licenseInput.focus();
    return;
  }
  
  // 显示加载状态
  activateBtn.classList.add('loading');
  activateBtn.disabled = true;
  
  try {
    const result = await window.electronAPI.activateLicense(license);
    
    if (result.success) {
      showMessage('激活成功！', 'success');
      displayLicenseStatus(result.status);
      
      // 2秒后关闭激活窗口
      setTimeout(() => {
        window.electronAPI.closeActivationWindow();
      }, 2000);
    } else {
      showMessage('激活失败: ' + result.message, 'error');
    }
  } catch (error) {
    showMessage('激活过程出错: ' + error.message, 'error');
  } finally {
    activateBtn.classList.remove('loading');
    activateBtn.disabled = false;
  }
});

// 检查许可证状态
checkBtn.addEventListener('click', checkLicenseStatus);

async function checkLicenseStatus() {
  checkBtn.classList.add('loading');
  checkBtn.disabled = true;
  
  try {
    const status = await window.electronAPI.checkLicense();
    displayLicenseStatus(status);
    
    if (status.valid) {
      showMessage('许可证有效', 'success');
    } else {
      showMessage(status.message || '许可证无效', 'warning');
    }
  } catch (error) {
    showMessage('检查许可证状态失败: ' + error.message, 'error');
    statusSection.style.display = 'none';
  } finally {
    checkBtn.classList.remove('loading');
    checkBtn.disabled = false;
  }
}

// 显示许可证状态
function displayLicenseStatus(status) {
  statusSection.style.display = 'block';
  
  let statusHTML = '';
  
  // 状态
  const statusClass = status.valid ? 'valid' : 'invalid';
  const statusText = status.valid ? '✓ 有效' : '✗ 无效';
  statusHTML += `
    <div class="status-item">
      <span class="status-label">状态</span>
      <span class="status-value ${statusClass}">${statusText}</span>
    </div>
  `;
  
  // 过期日期
  if (status.expiryDate) {
    statusHTML += `
      <div class="status-item">
        <span class="status-label">过期日期</span>
        <span class="status-value">${status.expiryDate}</span>
      </div>
    `;
  }
  
  // 剩余天数
  if (status.valid && status.remainingDays !== undefined) {
    const daysClass = status.remainingDays < 30 ? 'warning' : 'valid';
    statusHTML += `
      <div class="status-item">
        <span class="status-label">剩余天数</span>
        <span class="status-value ${daysClass}">${status.remainingDays} 天</span>
      </div>
    `;
  }
  
  // 消息
  if (status.message) {
    statusHTML += `
      <div class="status-item">
        <span class="status-label">信息</span>
        <span class="status-value">${status.message}</span>
      </div>
    `;
  }
  
  statusContent.innerHTML = statusHTML;
}

// 支持粘贴授权码
licenseInput.addEventListener('paste', (e) => {
  setTimeout(() => {
    // 自动清理空格和换行
    const cleaned = licenseInput.value.replace(/\s+/g, '');
    if (cleaned !== licenseInput.value) {
      licenseInput.value = cleaned;
    }
  }, 10);
});

// 回车键激活
licenseInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    activateBtn.click();
  }
});

// 页面加载完成后初始化
init();
