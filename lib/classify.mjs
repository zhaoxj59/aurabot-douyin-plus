// PLUS: 内容分类（方案 §2）。只看视频自带的标题 / 描述 / 标签 / 分类，
// 不猜测、不调额外接口。返回 { tier, topics, reason }：
//   priority — 科技、AI、数码、历史、知识、教育，优先看
//   ok       — 搞笑、娱乐、生活、优质经验分享，可以看
//   skip     — 广告、购物、直播带货、商品推广，直接跳过（不消耗互动额度）
// 测评特殊处理：非商业、有真实信息价值的测评保留；带购物信号的测评跳过。

const hasAny = (text, words) => words.some((w) => text.includes(w))

const SHOPPING = [
  '购买', '下单', '领券', '优惠券', '购物车', '商品链接', '商城', '秒杀', '拼单',
  '直播带货', '带货', '种草', '好物推荐', '好物分享', '链接在', '点击购买',
  '小黄车', '橱窗', '团购', '返利', '折扣', '满减', '包邮',
]
const ADS = ['广告', '推广', '赞助', '品牌合作', '商业合作', '付费推广']
const PRIORITY_TOPICS = [
  { topic: 'AI', words: ['AI', '人工智能', '大模型', 'ChatGPT', 'DeepSeek', '机器学习', '算法'] },
  { topic: '科技', words: ['科技', '数码', '芯片', '手机', '电脑', '软件', '编程', '代码', '开源', '机器人'] },
  { topic: '历史', words: ['历史', '朝代', '古代', '考古', '文物'] },
  { topic: '知识', words: ['知识', '科普', '教育', '教学', '学习', '讲座', '冷知识', '涨知识'] },
]
const OK_TOPICS = [
  { topic: '搞笑', words: ['搞笑', '幽默', '段子', '笑话'] },
  { topic: '娱乐', words: ['娱乐', '综艺', '明星', '音乐', '舞蹈'] },
  { topic: '生活', words: ['生活', '美食', '旅行', '日常', 'vlog', '宠物'] },
  { topic: '经验分享', words: ['经验', '分享', '干货', '教程', '攻略', '技巧'] },
]
const REVIEW = ['测评', '评测', '开箱', '体验', '横评']

/**
 * v 是 normalizeAweme 后的视频：{ title, desc, tags, category, summary }。
 * 广告 / 直播在 normalizeAweme 里已滤掉，这里只做内容层分类。
 */
export function classifyVideo(v = {}) {
  const text = [v.title || '', v.desc || '', (v.tags || []).join(' '), (v.category || []).join(' '), v.summary || ''].join(' ')
  const topics = []
  for (const t of PRIORITY_TOPICS) if (hasAny(text, t.words)) topics.push(t.topic)
  if (hasAny(text, SHOPPING) || hasAny(text, ADS)) {
    return { tier: 'skip', topics, reason: '购物 / 广告内容' }
  }
  const isReview = hasAny(text, REVIEW)
  if (isReview) {
    // 测评本身不跳过；上面购物 / 广告信号已先判过，这里是无购物信号的测评。
    if (topics.length) return { tier: 'priority', topics: [...topics, '测评'], reason: '非商业测评，有信息价值' }
    return { tier: 'ok', topics: ['测评'], reason: '非商业测评' }
  }
  if (topics.length) return { tier: 'priority', topics, reason: '优先内容' }
  for (const t of OK_TOPICS) if (hasAny(text, t.words)) topics.push(t.topic)
  if (topics.length) return { tier: 'ok', topics, reason: '可观看内容' }
  return { tier: 'ok', topics: [], reason: '未分类，按普通内容看' }
}

/** 一轮里挑视频：优先 tier 在前，同 tier 保持推荐顺序；skip 的直接去掉。 */
export function sortForWatch(videos = []) {
  const scored = videos.map((v) => ({ v, c: classifyVideo(v) })).filter((x) => x.c.tier !== 'skip')
  const rank = { priority: 0, ok: 1 }
  scored.sort((a, b) => rank[a.c.tier] - rank[b.c.tier])
  return scored
}

/** 今天只看某主题时用：只留含该主题的，其余跳过（推荐流不能按主题点播，只能在刷到的流里挑）。 */
export function filterByTopic(videos = [], topic) {
  if (!topic) return videos.map((v) => ({ v, c: classifyVideo(v) })).filter((x) => x.c.tier !== 'skip')
  return videos
    .map((v) => ({ v, c: classifyVideo(v) }))
    .filter((x) => x.c.tier !== 'skip' && (x.c.topics.includes(topic) || (x.v.title || '').includes(topic) || (x.v.desc || '').includes(topic)))
}
