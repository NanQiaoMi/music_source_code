#!/usr/bin/env node
/**
 * Vibe Music Player - 完整启动脚本
 * 同时启动后端和前端
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('Vibe Music Player - 完整启动');
console.log('========================================');
console.log();

// 确定使用的 Python 路径（优先虚拟环境）
const projectRoot = path.join(__dirname, '..');
const venvPythonPath = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
const pythonPath = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python';

console.log(`使用 Python: ${pythonPath}`);
console.log();

// 检查 Python
console.log('[1/5] 检查 Python 环境...');
try {
  const pythonCheck = spawn(pythonPath, ['--version'], { stdio: 'ignore' });
  pythonCheck.on('exit', (code) => {
    if (code !== 0) {
      console.error('错误: 未找到 Python，请先安装 Python');
      process.exit(1);
    }
    console.log('Python 环境检查通过');
    console.log();
    checkBackendDependencies();
  });
} catch (e) {
  console.error('错误: 未找到 Python，请先安装 Python');
  process.exit(1);
}

// 检查并安装后端依赖
function checkBackendDependencies() {
  console.log('[2/5] 检查后端依赖...');
  
  const setupPath = path.join(__dirname, '..', 'backend', 'setup.py');
  
  if (fs.existsSync(setupPath)) {
    console.log('运行后端依赖安装脚本...');
    const setup = spawn(pythonPath, [setupPath], {
      cwd: path.join(__dirname, '..', 'backend'),
      stdio: 'inherit'
    });
    
    setup.on('exit', (code) => {
      if (code !== 0) {
        console.log('\n警告: 依赖安装可能有问题，但继续启动...');
      }
      console.log();
      cleanPorts();
    });
  } else {
    console.log('setup.py 未找到，继续启动...');
    console.log();
    cleanPorts();
  }
}

let backendProcess = null;
let frontendProcess = null;

function cleanPorts() {
  console.log('[3/5] 清理端口...');
  
  const cleanPortPath = path.join(__dirname, 'clean-port.js');
  
  if (fs.existsSync(cleanPortPath)) {
    const clean = spawn('node', [cleanPortPath], {
      stdio: 'ignore'
    });
    clean.on('exit', () => {
      console.log('端口清理完成');
      console.log();
      startBackend();
    });
  } else {
    console.log('端口清理脚本未找到，继续启动...');
    console.log();
    startBackend();
  }
}

function startBackend() {
  console.log('[4/5] 启动后端服务...');
  
  const backendPath = path.join(__dirname, '..', 'backend');
  
  backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
    cwd: backendPath,
    shell: true,
    stdio: 'inherit'
  });
  
  backendProcess.on('error', (err) => {
    console.error('后端启动失败:', err);
    process.exit(1);
  });
  
  // 等待后端启动
  setTimeout(() => {
    console.log('后端服务已启动在 http://localhost:8000');
    console.log();
    startFrontend();
  }, 3000);
}

function startFrontend() {
  console.log('[5/5] 启动前端服务...');
  console.log('前端服务将启动在 http://localhost:3025');
  console.log();
  console.log('========================================');
  console.log('服务启动完成！');
  console.log('========================================');
  console.log();
  console.log('后端 API 文档: http://localhost:8000/docs');
  console.log('前端应用: http://localhost:3025');
  console.log();
  
  frontendProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });
  
  frontendProcess.on('error', (err) => {
    console.error('前端启动失败:', err);
    if (backendProcess) {
      backendProcess.kill();
    }
    process.exit(1);
  });
}

// 处理退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
  process.exit(0);
});
