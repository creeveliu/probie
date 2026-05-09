# Probie

Probie 用来实时监测服务端点可连通性，帮助判断工具显示“正在重试”时，更像用户网络问题，还是服务端/客户端问题。

English: [README.md](./README.md)

## 安装

```bash
npm install -g probie
```

本地开发：

```bash
npm install
npm link
```

## 快速开始

```bash
probie setup
probie watch
```

不可达和恢复时弹系统通知：

```bash
probie watch --notify
```

查看一次状态：

```bash
probie status
```

## 内置平台

```text
openai, anthropic, gemini, deepseek,
openrouter, groq, mistral, xai, perplexity, together, cohere
```

指定监控对象：

```bash
probie watch --profile openai --profile anthropic
```

保存默认配置：

```bash
probie config set --profile openai --profile anthropic --interval 5
probie config show
```

追加自定义 URL：

```bash
probie config add-url https://example.com/
```

## 配置

调整超时和并发：

```bash
probie config set --connect-timeout 6 --max-time 10 --confirm-connect-timeout 20 --confirm-max-time 30 --concurrency 3
```

macOS 开机自启动：

```bash
probie install-autostart
probie uninstall-autostart
```

## 判断逻辑

- `200`、`401`、`403`、`404`、`405` 等 HTTP 响应都算可达，因为目标服务已经响应。
- DNS 失败、TLS 超时、连接超时、网络错误算不可达。
- VPN、系统代理、Shell 代理、DNS、出口 IP、国家/地区、ASN 只作为辅助信息展示，不作为核心判断。
- `--notify` 会在服务不可达和恢复时都发送通知。
