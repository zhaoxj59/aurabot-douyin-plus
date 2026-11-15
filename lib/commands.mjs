// PLUS: QQ 自然语言控制（方案 §6）。不要求用户记复杂命令，
// QQ 里一句话就能控制。返回 { action, arg }，认不出返回 null。
// action: browse | pause | resume | topic | no-comment | pause-like |
//         share-best | status | quota | no-shopping

const RULES = [
  { re: /^(开始刷抖音|刷抖音|去刷抖音)$/, action: 'browse' },
  { re: /^(暂停刷抖音|别刷了|停一下)$/, action: 'pause' },
  { re: /^(恢复刷抖音|继续刷)$/, action: 'resume' },
  { re: /^今天只看(.+)$/, action: 'topic' },
  { re: /^(今天不要评论|别评论|不要评论)$/, action: 'no-comment' },
  { re: /^(暂停点赞|别点赞|不要点赞)$/, action: 'pause-like' },
  { re: /^(分享精选|把精选分享一下)$/, action: 'share-best' },
  { re: /^(查看今天的情况|今天看了什么|今天怎么样)$/, action: 'status' },
  { re: /^(查看剩余额度|还剩多少|剩余额度)$/, action: 'quota' },
  { re: /^(今天不要看购物内容|别看购物|不要购物)$/, action: 'no-shopping' },
]

export function parseCommand(text) {
  const t = String(text || '').trim()
  if (!t) return null
  for (const r of RULES) {
    const m = t.match(r.re)
    if (m) return { action: r.action, arg: m[1] ? m[1].trim() : '' }
  }
  return null
}

/** 给鱼看的口令表（QQ 里说这些话就能控制，不用记命令）。 */
export const COMMAND_HELP = [
  '开始刷抖音',
  '暂停刷抖音 / 恢复刷抖音',
  '今天只看科技 / 今天只看 AI',
  '今天不要评论 / 暂停点赞',
  '分享精选',
  '查看今天的情况 / 查看剩余额度',
  '今天不要看购物内容',
].join('\n')
