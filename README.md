# Probie

Realtime endpoint reachability monitoring for services, APIs, proxies, and network routes.

Probie helps you answer a simple question: when a tool keeps retrying, is the target service reachable from this machine, or is the problem more likely local network, proxy/VPN, DNS, or upstream instability?

## Install

```bash
npm install -g probie
```

For local development:

```bash
npm install
npm link
```

## Quick Start

```bash
probie setup
probie watch
```

Enable system notifications for failures and recoveries:

```bash
probie watch --notify
```

Check once:

```bash
probie status
```

## Profiles

Built-in profiles:

```text
openai, anthropic, gemini, deepseek,
openrouter, groq, mistral, xai, perplexity, together, cohere
```

Monitor specific profiles:

```bash
probie watch --profile openai --profile anthropic
```

Save default profiles:

```bash
probie config set --profile openai --profile anthropic --interval 5
probie config show
```

Add a custom URL:

```bash
probie config add-url https://example.com/
```

## Configuration

Tune timeouts and concurrency:

```bash
probie config set --connect-timeout 6 --max-time 10 --confirm-connect-timeout 20 --confirm-max-time 30 --concurrency 3
```

macOS autostart:

```bash
probie install-autostart
probie uninstall-autostart
```

## How It Decides

- HTTP responses like `200`, `401`, `403`, `404`, and `405` count as reachable because the remote service responded.
- Network failures, DNS failures, TLS timeouts, and connection timeouts count as unreachable.
- VPN, system proxy, shell proxy, DNS, egress IP, country/region, and ASN are shown as context, not as the primary decision.
- `--notify` sends notifications when a selected service becomes unreachable and when it recovers.

## 中文说明

Probie 用来实时监测服务端点可连通性，帮助判断工具显示“正在重试”时，更像用户网络问题，还是服务端/客户端问题。

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
