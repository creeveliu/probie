# Probie

实时监测服务端点可连通性，帮助判断工具显示“正在重试”时，更像用户网络问题还是服务端/客户端问题。

## 使用

```bash
npm install
npm link
probie watch
```

同时监测 OpenAI 和 Anthropic：

```bash
probie watch --profile openai --profile anthropic
```

内置 profile：

```text
openai, anthropic, gemini, deepseek,
openrouter, groq, mistral, xai, perplexity, together, cohere
```

设置默认监控对象：

```bash
probie setup
probie config set --profile openai --profile anthropic --interval 5
probie config show
```

调整超时和并发：

```bash
probie config set --connect-timeout 6 --max-time 10 --confirm-connect-timeout 20 --confirm-max-time 30 --concurrency 3
```

以后直接运行：

```bash
probie watch
```

添加 macOS 开机自启动：

```bash
probie install-autostart
```

取消自启动：

```bash
probie uninstall-autostart
```

不可达时弹系统通知：

```bash
probie watch --notify
```

后台日志模式：

```bash
probie watch --notify --quiet
```

追加自定义 URL：

```bash
probie config add-url https://example.com/
```

单次 JSON：

```bash
probie once
```

前台实时面板：

```bash
probie watch
probie watch --profile openai --profile anthropic
```

## 判断逻辑

- 所选服务都可连通：如果工具仍重试，更像客户端或服务端短时问题。
- 部分服务可连通：更像 DNS、规则、节点或上游局部波动。
- 都不可连通：更像本机网络、代理/VPN、DNS 或节点问题。
- VPN、系统代理、Shell 代理只作为辅助信息展示，不作为核心判断。
