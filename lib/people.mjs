// PLUS: 白名单 / 黑名单（方案 §3）。名单里的人是抖音里的人，
// 以 secUid 为准（昵称会改，secUid 不会）。名单存在模块自己的数据文件里，
// 重启、模块重载都不丢。黑名单优先级最高：同一个人同时在白名单和黑名单里，
// 分享和 @ 一律拒绝。
// 文件：<dataDir>/douyin-plus-people.json
//   { version: 1, share: [person], at: [person], block: [person] }
//   person = { secUid, uid, nickname, douyinId, addedAt, addedBy }

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const KINDS = ['share', 'at', 'block']
const emptyPeople = () => ({ version: 1, share: [], at: [], block: [] })

export function peopleFile(dataDir) {
  return join(dataDir, 'douyin-plus-people.json')
}

/** 读名单文件；文件不存在 / 坏了返回空名单（不抛错，面板照常显示）。 */
export function loadPeople(dataDir) {
  const file = peopleFile(dataDir)
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    if (!raw || typeof raw !== 'object') return emptyPeople()
    const clean = (list) => (Array.isArray(list) ? list.filter((p) => p && typeof p.secUid === 'string' && p.secUid) : [])
    return { version: 1, share: clean(raw.share), at: clean(raw.at), block: clean(raw.block) }
  } catch {
    return emptyPeople()
  }
}

/** 写名单文件：先写临时文件再改名，避免重启 / 断电写一半。 */
export function savePeople(dataDir, people) {
  const file = peopleFile(dataDir)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify({ version: 1, share: people.share || [], at: people.at || [], block: people.block || [] }, null, 2))
  renameSync(tmp, file)
  return people
}

export function isBlocked(people, secUid) {
  return (people.block || []).some((p) => p.secUid === secUid)
}

/** 能分享给这个人吗：分享白名单里有，且不在黑名单里。 */
export function canShare(people, secUid) {
  if (!secUid || isBlocked(people, secUid)) return false
  return (people.share || []).some((p) => p.secUid === secUid)
}

/** 能在评论区 @ 这个人吗：@ 白名单里有，且不在黑名单里。 */
export function canAt(people, secUid) {
  if (!secUid || isBlocked(people, secUid)) return false
  return (people.at || []).some((p) => p.secUid === secUid)
}

/** 加一个人进某名单（已存在则更新昵称 / 抖音号，不重复）。 */
export function addPerson(people, kind, person) {
  if (!KINDS.includes(kind)) throw new Error('名单类型不对：share / at / block')
  if (!person?.secUid) throw new Error('这个人没有 secUid，认不出来')
  const next = { ...emptyPeople(), ...people }
  next[kind] = next[kind].filter((p) => p.secUid !== person.secUid)
  next[kind].push({
    secUid: person.secUid,
    uid: person.uid || '',
    nickname: person.nickname || '',
    douyinId: person.douyinId || '',
    addedAt: Date.now(),
    addedBy: person.addedBy || 'owner',
  })
  return next
}

/** 从某名单里删一个人。 */
export function removePerson(people, kind, secUid) {
  if (!KINDS.includes(kind)) throw new Error('名单类型不对：share / at / block')
  const next = { ...emptyPeople(), ...people }
  next[kind] = next[kind].filter((p) => p.secUid !== secUid)
  return next
}

/** 给面板 / QQ 读的摘要：每类几个人、分别是谁。 */
export function peopleSummary(people) {
  const names = (list) => (list || []).map((p) => p.nickname || p.douyinId || p.secUid).join('、') || '（空）'
  return {
    share: (people.share || []).length,
    at: (people.at || []).length,
    block: (people.block || []).length,
    shareNames: names(people.share),
    atNames: names(people.at),
    blockNames: names(people.block),
  }
}
