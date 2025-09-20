/**
 * Discord Bot (minimal) / 最小化 Discord 机器人
 *
 * 环境变量（根据你的提供）：
 * - CLIENT_TOKEN: Bot Token
 * - APPLICATION_ID: 应用 ID（本最小实现仅发送消息，不注册命令）
 */
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, TextChannel, EmbedBuilder } from 'discord.js';
import { CenterService, NormalizedEvent } from '../center/service';

// 最小 Intent：仅连接与发送，不读取消息内容
export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let isReady = false;

export async function startDiscordBot(): Promise<void> {
  const token = process.env.CLIENT_TOKEN;
  if (!token) {
    // eslint-disable-next-line no-console
    console.warn('[Discord] CLIENT_TOKEN is not set, bot will not start.');
    return;
  }
  if (isReady) return;
  await discordClient.login(token);
  isReady = true;
  // eslint-disable-next-line no-console
  console.log('[Discord] Bot logged in.');

  // Register slash commands / 注册 Slash 命令
  try {
    const appId = process.env.APPLICATION_ID;
    if (!appId) {
      console.warn('[Discord] APPLICATION_ID is not set, skip command registration.');
      return;
    }
    const commands = [
      // /hello
      new SlashCommandBuilder().setName('hello').setDescription('Say hello / 打个招呼').toJSON(),
      // /doma-poll 集成 Doma Poll API（见文档 https://docs.doma.xyz/api-reference/poll-api#get-v1-poll ）
      new SlashCommandBuilder()
        .setName('doma-poll')
        .setDescription('Fetch Doma events via Poll API / 通过 Poll API 拉取事件')
        .addIntegerOption(o => o.setName('limit').setDescription('max items 每次最多返回条数').setMinValue(1).setMaxValue(100))
        .addBooleanOption(o => o.setName('finalized_only').setDescription('only finalized 仅返回最终确认事件'))
        .addStringOption(o => o.setName('types').setDescription('comma separated eventTypes 逗号分隔的事件类型列表'))
        .addBooleanOption(o => o.setName('ack').setDescription('ack lastId after fetch 拉取后立即确认'))
        .addBooleanOption(o => o.setName('public').setDescription('show message to channel 是否公开显示'))
        .toJSON(),
      // /dispatch-event 由用户提供事件参数，走中心服务全链路分发（不造数据）
      new SlashCommandBuilder()
        .setName('dispatch-event')
        .setDescription('Dispatch a custom event via center service / 将自定义事件通过中心服务分发')
        .addStringOption(o => o.setName('type').setDescription('event type 事件类型').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('domain name 域名').setRequired(true))
        .addStringOption(o => o.setName('block').setDescription('block number 区块号'))
        .addStringOption(o => o.setName('tx').setDescription('tx hash 交易哈希'))
        .toJSON(),
    ];
    const rest = new REST({ version: '10' }).setToken(token);
    const guildId = process.env.DISCORD_GUILD_ID; // 优先服务器内注册，立即生效
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log('[Discord] Registered guild commands for', guildId);
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('[Discord] Registered global commands (may take minutes)');
    }
  } catch (e: any) {
    console.warn('[Discord] Register command failed:', e?.message || e);
  }

  // Interaction handler / 交互处理
  discordClient.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === 'hello') {
        await interaction.reply('Hello! 你好~');
        return;
      }
      if (interaction.commandName === 'doma-poll') {
        /**
         * 集成 Doma Poll API（GET /v1/poll）与 ACK（POST /v1/poll/ack/{lastEventId}）
         * Docs: https://docs.doma.xyz/api-reference/poll-api#get-v1-poll
         *
         * 中文流程：
         * 1) 从环境读 DOMA_API_BASE（默认 https://api-testnet.doma.xyz）与 DOMA_API_KEY（必填），并组装查询参数。
         * 2) 发送 GET /v1/poll，请求头使用 Api-Key: <key>。
         * 3) 将返回 events 数量、lastId 摘要化返回，并展示首条事件的关键信息（避免超长）。
         * 4) 若传入 ack=true 且有 lastId，则调用 POST /v1/poll/ack/{lastId} 进行确认。
         *
         * English:
         * 1) Read DOMA_API_BASE (default https://api-testnet.doma.xyz) and DOMA_API_KEY, build query params.
         * 2) GET /v1/poll with header Api-Key.
         * 3) Reply with summary (#events, lastId) and a brief of the first event.
         * 4) If ack=true and lastId exists, POST /v1/poll/ack/{lastId}.
         */
        const base = process.env.DOMA_API_BASE || 'https://api-testnet.doma.xyz';
        const apiKey = process.env.DOMA_API_KEY;
        if (!apiKey) {
          await interaction.reply({ content: 'DOMA_API_KEY is required / 需要设置 DOMA_API_KEY', ephemeral: true });
          return;
        }

        const limit = interaction.options.getInteger('limit') ?? undefined;
        const finalizedOnly = interaction.options.getBoolean('finalized_only') ?? undefined;
        const types = interaction.options.getString('types') ?? undefined;
        const doAck = interaction.options.getBoolean('ack') ?? false;
        const isPublic = interaction.options.getBoolean('public') ?? false;

        // 构造查询字符串 / Build query string
        const usp = new URLSearchParams();
        if (limit) usp.set('limit', String(limit));
        if (typeof finalizedOnly === 'boolean') usp.set('finalizedOnly', String(finalizedOnly));
        if (types) {
          const list = types.split(',').map(s => s.trim()).filter(Boolean);
          for (const t of list) usp.append('eventTypes', t);
        }

        const url = `${base.replace(/\/$/, '')}/v1/poll${usp.toString() ? `?${usp.toString()}` : ''}`;
        const headers: Record<string, string> = { 'accept': 'application/json', 'Api-Key': apiKey };

        // 发起拉取 / Fetch poll
        const resp = await fetch(url, { headers });
        const bodyText = await resp.text();
        if (!resp.ok) {
          const snippet = bodyText.slice(0, 500);
          await interaction.reply({ content: `Poll failed ${resp.status}: ${snippet}`, ephemeral: true });
          return;
        }
        let json: any;
        try { json = JSON.parse(bodyText); } catch { json = { raw: bodyText }; }

        const events = Array.isArray(json?.events) ? json.events : [];
        const lastId = json?.lastId;
        const hasMore = Boolean(json?.hasMoreEvents);
        // 使用 Embed 展示更友好的信息 / Pretty embed output
        const embed = new EmbedBuilder()
          .setTitle('Doma Events')
          .setColor(0x2b8a3e)
          .setDescription(`count: ${events.length} | lastId: ${lastId ?? 'n/a'} | hasMore: ${hasMore}`);
        const maxShow = Math.min(events.length, Math.max(1, Math.min(5, (limit ?? 3))));
        for (let i = 0; i < maxShow; i++) {
          const ev = events[i] || {};
          const type = ev.type || ev?.eventData?.type || 'unknown';
          const name = ev.name || ev?.eventData?.name || '-';
          const block = ev?.eventData?.blockNumber || '-';
          const txHash = ev?.eventData?.txHash || '-';
          const short = typeof txHash === 'string' && txHash.length > 16 ? `${txHash.slice(0, 10)}…${txHash.slice(-6)}` : txHash;
          const value = `type: \`${type}\`\nname: \`${name}\`\nblock: \`${block}\`\ntx: \`${short}\``;
          embed.addFields({ name: `#${i + 1} · id ${ev.id ?? '-'}`, value });
        }

        let ackMsg = '';
        if (doAck && typeof lastId === 'number') {
          const ackUrl = `${base.replace(/\/$/, '')}/v1/poll/ack/${lastId}`;
          const ack = await fetch(ackUrl, { method: 'POST', headers });
          ackMsg = ack.ok ? ' | ack: ok' : ` | ack: failed ${ack.status}`;
        }

        if (ackMsg) embed.setFooter({ text: ackMsg.replace(/^ \| /, '') });
        await interaction.reply({ embeds: [embed], ephemeral: !isPublic });
        return;
      }
      if (interaction.commandName === 'dispatch-event') {
        // 用户提供参数，中心服务分发；不生成任何默认值，避免“编造数据”
        const ev: NormalizedEvent = {
          id: Date.now(), // 仅本地分发用，不入库，不与链ID关联
          type: interaction.options.getString('type', true),
          name: interaction.options.getString('name', true) || undefined,
          blockNumber: interaction.options.getString('block') || undefined,
          txHash: interaction.options.getString('tx') || undefined,
        };
        const center = new CenterService();
        await center.dispatchToUsers(ev);
        await interaction.reply({ content: '已分发（Dispatch queued via center service）', ephemeral: true });
        return;
      }
      // 已移除 /doma-network 相关逻辑 / Removed doma-network handler
    } catch (e: any) {
      console.warn('[Discord] interaction error:', e?.message || e);
    }
  });
}

/**
 * 发送一句消息到指定频道
 * Send a simple message to a channel
 */
export async function sendToChannel(channelId: string, content: string): Promise<void> {
  if (!isReady) await startDiscordBot();
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !('send' in (channel as any))) {
    throw new Error('Channel not found or not a text channel');
  }
  await (channel as TextChannel).send(content);
}


