const __lib = globalThis.aurabot.lib // 插件内部源码（复制出来后靠它找到插件里的文件）
// 增强版（Aurabot QQ 抖音增强版 v0.1.0）：基于社区模块 douyin 2.3.6（MIT）改。
// 基础能力（专用浏览器、登录、定时刷、点赞评论、验证码熔断）沿用原版；
// 新增：分享白名单（抖音好友，可选）+ 黑名单最高优先、评论区 @ 白名单、
// 方案 §4 额度表（可配置）、内容分类（科技/AI 优先，购物/直播跳过）、
// QQ 主动日报、QQ 自然语言口令。分享只在抖音里发，不走 QQ。

import { createDouyin } from './lib/duty.mjs'
const { defineTool, str } = __lib('tools/tools.js')
const { profileToolVisible, profilePermits } = __lib('chat/access.js')

export default {
  id: 'douyin-plus',
  name: '刷抖音增强版',
  version: '0.1.0',
  api: 1,
  description: 'Aurabot 抖音增强版：自主刷抖音、筛选优质内容、点赞评论，分享给白名单里的抖音好友（抖音私信），评论区 @ 白名单，QQ 口令控制，每日额度与熔断。',
  tab: 'douyin-plus',
  setup(api) {
    const { hub, http } = api.core
    // 主人的抖音号只由「核对」写入（面板存配置时不能直接改 secUid）
    const setOwner = (owner) => api.setConfig((cur) => ({ ...cur, douyin: { ...cur.douyin, owner } }))
    // 出站治理面：旧主仓没有 api.proactive 时为 undefined，duty 内部可选链降级回 hub.sendText。
    const dy = createDouyin({ getConfig: api.config, setOwner, hub, memory: api.lazy('memory'), log: api.log, proactive: api.proactive })
    api.every(60_000, () => dy.tick(), '刷抖音')
    api.onDispose(() => dy.dispose())

    api.tool(({ chat, sessionId }) => {
      const cfg = api.config()
      if (!cfg.douyin.enabled || chat.kind === 'system') return []
      // 执行时再查一遍权限（面板可能刚改过）
      const guarded = (key, run) => async (args) => {
        const c = api.config()
        if (!c.douyin.enabled) return { ok: false, message: '抖音没打开' }
        const p = profilePermits(c, key, chat, hub.turnSendersAllOwner(sessionId))
        if (!p.ok) return p
        return run(args)
      }
      const tools = []
      if (profileToolVisible(cfg, 'douyinBrowse', chat)) {
        tools.push(defineTool({
          name: 'douyin_watch',
          description: '打开一个抖音视频看看：读标题、分类、内容摘要和热评，看完再聊。别人发来抖音链接（v.douyin.com 短链也行）时用。',
          properties: { link: str('抖音视频链接或 v.douyin.com 短链') },
          required: ['link'],
          execute: guarded('douyinBrowse', ({ link }) => dy.watch(String(link || ''))),
        }))
        tools.push(defineTool({
          name: 'douyin_recent',
          description: '查最近刷过的抖音视频及真实链接。有人问刚才刷了什么、要分享或评论刚看过的视频时先用；没有记录就如实说。',
          properties: {},
          execute: guarded('douyinBrowse', async () => {
            const videos = dy.recentVideos()
            return { ok: true, message: videos.length ? videos.map((v) => `《${v.title || '无标题'}》${v.url}`).join('\n') : '最近没有能找到链接的视频记录', videos }
          }),
        }))
        tools.push(defineTool({
          name: 'douyin_browse',
          description: '现在去刷一会儿抖音推荐，有人让你去刷抖音、找个视频给他时用。只是开始刷：要几分钟，刷完系统会把结果（看了什么、分享了哪个）告诉你，在那之前别说已经分享了 / 已经发了。主人开口要的话，这轮一定会挑一个分享给主人。',
          properties: {},
          execute: guarded('douyinBrowse', async () => dy.browse({ ownerAsked: hub.turnHasOwner(sessionId), report: chat })),
        }))
      }
      if (profileToolVisible(cfg, 'douyinShareOwner', chat)) tools.push(defineTool({
        name: 'douyin_share_owner',
        description: '主人明确要求分享某个抖音视频给自己时用；link 填真实链接或视频 id。发到面板设置的抖音私信、QQ 或两边。',
        properties: { link: str('抖音视频链接或视频 id') },
        required: ['link'],
        execute: guarded('douyinShareOwner', ({ link }) => dy.shareVideo(String(link || ''))),
      }))
      // PLUS：增强版工具（白名单 / 额度 / 汇报 / QQ 口令），权限沿用抖音分享那一项。
      if (profileToolVisible(cfg, 'douyinShareOwner', chat)) {
        tools.push(defineTool({
          name: 'douyin_plus_share',
          description: '把一个抖音视频分享给分享白名单里的抖音好友（抖音私信，视频卡片）。link 填真实链接或视频 id；不填收件人就发给白名单里的所有人（黑名单里的人跳过）。',
          properties: { link: str('抖音视频链接或视频 id') },
          required: ['link'],
          execute: guarded('douyinShareOwner', ({ link }) => dy.shareVideo(String(link || ''))),
        }))
        tools.push(defineTool({
          name: 'douyin_plus_people',
          description: '查白名单 / 黑名单里都有谁。主人问“分享给谁”“白名单都有谁”时用。',
          properties: {},
          execute: guarded('douyinShareOwner', async () => dy.peopleList()),
        }))
        tools.push(defineTool({
          name: 'douyin_plus_add_person',
          description: '把一个人加进名单：kind 是 share（分享白名单）/ at（@白名单）/ block（黑名单）；input 是对方抖音主页链接或抖音号。加之前会先核对认人。',
          properties: { kind: str('share / at / block'), input: str('对方抖音主页链接或抖音号') },
          required: ['kind', 'input'],
          execute: guarded('douyinShareOwner', ({ kind, input }) => dy.addPerson(String(kind || '').trim(), String(input || ''))),
        }))
        tools.push(defineTool({
          name: 'douyin_plus_quota',
          description: '查今天还剩多少额度：浏览、点赞、评论、分享、@、汇报各剩几次。',
          properties: {},
          execute: guarded('douyinShareOwner', async () => dy.quotaStatus()),
        }))
        tools.push(defineTool({
          name: 'douyin_plus_report',
          description: '现在就发一份今日抖音日报到主人 QQ：看了多少、分享了什么、还剩多少额度。',
          properties: {},
          execute: guarded('douyinShareOwner', async () => dy.reportNow()),
        }))
        tools.push(defineTool({
          name: 'douyin_plus_command',
          description: 'QQ 自然语言控制：主人一句话控制刷抖音，如“开始刷抖音”“今天只看科技”“查看剩余额度”。text 填主人原话。',
          properties: { text: str('主人在 QQ 里说的原话') },
          required: ['text'],
          execute: guarded('douyinShareOwner', ({ text }) => dy.handleCommand(String(text || ''))),
        }))
      }
      if (profileToolVisible(cfg, 'douyinDm', chat)) tools.push(defineTool({
        name: 'douyin_send_dm',
        description: '主人明确要求你给某个抖音用户发私信时用。target 填对方的主页链接或抖音号，text 是要说的话（300 字以内）。只发给主人指定的人。',
        properties: { target: str('对方抖音主页链接或抖音号'), text: str('要说的话') },
        required: ['target', 'text'],
        execute: guarded('douyinDm', ({ target, text }) => dy.directDm({ target, text })),
      }))
      if (profileToolVisible(cfg, 'douyinLike', chat)) tools.push(defineTool({
        name: 'douyin_like',
        description: '给一个抖音视频点赞。有人明确让你点赞时用。link 填视频链接。',
        properties: { link: str('抖音视频链接') },
        required: ['link'],
        execute: guarded('douyinLike', ({ link }) => dy.likeVideo(String(link || ''))),
      }))
      if (profileToolVisible(cfg, 'douyinComment', chat)) tools.push(defineTool({
        name: 'douyin_comment',
        description: '在一个抖音视频下发评论。有人明确让你去评论时用。link 填视频链接，text 是评论内容（100 字以内）。',
        properties: { link: str('抖音视频链接'), text: str('评论内容') },
        required: ['link', 'text'],
        execute: guarded('douyinComment', ({ link, text }) => dy.commentVideo(String(link || ''), String(text || ''))),
      }))
      return tools
    })

    // 面板：/douyin/state 只读文件，绝不为了显示状态去开浏览器
    api.route('/douyin/state', async () => ({ ok: true, ...dy.state() }))
    // PLUS 路由（增强版自己的状态 / 名单 / 额度 / 汇报）
    api.route('/douyin-plus/state', async () => ({ ok: true, ...dy.state() }))
    api.route('/douyin-plus/people', async () => dy.peopleList())
    api.route('/douyin-plus/quotas', async () => dy.quotaStatus())
    api.route('/douyin-plus/report', async () => dy.reportNow())
    api.route('/douyin-plus/command', async (req) => {
      const b = await http.body(req).catch(() => ({}))
      return dy.handleCommand(String(b?.text ?? ''))
    })
    api.route('/douyin-plus/person/add', async (req) => {
      const b = await http.body(req).catch(() => ({}))
      return dy.addPerson(String(b?.kind ?? 'share'), String(b?.input ?? ''))
    })
    api.route('/douyin-plus/person/remove', async (req) => {
      const b = await http.body(req).catch(() => ({}))
      return dy.removePerson(String(b?.kind ?? 'share'), String(b?.secUid ?? ''))
    })
    api.route('/douyin/account', async () => dy.account(true))
    api.route('/douyin/login', async () => dy.loginStep(true))
    api.route('/douyin/login/status', async () => dy.loginStep(false))
    api.route('/douyin/window', async (req) => {
      const b = await http.body(req).catch(() => ({}))
      return dy.showWindow(Boolean(b?.visible))
    })
    api.route('/douyin/run', async () => dy.browse())
    api.route('/douyin/dms', async () => dy.checkOwnerDms())
    api.route('/douyin/confirm-owner', async (req) => {
      const b = await http.body(req).catch(() => ({}))
      return dy.confirmOwner(String(b?.input ?? api.config().douyin.owner.input ?? ''))
    })
    return dy
  },
}
