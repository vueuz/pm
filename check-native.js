/**
 * 检查原生模块是否正确加载
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('Native Module Check');
console.log('========================================\n');

console.log('Platform:', os.platform());
console.log('Architecture:', os.arch());
console.log('Node Version:', process.version);
console.log('\n');

// 检查 native 目录
const nativeDir = path.join(__dirname, 'native');
console.log('[1] Checking native directory...');
if (fs.existsSync(nativeDir)) {
    console.log('✅ Native directory exists:', nativeDir);
} else {
    console.log('❌ Native directory not found:', nativeDir);
    process.exit(1);
}
console.log('');

// 检查 build 目录
const buildDir = path.join(nativeDir, 'build', 'Release');
console.log('[2] Checking build directory...');
if (fs.existsSync(buildDir)) {
    console.log('✅ Build directory exists:', buildDir);
    
    // 列出编译的文件
    const files = fs.readdirSync(buildDir);
    console.log('   Files in build directory:');
    files.forEach(file => {
        console.log('   -', file);
    });
} else {
    console.log('❌ Build directory not found:', buildDir);
    console.log('   Please run: cd native && npm install');
    process.exit(1);
}
console.log('');

// 检查 node_modules
const nativeNodeModules = path.join(nativeDir, 'node_modules');
console.log('[3] Checking native node_modules...');
if (fs.existsSync(nativeNodeModules)) {
    console.log('✅ Native node_modules exists');
    
    // 检查 bindings
    const bindingsDir = path.join(nativeNodeModules, 'bindings');
    if (fs.existsSync(bindingsDir)) {
        console.log('✅ bindings module installed');
    } else {
        console.log('❌ bindings module not found');
        console.log('   Please run: cd native && npm install');
    }
} else {
    console.log('❌ Native node_modules not found');
    console.log('   Please run: cd native && npm install');
    process.exit(1);
}
console.log('');

// 尝试加载模块
console.log('[4] Attempting to load native module...');
try {
    const nativeModule = require('./native');
    console.log('✅ Native module loaded successfully!');
    console.log('   Available methods:');
    console.log('   - disableAll:', typeof nativeModule.disableAll);
    console.log('   - enableAll:', typeof nativeModule.enableAll);
    
    // 测试功能
    console.log('');
    console.log('[5] Testing module functions...');
    try {
        console.log('   Calling disableAll()...');
        nativeModule.disableAll();
        console.log('   ✅ disableAll() executed');
        
        setTimeout(() => {
            console.log('   Calling enableAll()...');
            nativeModule.enableAll();
            console.log('   ✅ enableAll() executed');
            
            console.log('');
            console.log('========================================');
            console.log('✅ All checks passed!');
            console.log('========================================');
        }, 1000);
        
    } catch (err) {
        console.log('   ❌ Function test failed:', err.message);
        process.exit(1);
    }
    
} catch (err) {
    console.log('❌ Failed to load native module');
    console.log('   Error:', err.message);
    console.log('');
    console.log('   Possible solutions:');
    console.log('   1. Run: cd native && npm install');
    console.log('   2. Make sure you have build tools installed');
    console.log('   3. Check that the module was compiled for your platform');
    process.exit(1);
}
