// 本地开发适配器：用 IndexedDB 模拟服务器，接口与 webdav.js 完全一致
// 这样本地开发时上传、相册流程与线上一致

const DB_NAME = 'wedding-pic-upload'
const STORE = 'files'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'name' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// 同一图片复用 objectURL，避免重复创建
const urlCache = new Map()

function getUrl(name, blob) {
  if (!urlCache.has(name)) {
    urlCache.set(name, URL.createObjectURL(blob))
  }
  return urlCache.get(name)
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {Blob} blob
 * @param {string} name
 * @param {(p:number)=>void} onProgress
 * @param {{uploader?:string}} meta
 * @returns {Promise<{url:string}>}
 */
export async function upload(blob, name, onProgress, meta) {
  onProgress && onProgress(0.15)
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      name,
      blob,
      time: Date.now(),
      by: (meta && meta.uploader) || '',
      likes: 0,
      comments: [],
      order: null
    })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  await delay(350) // 模拟网络耗时，便于观察进度效果
  onProgress && onProgress(0.8)
  await delay(150)
  onProgress && onProgress(1)
  return { url: getUrl(name, blob) }
}

/** 删除照片 */
export async function remove(name) {
  const db = await openDB()
  urlCache.delete(name)
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(name)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * @returns {Promise<Array<{name:string,url:string,time:number,size:number}>>}
 */
export async function list() {
  const db = await openDB()
  const rows = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return rows
    .map((r) => ({
      name: r.name,
      url: getUrl(r.name, r.blob),
      time: r.time,
      size: r.blob.size,
      by: r.by || '',
      likes: r.likes || 0,
      comments: r.comments || [],
      order: r.order != null ? r.order : null
    }))
    .sort((a, b) => sortKey(a) - sortKey(b))
}

// 排序权重：自定义 order 优先，否则按时间倒序（新照片在前）
function sortKey(p) {
  return p.order != null ? p.order : 1e15 - p.time
}

/** 互动接口：点赞 / 评论 / 排序（与 webdav.js 对齐） */
export async function metaAction(name, payload) {
  const db = await openDB()

  // 保存顺序：按序点选的排最前，其余保持原相对顺序
  if (!name && payload.action === 'order') {
    const rows = await getAll(db)
    const pos = {}
    payload.names.forEach((n, i) => {
      if (!(n in pos)) pos[n] = i
    })
    const picked = rows.filter((r) => r.name in pos)
    const rest = rows.filter((r) => !(r.name in pos)).sort((a, b) => sortKey(a) - sortKey(b))
    picked.forEach((r) => (r.order = pos[r.name]))
    rest.forEach((r, i) => (r.order = picked.length + i))
    await putRows(db, picked.concat(rest))
    return { ok: true }
  }

  const row = (await getAll(db)).find((r) => r.name === name)
  if (!row) throw new Error('照片不存在')
  if (payload.action === 'like') {
    row.likes = (row.likes || 0) + 1
  } else if (payload.action === 'comment') {
    row.comments = row.comments || []
    row.comments.push({ by: payload.by, text: payload.text, time: Date.now() })
  } else {
    throw new Error('unknown action')
  }
  await putRows(db, [row])
  return {
    ok: true,
    entry: { name: row.name, likes: row.likes || 0, comments: row.comments || [], order: row.order != null ? row.order : null }
  }
}

/** 保存新人自定义顺序 */
export async function saveOrder(names) {
  return metaAction('', { action: 'order', names })
}

function getAll(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function putRows(db, rows) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    rows.forEach((r) => tx.objectStore(STORE).put(r))
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
