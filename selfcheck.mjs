// 增强版自检：node selfcheck.mjs（exit 0 = 全过）
// 只测不依赖 Aurabot 宿主的部分：纯函数（额度/分类/口令/汇报/名单）+
// 全部文件 node --check + 基础文件与原版的对照（base 文件未被意外改动）。
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${extra ? ' — ' + extra : ''}`) }
}

const { normalizeQuotas, quotaLeft, inActiveHours, quotaStatus, PLUS_QUOTAS_DEFAULT } = await import('./lib/quotas.mjs')
const { classifyVideo, sortForWatch, filterByTopic } = await import('./lib/classify.mjs')
const { parseCommand } = await import('./lib/commands.mjs')
const { buildDailyReport } = await import('./lib/report.mjs')
const { loadPeople, savePeople, addPerson, removePerson, canShare, canAt, isBlocked, peopleSummary } = await import('./lib/people.mjs')

// ---- 额度 ----
check('额度默认值是方案 §4（浏览100/点赞30/评论10/分享10/@5/汇报3）',
  PLUS_QUOTAS_DEFAULT.watch === 100 && PLUS_QUOTAS_DEFAULT.like === 30 && PLUS_QUOTAS_DEFAULT.comment === 10 &&
  PLUS_QUOTAS_DEFAULT.share === 10 && PLUS_QUOTAS_DEFAULT.at === 5 && PLUS_QUOTAS_DEFAULT.report === 3)
check('额度缺项补默认、越界夹住', normalizeQuotas({ like: -5, comment: 999999 }).like === 0 && normalizeQuotas({}).watch === 100)
check('活动时段 09:00–22:00：10 点在内、23 点在外',
  inActiveHours({}, new Date(2026, 10, 15, 10)) && !inActiveHours({}, new Date(2026, 10, 15, 23)))
check('剩余额度按日计数算', quotaLeft({}, { watched: 90, like: 25 }, 'like') === 5 && quotaLeft({}, { watched: 90 }, 'watch') === 10)
check('quotaStatus 一次给全', (() => { const s = quotaStatus({}, { like: 30 }); return s.left.like === 0 && s.quotas.comment === 10 })())

// ---- 分类 ----
const v = (title, desc = '', tags = []) => ({ title, desc, tags, category: [], summary: '' })
check('科技视频优先', classifyVideo(v('最新 AI 芯片发布', '人工智能大模型')).tier === 'priority')
check('购物视频跳过', classifyVideo(v('好物推荐', '点击购买领券下单')).tier === 'skip')
check('直播带货跳过', classifyVideo(v('直播带货专场', '小黄车秒杀')).tier === 'skip')
check('非商业测评保留', classifyVideo(v('手机开箱测评', '真实使用一个月体验')).tier !== 'skip')
check('带购物信号的测评跳过', classifyVideo(v('手机测评', '链接在评论区，点击购买')).tier === 'skip')
check('历史知识优先', classifyVideo(v('唐朝历史冷知识', '考古发现')).tier === 'priority')
check('排序：优先在前、跳过被去掉',
  sortForWatch([v('好物推荐', '点击购买'), v('搞笑段子'), v('AI 新闻')]).map((x) => x.v.title).join(',') === 'AI 新闻,搞笑段子')
check('今天只看科技：只留科技', filterByTopic([v('AI 新闻'), v('搞笑段子')], 'AI').length === 1)

// ---- 口令 ----
check('口令：开始刷抖音', parseCommand('开始刷抖音')?.action === 'browse')
check('口令：今天只看科技带主题', parseCommand('今天只看科技')?.action === 'topic' && parseCommand('今天只看科技')?.arg === '科技')
check('口令：查看剩余额度', parseCommand('查看剩余额度')?.action === 'quota')
check('口令：今天不要看购物内容', parseCommand('今天不要看购物内容')?.action === 'no-shopping')
check('口令：认不出返回 null', parseCommand('你好呀') === null)

// ---- 汇报 ----
check('日报含数字与剩余额度',
  buildDailyReport({ watched: 12, liked: 5, commented: 2, shared: 3, quotasLeft: { like: 25, share: 7 } }).includes('看了 12 个视频') &&
  buildDailyReport({ watched: 12, liked: 5, commented: 2, shared: 3, quotasLeft: { like: 25 } }).includes('点赞25'))

// ---- 名单 ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dy-plus-people-'))
  const empty = loadPeople(tmp)
  check('名单文件不存在时返回空名单', empty.share.length === 0 && empty.at.length === 0 && empty.block.length === 0)
  const p1 = { secUid: 'MS4wAAA', uid: '1001', nickname: '阿明', douyinId: 'aming' }
  const p2 = { secUid: 'MS4wBBB', uid: '1002', nickname: '小红', douyinId: 'xiaohong' }
  let people = addPerson(empty, 'share', p1)
  people = addPerson(people, 'at', p1)
  people = addPerson(people, 'share', p2)
  savePeople(tmp, people)
  const back = loadPeople(tmp)
  check('名单写盘读回一致', back.share.length === 2 && back.at.length === 1 && back.share[0].nickname === '阿明')
  check('能分享给白名单里的人', canShare(back, 'MS4wAAA') && canShare(back, 'MS4wBBB'))
  check('不在白名单里不能分享', !canShare(back, 'MS4wCCC'))
  check('能 @ 白名单里的人', canAt(back, 'MS4wAAA'))
  check('黑名单优先级最高：进黑名单后分享和 @ 都拒绝',
    (() => { const b = addPerson(back, 'block', p1); return isBlocked(b, 'MS4wAAA') && !canShare(b, 'MS4wAAA') && !canAt(b, 'MS4wAAA') })())
  check('删人后不能再分享', (() => { const d = removePerson(back, 'share', 'MS4wBBB'); return !canShare(d, 'MS4wBBB') })())
  check('名单摘要有数', peopleSummary(back).share === 2 && peopleSummary(back).shareNames.includes('阿明'))
  fs.rmSync(tmp, { recursive: true, force: true })
}

// ---- 文件与语法 ----
for (const f of ['index.mjs', 'lib/duty.mjs', 'lib/site.mjs', 'lib/browser.mjs', 'lib/ego.mjs', 'lib/quotas.mjs', 'lib/classify.mjs', 'lib/people.mjs', 'lib/commands.mjs', 'lib/report.mjs']) {
  try {
    execSync(`node --check ${JSON.stringify(path.join(ROOT, f))}`, { stdio: 'pipe' })
    check(`node --check ${f}`, true)
  } catch (e) {
    check(`node --check ${f}`, false, String(e.stderr || e.message).slice(0, 200))
  }
}
const dutySrc = fs.readFileSync(path.join(ROOT, 'lib/duty.mjs'), 'utf8')
check('duty 含 PLUS 白名单分享', dutySrc.includes('shareToWhitelist'))
check('duty 含 PLUS 额度', dutySrc.includes('plusCapOf') && dutySrc.includes('loadQuotas'))
check('duty 含 PLUS 分类', dutySrc.includes('sortForWatch') && dutySrc.includes('classifyVideo'))
check('duty 含 PLUS 汇报', dutySrc.includes('reportNow') && dutySrc.includes('buildDailyReport'))
check('duty 含 PLUS 口令', dutySrc.includes('handleCommand') && dutySrc.includes('parseCommand'))
check('duty 写操作闸门走增强版额度（不是原版评论 3 次）', dutySrc.includes("plusLeft(s, kind) <= 0"))
check('duty 不再只分享给主人', !dutySrc.includes('shareToOwner(s, v, share)') || dutySrc.includes('shareToWhitelist'))
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.mjs'), 'utf8')
check('index 注册了增强版工具', indexSrc.includes('douyin_plus_share') && indexSrc.includes('douyin_plus_command') && indexSrc.includes('douyin_plus_report'))
check('index 模块 id 是 douyin-plus', indexSrc.includes("id: 'douyin-plus'"))
check('index 版本 0.2.0', indexSrc.includes("version: '0.2.0'"))
check('v0.2.0 脱钩：不再注册 /douyin/* 路由', !indexSrc.includes("'/douyin/"))
check('v0.2.0 脱钩：/douyin-plus/* 路由齐全（登录/跑一轮/私信/核对）',
  ['/douyin-plus/state', '/douyin-plus/account', '/douyin-plus/login', '/douyin-plus/login/status', '/douyin-plus/window', '/douyin-plus/run', '/douyin-plus/dms', '/douyin-plus/confirm-owner'].every((r) => indexSrc.includes(`'${r}'`)))
check('v0.2.0 脱钩：原版工具名已改名', ['douyin_plus_watch', 'douyin_plus_recent', 'douyin_plus_browse', 'douyin_plus_share_owner', 'douyin_plus_send_dm', 'douyin_plus_like', 'douyin_plus_comment'].every((t) => indexSrc.includes(`name: '${t}'`)))
check('v0.2.0 脱钩：无原版工具名残留',
  !['douyin_watch', 'douyin_recent', 'douyin_browse', 'douyin_share_owner', 'douyin_send_dm', 'douyin_like', 'douyin_comment'].some((t) => indexSrc.includes(`name: '${t}'`)))
check('v0.2.0 脱钩：定时器改名', indexSrc.includes("'刷抖音增强版'") && !indexSrc.includes("'刷抖音')"))
const mod = JSON.parse(fs.readFileSync(path.join(ROOT, 'module.json'), 'utf8'))
check('module.json 版本 0.2.0、id douyin-plus', mod.version === '0.2.0' && mod.id === 'douyin-plus')
check('原版 base 文件未动：browser/site/ego 不含 PLUS 标记',
  ['lib/browser.mjs', 'lib/site.mjs', 'lib/ego.mjs'].every((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8')
    return !s.includes('douyin-plus') && !s.includes('douyin_plus') && !s.includes('shareToWhitelist') && !s.includes('plusCapOf')
  }))
check('安装脚本存在', fs.existsSync(path.join(ROOT, 'install.ps1')) && fs.existsSync(path.join(ROOT, 'uninstall.ps1')))

console.log(`\n${pass} passed, ${fail} failed.`)
if (fail) process.exit(1)
console.log('\nAll self-checks passed.')
