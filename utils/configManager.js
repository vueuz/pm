const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 配置文件路径 - 使用用户数据目录以支持打包后的应用
const getUserDataPath = () => {
  try {
    return app.getPath('userData');
  } catch (error) {
    // 在渲染进程中无法直接访问 app，使用默认路径
    return path.join(__dirname, '../configs');
  }
};

const configDir = path.join(getUserDataPath(), 'configs');
const configFile = path.join(configDir, 'config.json');

// 内置配置文件路径(用于首次安装时复制)
// 需要处理 asar 打包后的路径
const builtInConfigFile = path.join(__dirname, '../configs/config.json').replace('app.asar', 'app.asar.unpacked');

// 默认配置
const defaultConfig = {
  apps: [
    { 
      id: 'flow-modeling', 
      name: '流程化建模', 
      url: 'https://www.baidu.com', 
      icon: '流程化建模-多色.png', 
      visible: true 
    },
    { 
      id: 'coal-gene', 
      name: '全国煤炭基因库', 
      url: 'https://www.baidu.com', 
      icon: '全国煤炭基因库.png', 
      visible: true 
    },
    { 
      id: 'scene-deduction', 
      name: '场景推演', 
      url: 'https://www.baidu.com', 
      icon: '场景推演-多色.png', 
      visible: true 
    },
    { 
      id: 'monitor-data', 
      name: '监测数据管理', 
      url: 'https://www.baidu.com', 
      icon: '监测数据管理-多色.png', 
      visible: true 
    },
    { 
      id: 'physical-analysis', 
      name: '物性分析', 
      url: 'https://www.baidu.com', 
      icon: '物性分析.png', 
      visible: true 
    },
    { 
      id: 'multidimensional-fusion', 
      name: '多维数据融合分析', 
      url: 'https://www.baidu.com', 
      icon: '多维数据融合-多色.png', 
      visible: true 
    },
    { 
      id: 'lingxi-knowledge', 
      name: '灵犀-知识图谱', 
      url: 'https://www.baidu.com', 
      icon: '灵犀知识库-多色.png', 
      visible: true 
    },
    { 
      id: 'digital-lab', 
      name: '数字实验室', 
      url: 'https://www.baidu.com', 
      icon: '数字实验室-多色.png', 
      visible: true 
    },
    { 
      id: 'support-nav', 
      name: '支护导航系统', 
      url: 'https://www.baidu.com', 
      icon: '支护导航系统-多色.png', 
      visible: true 
    },
    { 
      id: 'geological-system', 
      name: '地质保障系统', 
      url: 'https://www.baidu.com', 
      icon: '地质保障系统.png', 
      visible: true 
    },
    { 
      id: 'di-tun-hua-jing', 
      name: '地遁化境', 
      url: 'https://www.baidu.com', 
      icon: '地遁化境-多色.png', 
      visible: true 
    },
    { 
      id: 'stress-monitor', 
      name: '三维应力在线监测', 
      url: 'https://www.baidu.com', 
      icon: '三维应力在线监测.png', 
      visible: true 
    },
    { 
      id: 'rock-forum', 
      name: '数字岩石力学论坛', 
      url: 'https://www.baidu.com', 
      icon: '岩石力学论坛-多色.png', 
      visible: true 
    },
    { 
      id: 'account-management', 
      name: '账号管理', 
      url: 'https://www.baidu.com', 
      icon: '账号管理.png', 
      visible: true 
    }
  ],
  interface: {
    showSettingsButton: true,
    showStatusBar: true
  },
  background: {
    imageUrl: 'renderer/assets/background/default.png',
    overlayOpacity: 30,
    blur: 0
  },
  layout: {
    columns: 8,
    rows: 6
  },
  carousel: {
    images: [],
    switchTime: 3000,
    displayDuration: 15000
  },
  icon: {
    hideName: false,
    showShadow: true,
    enableAnimation: true,
    showBackground: true,
    size: 100
  },
  spacing: {
    containerPaddingVertical: 20,
    containerPaddingHorizontal: 20,
    iconGap: 20
  },
  dock: {
    backgroundColor: '#000000',
    backgroundOpacity: 50,
    blur: 20
  }
};

class ConfigManager {
  constructor() {
    this.initialized = false;
  }
  
  // 初始化配置管理器
  initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // 确保配置目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log('已创建配置目录:', configDir);
      }
      
      // 如果用户配置文件不存在，尝试从内置配置复制或创建默认配置
      if (!fs.existsSync(configFile)) {
        console.log('用户配置文件不存在，开始创建...');
        
        // 尝试从内置配置复制
        if (fs.existsSync(builtInConfigFile)) {
          try {
            const builtInConfig = JSON.parse(fs.readFileSync(builtInConfigFile, 'utf8'));
            this.saveConfig(builtInConfig);
            console.log('✅ 已从内置配置初始化用户配置');
            console.log('   源文件:', builtInConfigFile);
            console.log('   目标文件:', configFile);
          } catch (error) {
            console.error('内置配置读取失败:', error.message);
            console.log('使用默认配置创建配置文件');
            this.saveConfig(defaultConfig);
            console.log('✅ 已创建默认配置文件');
          }
        } else {
          // 使用默认配置
          console.log('内置配置文件不存在:', builtInConfigFile);
          this.saveConfig(defaultConfig);
          console.log('✅ 已创建默认配置文件');
        }
      } else {
        console.log('配置文件已存在:', configFile);
      }
      
      this.initialized = true;
      console.log('✅ 配置管理器初始化成功');
      console.log('   配置目录:', configDir);
      console.log('   配置文件:', configFile);
    } catch (error) {
      console.error('❌ 配置管理器初始化失败:', error);
    }
  }

  // 读取配置
  getConfig() {
    this.initialize();
    try {
      if (fs.existsSync(configFile)) {
        const data = fs.readFileSync(configFile, 'utf8');
        return JSON.parse(data);
      } else {
        console.log('配置文件不存在，返回默认配置');
        return defaultConfig;
      }
    } catch (error) {
      console.error('读取配置文件失败:', error);
      return defaultConfig;
    }
  }

  // 保存配置
  saveConfig(config) {
    try {
      // 确保目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      console.log('配置已保存到:', configFile);
      
      // 标记为已初始化（避免循环调用）
      if (!this.initialized) {
        this.initialized = true;
      }
      
      return true;
    } catch (error) {
      console.error('保存配置文件失败:', error);
      console.error('目标路径:', configFile);
      return false;
    }
  }

  // 获取默认配置
  getDefaultConfig() {
    return JSON.parse(JSON.stringify(defaultConfig));
  }

  // 重置为默认配置
  resetToDefault() {
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }
  
  // 获取配置文件路径（用于调试）
  getConfigPath() {
    return configFile;
  }
  
  // 获取配置目录路径（用于调试）
  getConfigDir() {
    return configDir;
  }

  // 导出配置到指定路径
  exportConfig(filePath) {
    try {
      const config = this.getConfig();
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('导出配置文件失败:', error);
      return false;
    }
  }

  // 从指定路径导入配置
  importConfig(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(data);
      
      // 简单验证配置格式
      if (this.validateConfig(config)) {
        this.saveConfig(config);
        return config;
      } else {
        throw new Error('配置文件格式无效');
      }
    } catch (error) {
      console.error('导入配置文件失败:', error);
      throw error;
    }
  }

  // 验证配置格式
  validateConfig(config) {
    // 检查必需的顶级属性
    if (!config.hasOwnProperty('apps') || 
        !config.hasOwnProperty('interface') || 
        !config.hasOwnProperty('background') ||
        !config.hasOwnProperty('layout') ||
        !config.hasOwnProperty('carousel') ||
        !config.hasOwnProperty('icon')) {
      return false;
    }

    // 检查apps数组
    if (!Array.isArray(config.apps)) {
      return false;
    }

    // 检查基本属性类型
    if (typeof config.interface !== 'object' ||
        typeof config.background !== 'object' ||
        typeof config.layout !== 'object' ||
        typeof config.carousel !== 'object' ||
        typeof config.icon !== 'object') {
      return false;
    }
    
    // spacing 是可选的，如果存在则验证类型
    if (config.hasOwnProperty('spacing') && typeof config.spacing !== 'object') {
      return false;
    }

    return true;
  }
}

module.exports = new ConfigManager();