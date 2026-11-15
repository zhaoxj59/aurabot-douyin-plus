// PLUS: 每日额度（方案 §4）。默认值是前期讨论的建议初始值，
// 正式使用时作为可修改配置存在 douyin-plus-quotas.json 里，不写死。
// 活动时段默认 09:00–22:00，时段外定时不刷，手动刷不受限。

export const PLUS_QUOTAS_DEFAULT = Object.freeze({
  watch: 100, // 自主浏览（个视频 / 天）
  like: 30, // 点赞 / 天
  comment: 10, // 评论 / 天
  share: 10, // 分享好友 / 天
  at: 5, // 评论区 @ 好友 / 天
  report: 3, // QQ 主动汇报 / 天
  activeFrom: 9, // 活动时段开始（小时，本地时间）
  activeTo: 22, // 活动时段结束（小时，本地时间）
})

const num = (v, dflt, min = 0, max = 100000) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : dflt
}

/** raw（文件里的配置）→ 完整额度表，缺项补默认，越界夹住。 */
export function normalizeQuotas(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    watch: num(r.watch, PLUS_QUOTAS_DEFAULT.watch, 0),
    like: num(r.like, PLUS_QUOTAS_DEFAULT.like, 0),
    comment: num(r.comment, PLUS_QUOTAS_DEFAULT.comment, 0),
    share: num(r.share, PLUS_QUOTAS_DEFAULT.share, 0),
    at: num(r.at, PLUS_QUOTAS_DEFAULT.at, 0),
    report: num(r.report, PLUS_QUOTAS_DEFAULT.report, 0),
    activeFrom: num(r.activeFrom, PLUS_QUOTAS_DEFAULT.activeFrom, 0, 23),
    activeTo: num(r.activeTo, PLUS_QUOTAS_DEFAULT.activeTo, 1, 24),
  }
}

/** 现在是否在活动时段内（本地时间）。from === to 视为全天。 */
export function inActiveHours(quotas, date = new Date()) {
  const q = normalizeQuotas(quotas)
  if (q.activeFrom === q.activeTo) return true
  const h = date.getHours()
  return q.activeFrom < q.activeTo
    ? h >= q.activeFrom && h < q.activeTo
    : h >= q.activeFrom || h < q.activeTo
}

/** 某项今天还剩多少（state 是 duty 的日计数：watched/like/comment/share/at/reports）。 */
export function quotaLeft(quotas, state = {}, kind) {
  const q = normalizeQuotas(quotas)
  const used = {
    watch: state.watched || 0,
    like: state.like || 0,
    comment: state.comment || 0,
    share: state.share || 0,
    at: state.at || 0,
    report: state.reports || 0,
  }
  if (!(kind in q)) return 0
  return Math.max(0, q[kind] - (used[kind] || 0))
}

/** 今日统计 + 剩余额度，一行给 QQ / 面板读。 */
export function quotaStatus(quotas, state = {}) {
  const q = normalizeQuotas(quotas)
  const kinds = ['watch', 'like', 'comment', 'share', 'at', 'report']
  const used = { watch: state.watched || 0, like: state.like || 0, comment: state.comment || 0, share: state.share || 0, at: state.at || 0, report: state.reports || 0 }
  const left = {}
  for (const k of kinds) left[k] = Math.max(0, q[k] - used[k])
  return { quotas: q, used, left, activeNow: inActiveHours(q) }
}
