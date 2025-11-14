/**
 * Electron Builder 打包钩子
 * 确保原生模块被正确处理
 */

const path = require('path');
const fs = require('fs-extra');

exports.default = async function(context) {
    const { appOutDir, packager } = context;
    const platform = packager.platform.name;
    
    console.log('\n========================================');
    console.log('Post-pack hook: Processing native modules');
    console.log('Platform:', platform);
    console.log('Output directory:', appOutDir);
    console.log('========================================\n');

    // 确定原生模块的源路径和目标路径
    // 使用 packager.info.appDir 而不是 context.appDir
    const appDir = packager.info.appDir || packager.appDir || process.cwd();
    const nativeSrcDir = path.join(appDir, 'native');
    const resourcesDir = path.join(appOutDir, 'resources');
    const nativeDestDir = path.join(resourcesDir, 'app.asar.unpacked', 'native');

    console.log('📂 Paths:');
    console.log('   App directory:', appDir);
    console.log('   Native source:', nativeSrcDir);
    console.log('   Native destination:', nativeDestDir);
    console.log('');

    try {
        // 检查源目录是否存在
        if (!fs.existsSync(nativeSrcDir)) {
            console.warn('⚠️  Warning: Native source directory not found:', nativeSrcDir);
            return;
        }

        // 确保目标目录存在
        await fs.ensureDir(nativeDestDir);

        // 复制原生模块
        console.log('📦 Copying native module...');
        console.log('   From:', nativeSrcDir);
        console.log('   To:', nativeDestDir);

        // 复制 build/Release 目录
        const buildSrc = path.join(nativeSrcDir, 'build', 'Release');
        const buildDest = path.join(nativeDestDir, 'build', 'Release');
        
        if (fs.existsSync(buildSrc)) {
            await fs.copy(buildSrc, buildDest);
            console.log('   ✅ Copied build/Release');
        } else {
            console.warn('   ⚠️  Build directory not found:', buildSrc);
        }

        // 复制 index.js
        const indexSrc = path.join(nativeSrcDir, 'index.js');
        const indexDest = path.join(nativeDestDir, 'index.js');
        
        if (fs.existsSync(indexSrc)) {
            await fs.copy(indexSrc, indexDest);
            console.log('   ✅ Copied index.js');
        }

        // 复制 package.json
        const pkgSrc = path.join(nativeSrcDir, 'package.json');
        const pkgDest = path.join(nativeDestDir, 'package.json');
        
        if (fs.existsSync(pkgSrc)) {
            await fs.copy(pkgSrc, pkgDest);
            console.log('   ✅ Copied package.json');
        }

        // 复制 node_modules（如果存在）
        const nodeModulesSrc = path.join(nativeSrcDir, 'node_modules');
        const nodeModulesDest = path.join(nativeDestDir, 'node_modules');
        
        if (fs.existsSync(nodeModulesSrc)) {
            await fs.copy(nodeModulesSrc, nodeModulesDest);
            console.log('   ✅ Copied node_modules');
        }

        // 列出复制的文件
        console.log('\n📋 Native module contents:');
        if (fs.existsSync(buildDest)) {
            const files = await fs.readdir(buildDest);
            files.forEach(file => {
                const stats = fs.statSync(path.join(buildDest, file));
                console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
            });
        }

        console.log('\n✅ Native module processing complete!\n');

    } catch (error) {
        console.error('\n❌ Error processing native module:', error.message);
        console.error('Stack trace:', error.stack);
        // 不抛出错误，让构建继续进行
        console.warn('⚠️  Continuing build despite native module error...');
    }
};