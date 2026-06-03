# **修改版说明**
## **7.0  基于大佬 GeniusZeroTw 的版本增加了 telegram bot 交互。**

以下内容主体框架来自于大佬：GeniusZeroTw
Number-preservation 原仓库地址：https://github.com/GeniusZeroTwo/Number-preservation

## **📸 界面预览 / Screenshots**


<img width="1982" height="1397" alt="image" src="https://github.com/user-attachments/assets/dc90ce17-0c4a-4e1f-9ad1-c0cc821801d3" />

<img width="2124" height="1350" alt="image" src="https://github.com/user-attachments/assets/0a504956-2f46-400f-a548-e52d54f636c2" />

# **教程来自 GeniusZeroTw 佬**
## **🛠️ 极简部署指南 / Deployment Guide**

部署过程全程在网页端完成，小白也能在 5 分钟内搞定。

### **准备工作**

1. 准备一个 [Cloudflare](https://dash.cloudflare.com/) 账号。  
2. 准备一个 Telegram 账号，搜索 @BotFather 发送 /newbot 创建一个机器人，记录下 **Bot Token**。  
3. 搜索 @userinfobot 发送任意消息，记录下你的数字 **Chat ID**。  
4. **主动给你刚建的机器人发送任意一条消息激活它**（机器人不能主动发起会话）。

### **步骤 1：创建 KV 数据库**

1. 登录 Cloudflare 控制台，左侧菜单找到 **Workers & Pages** \-\> **KV**。  
2. 点击 **Create a namespace**，命名为 esim\_db，点击添加。  
3. 创建成功后，复制它旁边长长的一串 **ID**（比如 09fe63fac...）备用。

### **步骤 2：Fork 本仓库并确认 wrangler.toml 占位符**

1. 将本项目 **Fork** 到你自己的 GitHub 账号下。  
2. 在你 Fork 后的仓库中，打开 wrangler.toml 文件。
3. 确认最下方的 KV 配置保持占位符形式，不要写死你的真实 KV ID：

   ```toml
   [[kv_namespaces]]
   binding = "ESIM_DB"
   id = "${KV_ID}"
   ```

4. 不要把自己的真实 KV ID 提交到代码里。真实 KV ID 后面会放到 GitHub Secrets，由 GitHub Actions 在部署前自动替换。

这样做的好处是：以后你同步原作者仓库更新时，`wrangler.toml` 不需要反复手动改 ID，也不会把个人配置写进公开代码。

### **步骤 3：配置 GitHub Actions Secrets**

项目使用 `.github/workflows/deploy.yml` 自动部署到 Cloudflare。这个文件不会保存你的真实密钥，而是从 GitHub Secrets 中读取。

进入你自己的 GitHub 仓库页面，按下面步骤配置：

1. 点击顶部的 **Settings**。
2. 左侧找到 **Secrets and variables**，展开后点击 **Actions**。
3. 点击 **New repository secret**，添加第一个密钥：

   ```text
   Name: CLOUDFLARE_KV_ID
   Secret: 你的 Cloudflare KV Namespace ID
   ```

4. 再点击 **New repository secret**，添加第二个密钥：

   ```text
   Name: CLOUDFLARE_API_TOKEN
   Secret: 你的 Cloudflare API Token
   ```

5. 再点击 **New repository secret**，添加第三个密钥：

   ```text
   Name: TG_BOT_TOKEN
   Secret: 你的 Telegram Bot Token
   ```

6. 切换到 **Variables**，点击 **New repository variable**，添加 Worker 访问地址：

   ```text
   Name: WORKER_URL
   Value: https://你的 Worker 域名
   ```

   示例：

   ```text
   https://esim-api.xxx.workers.dev
   ```

`CLOUDFLARE_KV_ID` 用来替换 `wrangler.toml` 里的 `${KV_ID}`。`CLOUDFLARE_API_TOKEN` 用来授权 GitHub Actions 把 Worker 部署到你的 Cloudflare 账号。`TG_BOT_TOKEN` 和 `WORKER_URL` 用来在部署完成后自动设置 Telegram Webhook。

Cloudflare API Token 建议使用最小权限：能编辑 Workers，并能读取账号资源。Telegram Bot Token 和 Cloudflare API Token 都只保存到 GitHub Secrets，不要写进 README、代码或聊天记录。

### **步骤 4：理解 .github/workflows/deploy.yml 的作用**

`.github/workflows/deploy.yml` 是 GitHub Actions 自动部署脚本。你向 `main` 分支推送代码，或者 Sync Fork 后产生新的提交时，它会自动执行。

当前流程做了四件事：

1. 拉取仓库代码：

   ```yaml
   - name: Checkout Code
     uses: actions/checkout@v4
   ```

2. 部署前把 `wrangler.toml` 里的 `${KV_ID}` 替换成 GitHub Secrets 里的真实 KV ID：

   ```yaml
   - name: Replace KV ID Placeholder
     run: sed -i 's/${KV_ID}/${{ secrets.CLOUDFLARE_KV_ID }}/g' wrangler.toml
   ```

3. 使用 Cloudflare 官方 wrangler-action 部署 Worker：

   ```yaml
   - name: Deploy to Cloudflare Workers
     uses: cloudflare/wrangler-action@v3
     with:
       apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
   ```

4. 部署完成后自动设置 Telegram Webhook：

   ```yaml
   - name: Set Telegram Webhook
     env:
       TG_BOT_TOKEN: ${{ secrets.TG_BOT_TOKEN }}
       WORKER_URL: ${{ vars.WORKER_URL }}
     run: |
       WEBHOOK_URL="${WORKER_URL%/}/api/telegram/webhook"
       curl --fail --show-error --silent --request POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook" \
         --data-urlencode "url=${WEBHOOK_URL}"
       echo "Telegram webhook set to ${WEBHOOK_URL}"
   ```

所以日常更新时，你只需要把代码推送到自己的 GitHub 仓库，GitHub Actions 会自动完成 KV ID 替换、Worker 部署和 Telegram Webhook 设置。

### **步骤 5：在 Cloudflare 部署**

1. 在 Cloudflare 左侧菜单点击 **Workers & Pages** \-\> **Overview**。  
2. 点击右上角 **Create Application**，选择 **Workers** 选项卡，然后点击 **Connect to Git**。  
3. 授权连接你的 GitHub 账号，选择你刚刚 Fork 的仓库。  
4. **关键配置**（Setup build 区域）：  
   * Root directory (根目录)：**留空**  
   * Build command (构建命令)：**留空**  
   * Entry point (入口点)：手动输入 **worker/worker.js**  
5. 点击 **Save and Deploy**，等待系统部署完成（出现绿色对勾），点击 **Continue to project**。

如果你已经配置了 GitHub Actions，也可以直接向 `main` 分支 push 代码，让 `.github/workflows/deploy.yml` 自动部署。

### **步骤 6：在 KV 数据库中添加 TG 密钥**

由于 Cloudflare 的环境变量偶尔会有部署延迟的 Bug，我们直接将验证密钥存入 KV 数据库，100% 稳定触发：

1. 回到 Cloudflare 左侧菜单，找到 **Workers & Pages** \-\> **KV**。  
2. 点击进入你在步骤 1 创建的 **esim\_db** 详情页。  
3. 点击顶部的 **KV Entries (KV 条目)** 选项卡。  
4. 在此处手动添加两条数据：  
   * **Key (键)** 填 TG\_BOT\_TOKEN，**Value (值)** 填你的机器人 Token。点击 **Add (添加)**。  
   * **Key (键)** 填 TG\_CHAT\_ID，**Value (值)** 填你的数字 ID。点击 **Add (添加)**。

### **步骤 7：设置 Telegram 机器人 Webhook**

如果你已经按步骤 3 配置了 `TG_BOT_TOKEN` 和 `WORKER_URL`，GitHub Actions 会在每次部署后自动设置 Webhook，通常不用手动打开链接。

如果你想手动设置，或需要排查自动设置是否成功，可以继续使用下面的备用方法。

1. 先确认 Worker 已经部署成功，并记下你的 Worker 访问地址，例如：

   ```text
   https://esim-api.xxx.workers.dev
   ```

2. 在浏览器打开下面的链接，把 `<TG_BOT_TOKEN>` 换成你的机器人 Token，把 `<你的Worker域名>` 换成上面的 Worker 地址：

   ```text
   https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook?url=<你的Worker域名>/api/telegram/webhook
   ```

3. 如果返回类似下面的内容，就表示 Webhook 设置成功：

   ```json
   {"ok":true,"result":true,"description":"Webhook was set"}
   ```

4. 安全限制：机器人只处理 `TG_CHAT_ID` 对应用户发来的消息。其他人就算知道机器人，也不能添加或查看你的号码数据。

5. 如果要检查当前 Webhook 是否已经设置成功，可以打开：

   ```text
   https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo
   ```

### **步骤 8：开始使用！**

由于密钥直接存入了数据库，配置会**立即生效，无需等待！**  
现在访问 Cloudflare 为你分配的 Worker 域名（例如 https://esim-api.xxx.workers.dev），点击“向 TG 机器人获取验证码”，开始享受你的保号面板吧！

也可以打开 Telegram，向你的机器人发送 /start 查看欢迎说明和添加号码流程，或发送 /help 查看可用命令。

## **🤖 Telegram 机器人功能说明**

设置 Webhook 后，Telegram 机器人不仅能接收登录验证码和到期提醒，还可以直接管理保号数据。机器人写入的数据会保存到同一个 KV key：`esim_list`，所以网页端和 Telegram 端看到的是同一份号码列表。

安全规则：机器人只处理 `TG_CHAT_ID` 对应账号发来的消息，其他 Chat ID 会被直接忽略，不会回复，也不会写入数据。

### **命令总览**

```text
/start  查看欢迎说明
/help   查看可用命令
/list   查看当前号码列表
/add    按步骤添加一个新号码
/renew  一键续期，使用 /renew 序号 快速操作
/skip   跳过当前选填字段
/site   显示网站访问链接
/cancel 取消当前未完成的添加流程
```

### **命令详情**

| 命令 | 作用 |
|------|------|
| `/start` | 显示欢迎说明、完整添加号码流程，并在消息下方显示快捷按钮。 |
| `/help` | 只显示可用命令列表，并在消息下方显示快捷按钮。 |
| `/list` | 查看当前已保存的号码列表，包括卡片名称、号码、到期日、周期、平台和备注。 |
| `/add` | 启动逐步添加号码流程。机器人会逐项询问字段，最后让你确认保存。 |
| `/renew` | 一键续期，支持 `/renew` 显示列表或 `/renew 序号` 直接续期。以今天为基准顺延保号周期天数。 |
| `/skip` | 在选填字段中跳过当前项，只能用于手机号、已注册平台、备注 / 保号要求。 |
| `/site` | 显示网页看板访问链接。 |
| `/cancel` | 取消当前未完成的添加流程，并清理临时会话。 |

### **快捷按钮**

发送 `/start` 或 `/help` 后，机器人会在消息下方显示快捷按钮：

```text
[添加号码] [查看列表]
[打开网站] [帮助]
[一键续期]
```

按钮对应动作：

| 按钮 | 等同命令 |
|------|----------|
| 添加号码 | `/add` |
| 查看列表 | `/list` |
| 打开网站 | `/site` |
| 帮助 | `/help` |
| 一键续期 | `/renew` |

按钮只是快捷入口，不会改变原有命令。你仍然可以直接输入 `/add`、`/list`、`/site`、`/help`、`/renew` 或 `/cancel`。

机器人每天会在授权用户首次交互时，额外显示一次底部输入框旁的 `/start` 按钮。这个按钮使用 Telegram 的一次性键盘，点击或使用后会自动收起；同一天不会重复显示，第二天再次交互时会重新出现一次。

### **使用 /add 添加号码**

发送 /start 可以查看完整添加号码流程说明。

发送 /add 后，机器人会按下面 6 步询问：

1. 卡片名称：必填。

   示例：KnowRoaming。

2. 手机号：选填。

   示例：+1 234 567 8900。

   如果不想填写，发送 `/skip` 跳过。

3. 保号周期：必填，输入大于 0 的整数。

   示例：180。

4. 到期日：必填，格式为 `YYYY-MM-DD`。

   示例：2026-12-31。

5. 已注册平台：选填。

   多个平台请用空格或英文逗号分隔。

   示例：Telegram Google OpenAI。

   或：Telegram, Google, OpenAI。

   如果不想填写，发送 `/skip` 跳过。

6. 备注 / 保号要求：选填。

   示例：半年发一次短信。

   如果不想填写，发送 `/skip` 跳过。

填写完成后，机器人会发送汇总信息。回复 `确认` 保存，回复 `取消` 或发送 /cancel 放弃。

如果周期或日期格式不正确，机器人会提示错误，并停留在当前步骤，不会保存错误数据。

### **字段规则**

| 字段 | 是否必填 | 输入规则 |
|------|----------|----------|
| 卡片名称 | 必填 | 不能为空，例如 `KnowRoaming`。 |
| 手机号 | 选填 | 建议带国际区号，例如 `+1 234 567 8900`；不填时发送 `/skip`。 |
| 保号周期 | 必填 | 必须是大于 0 的整数，例如 `180`。 |
| 到期日 | 必填 | 必须是 `YYYY-MM-DD` 格式，例如 `2026-12-31`。 |
| 已注册平台 | 选填 | 多个平台用空格或英文逗号分隔，例如 `Telegram Google OpenAI` 或 `Telegram, Google, OpenAI`；不填时发送 `/skip`。 |
| 备注 / 保号要求 | 选填 | 可填写保号动作、注意事项、充值要求等；不填时发送 `/skip`。 |

### **添加流程示例**

```text
你：/add
机器人：第 1/6 步：卡片名称
你：KnowRoaming

机器人：第 2/6 步：手机号
你：/skip

机器人：第 3/6 步：保号周期
你：180

机器人：第 4/6 步：到期日
你：2026-12-31

机器人：第 5/6 步：已注册平台
你：Telegram, Google, OpenAI

机器人：第 6/6 步：备注/保号要求
你：半年发一次短信

机器人：请确认新增号码信息
你：确认
```

保存成功后，新号码会立即出现在网页看板中，也会参与后续 Cron 到期提醒。

### **会话和错误处理**

* 每次 `/add` 会创建一个临时添加会话。
* 如果流程还没结束，再次发送 `/add`，机器人会提醒你先继续填写或发送 `/cancel` 取消。
* 当前流程可随时发送 `/cancel` 或回复 `取消` 放弃。
* 周期格式错误时，机器人会要求重新输入大于 0 的整数。
* 日期格式错误时，机器人会要求重新输入 `YYYY-MM-DD` 格式日期。
* 非授权账号发送命令时，机器人不会回复，也不会写入 KV。

### **使用 /renew 一键续期**

一键续期命令可以快速延长到期日，以今天为基准顺延保号周期天数。

- `/renew` — 显示号码列表，回复序号直接续期
- `/renew 序号` — 直接续期，无需二次确认

例如：

```text
你：/renew 1
机器人：✅ KnowRoaming 已续期至 2026-12-01
```

```text
你：/renew
机器人：选择要续期的号码
1. KnowRoaming | 2026-12-31 | 180 天
回复序号直接续期，例如 /renew 1
```

注意：

* 序号从 1 开始，对应 `/list` 显示的列表顺序。
* 续期不会修改名称、号码、平台、备注等字段。
* 如果未设置有效保号周期（cycle），需要先在网页端编辑后使用。

### **显示网站链接**

发送 /site 后，机器人会返回网页看板地址（你的 worker 访问地址）：

```text
https://esim-api.xxx.workers.dev
```

## **📜 许可协议 / License**

本项目基于 [MIT License](http://docs.google.com/LICENSE) 开源。您可以自由使用、修改和分发，但请保留原作者信息。如果您觉得好用，请帮忙点个 ⭐ Star！
