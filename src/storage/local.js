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
 * @returns {Promise<{url:string}>}
 */
export async function upload(blob, name, onProgress) {
  onProgress && onProgress(0.15)
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ name, blob, time: Date.now() })
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  await delay(350) // 模拟网络耗时，便于观察进度效果
  onProgress && onProgress(0.8)
  await delay(150)
  onProgress && onProgress(1)
  return { url: getUrl(name, blob) }
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
      size: r.blob.size
    }))
    .sort((a, b) => b.time - a.time)
}
