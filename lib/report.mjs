// PLUS: QQ 主动汇报（方案 §2.6 / §4）。不是机械转发链接，
// 而是今天看了多少、发现了什么好内容、点赞评论分享各多少、还剩多少额度。
// 一天最多 report 次（额度表里定，默认 3），每次汇报完计数 +1，重启不清零。

/** state 是 duty 的日计数，quotas 是额度表，sharedList 是今天分享过的。 */
export function buildDailyReport({ date = new Date(), watched = 0, liked = 0, commented = 0, shared = 0, atted = 0, quotasLeft = {}, sharedList = [], topVideos = []} = {}) {
const d = `${date.getMonth() + 1}月${date.getDate()}日`
const lines = [`今天看了 ${watched} 个视频，点赞 ${liked}，评论 ${commented}${atted? `（@了 ${atted} 次）`: ''}，分享 ${shared} 个。`]
if (sharedList.length) {
lines.push('分享出去的：')
for (const s of sharedList.slice(0, 5)) lines.push(`·《${s.title || '无标题'}》→ ${s.to || ''}`)
}
if (topVideos.length) {
lines.push('值得一看的：')
for (const v of topVideos.slice(0, 3)) lines.push(`·《${v.title || ''}》${v.author? ' — ' + v.author: ''}${v.url? ' ' + v.url: ''}`)
}
const left = Object.entries(quotasLeft).filter(([, n]) => typeof n === 'number')
if (left.length) {
const names = { watch: '浏览', like: '点赞', comment: '评论', share: '分享', at: '@', report: '汇报'}
lines.push('还剩：' + left.map(([k, n]) => `${names[k] || k}${n}`).join('、'))
}
return lines.join('\n')
}
