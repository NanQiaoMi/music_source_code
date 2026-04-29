#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

const PORT = 3025;

function cleanPort() {
  console.log(`🔍 正在检查端口 ${PORT} 是否被占用...`);
  
  try {
    if (os.platform() === 'win32') {
      // Windows 系统
      try {
        const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
        
        if (output) {
          const lines = output.trim().split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            // 提取所有 PID
            const match = line.match(/\s+(\d+)$/);
            if (match) {
              pids.add(match[1]);
            }
          });
          
          if (pids.size > 0) {
            console.log(`⚠️  发现 ${pids.size} 个进程占用端口 ${PORT}`);
            
            pids.forEach(pid => {
              try {
                execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
                console.log(`✅ 已终止 PID ${pid} 的进程`);
              } catch (error) {
                console.log(`❌ 终止 PID ${pid} 失败:`, error.message);
              }
            });
          } else {
            console.log(`✅ 端口 ${PORT} 未被占用`);
          }
        } else {
          console.log(`✅ 端口 ${PORT} 未被占用`);
        }
      } catch (error) {
        // 忽略错误，可能是因为没有进程占用
        console.log(`✅ 端口 ${PORT} 未被占用或已清理`);
      }
    } else {
      // Linux/macOS 系统
      try {
        const output = execSync(`lsof -i :${PORT}`, { encoding: 'utf8' });
        
        if (output) {
          const lines = output.trim().split('\n');
          const pids = new Set();
          
          lines.slice(1).forEach(line => {
            const parts = line.split(/\s+/);
            if (parts[1]) {
              pids.add(parts[1]);
            }
          });
          
          if (pids.size > 0) {
            console.log(`⚠️  发现 ${pids.size} 个进程占用端口 ${PORT}`);
            
            pids.forEach(pid => {
              try {
                execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
                console.log(`✅ 已终止 PID ${pid} 的进程`);
              } catch (error) {
                console.log(`❌ 终止 PID ${pid} 失败:`, error.message);
              }
            });
          } else {
            console.log(`✅ 端口 ${PORT} 未被占用`);
          }
        } else {
          console.log(`✅ 端口 ${PORT} 未被占用`);
        }
      } catch (error) {
        console.log(`✅ 端口 ${PORT} 未被占用`);
      }
    }
  } catch (error) {
    console.log(`✅ 端口 ${PORT} 未被占用`);
  }
}

if (require.main === module) {
  cleanPort();
}

module.exports = cleanPort;