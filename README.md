# Probie

Realtime endpoint reachability monitoring for services, APIs, proxies, and network routes.

Probie helps you answer a simple question: when a tool keeps retrying, is the target service reachable from this machine, or is the problem more likely local network, proxy/VPN, DNS, or upstream instability?

中文说明: [README.zh-CN.md](./README.zh-CN.md)

## Install

```bash
npm install -g @rollpard/probie
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
