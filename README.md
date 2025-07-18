# terminalx

An Electron application with Vue

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```


# TerminalX - 跨平台终端模拟器

![Demo](screenshot.png)
> 基于 Electron+Vue 的现代化终端工具，支持 SSH/Telnet/RDP 协议，提供类 VS Code 的开发体验

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/yourname/terminalx/ci.yml)](https://github.com/yourname/terminalx/actions)
[![Electron](https://img.shields.io/electron/v/main)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/vue-3.2.41-blue)](https://vuejs.org/)

## 功能特性 ✨

- 🖥️ 基于 Web 技术的完全可定制界面
- 🔒 支持 SSH2/Telnet 协议与密钥认证
- 📂 内置 SFTP 文件传输系统
- 🔄 多标签页与会话管理
- 📱 响应式布局适配 PC/Pad

以下是基于 Electron+Vue 开发的终端工具应具备的核心功能模块设计，结合行业标杆产品特性与用户需求分析：

一、核心终端功能
功能模块          详细说明 技术实现参考

协议支持 SSH/Telnet/RDP/VNC 协议，支持协议切换与混合会话
多标签页 支持无限标签页、标签分组、快捷键切换
自定义主题 支持深色/浅色模式、字体/配色方案自定义，支持导入导出主题配置
智能命令补全 基于历史命令的联想补全，支持自定义命令别名
实时日志监控 自动滚动日志、关键词高亮、日志过滤与导出

二、文件传输系统
功能模块          详细说明 技术实现参考

SFTP/SCP传输 支持拖拽传输、目录对比、断点续传
文件管理器 集成双面板文件浏览器，支持远程/本地文件同步
大文件分片 自动分割大文件（>2GB）为多个小块传输，提升传输成功率
校验机制 支持MD5/SHA256校验，传输后自动验证完整性

三、会话管理
功能模块          详细说明 技术实现参考

会话书签 支持分组管理、快速拨号、跨设备同步
连接配置 预设主机配置（IP/端口/密钥）、自动重连策略
会话录制 录制终端操作过程（含输入/输出），支持回放与加密存储
代理跳板 支持SSH隧道穿透、HTTP代理设置、多级跳板配置

四、安全体系
功能模块          详细说明 技术实现参考

密钥管理 支持RSA/ED25519密钥生成、密码保护私钥、密钥指纹验证
双因素认证 集成TOTP（Google Authenticator）、硬件密钥（YubiKey）支持
操作审计 记录操作时间/命令/IP，支持导出审计日志
安全加固 禁用X11转发、限制空闲超时、自动阻断暴力破解尝试

五、开发工具集成
功能模块          详细说明 技术实现参考

脚本执行 内置脚本引擎（JS/Python），支持定时任务与事件触发
API扩展 提供REST API接口，支持与CI/CD系统集成
插件系统 支持WebAssembly插件加载，可扩展协议解析/数据处理能力
调试工具 集成Node.js调试器、WebSocket监控、内存泄漏检测

六、用户体验优化
功能模块          详细说明 技术实现参考

快捷键方案 支持Vim/Emacs模式、自定义快捷键组、命令模板快速插入
状态栏集成 实时显示CPU/内存使用率、网络延迟、会话统计
帮助系统 内置命令手册、协议说明、故障排查指南
多端同步 通过云同步配置/书签/历史记录，支持Web端访问

七、技术实现建议
协议层  

使用 ssh2 库实现 SSH2 协议，结合 node-pty 处理伪终端  

采用 xterm-addon-fit 实现自适应窗口缩放
安全层  

      // 密钥管理示例
   import { Keytar } from 'keytar';
   const keytar = new Keytar();
   await keytar.setPassword('app', 'user', privateKey);
   
性能优化  

虚拟滚动技术处理长日志（@xterm/addon-virtual-scroll）  

Web Worker 解析终端数据流

八、竞品功能对比
产品       核心优势 待改进点

Xshell 企业级安全功能、协议支持全面 仅支持Windows、商业授权费用高
MobaXterm 集成X11服务器、多协议工具集成 界面陈旧、移动端支持弱
Termius 跨平台同步、云托管会话 高级功能需付费
FinalShell 国产化、资源监控集成 协议扩展性有限

该功能设计覆盖了终端工具的核心需求与扩展场景，开发者可根据目标用户群体（如运维人员/开发者）调整功能优先级。建议采用渐进式开发策略，优先实现 SSH 连接与基础终端功能，再逐步扩展高级特性。

graph TB
    subgraph 主进程层
        A1[主进程] -->|创建窗口| B1[BrowserWindow]
        A1 -->|协议处理| C1[SSH/Telnet协议模块]
        A1 -->|文件操作| D1[Node.js fs模块]
    end

    subgraph 渲染进程层
        A2[Vue应用] -->|渲染终端| B2[Xterm.js]
        A2 -->|状态管理| C2[Vuex]
        A2 -->|路由管理| D2[Vue Router]
    end

    subgraph 跨进程通信
        B1 -.->|IPC| A2
        C1 -.->|IPC| B2
        D1 -.->|IPC| B2
    end


使用Electron + Sequelize存储用户与AI的聊天数据，终端历史连接记录，以及终端输入框的历史数据