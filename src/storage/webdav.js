// WebDAV 适配器：上传（PUT）+ 列表（JSON）
// 支持两种服务端：
// - nginx WebDAV：BASE 默认 /uploads/（npm run build）
// - Cloudflare Pages + R2：BASE 设为 /api/uploads/（npm run build:cf）

const BASE = import.meta.env.VITE_UPLOAD_BASE || '/uploads/'
// 互动接口（点赞/评论/排序）：Cloudflare 与本地模拟均提供 /api/meta/；
// 纯 nginx 部署无此接口，操作时会提示失败，不影响上传与浏览

const IMG_REG = /\.(jpe?g|png|webp|gif|bmp)$/i
const META_BASE = import.meta.env.VITE_META_BASE || '/api/meta/'

/**
 * 上传文件
 * @param {Blob} blob 已压缩的图片数据
 * @param {string} name 文件名
 * @param {(p:number)=>void} onProgress 进度回调 0~1
 * @param {{uploader?:string}} meta 附加信息（上传人姓名，仅 CF 接口会保存）
 * @returns {Promise<{url:string}>}
 */
export function upload(blob, name, onProgress, meta) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', BASE + name)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress && onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      // nginx dav PUT 成功返回 201（新建）或 204（覆盖）
      if (xhr.status === 201 || xhr.status === 204) {
        resolve({ url: BASE + name })
      } else {
        reject(new Error('服务器返回 ' + xhr.status))
      }
    }
    xhr.onerror = () => reject(new Error('网络异常，请检查网络后重试'))
    xhr.ontimeout = () => reject(new Error('上传超时，请重试'))
    xhr.timeout = 120000
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    if (meta && meta.uploader) {
      xhr.setRequestHeader('X-Uploader', encodeURIComponent(meta.uploader))
    }
    xhr.send(blob)
  })
}

/**
 * 删除照片（新人相册）：CF 接口支持；nginx 需开 dav_methods DELETE
 * @returns {Promise<void>}
 */
export async function remove(name) {
  const res = await fetch(BASE + name, { method: 'DELETE' })
  if (res.status !== 204 && res.status !== 200) {
    throw new Error('删除失败（' + res.status + '）')
  }
}

/**
 * 解析 autoindex 的 mtime，兼容两种格式：
 * - nginx 生产：RFC1123 GMT，如 "Tue, 01 Sep 2026 01:53:48 GMT"
 * - 本地开发 mock："2026-09-01 09:38:58"
 */
function parseMtime(mtime) {
  if (!mtime) return 0
  let t = new Date(mtime).getTime()
  if (isNaN(t)) t = new Date(mtime.replace(' ', 'T')).getTime()
  return isNaN(t) ? 0 : t
}

/**
 * 拉取全部图片列表（按上传时间倒序）
 * @returns {Promise<Array<{name:string,url:string,time:number,size:number}>>}
 */
export async function list() {
  const res = await fetch(BASE, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('读取照片列表失败（' + res.status + '）')
  const items = await res.json()
  return items
    .filter((i) => i.type === 'file' && IMG_REG.test(i.name))
    .map((i) => ({
      name: i.name,
      url: BASE + i.name,
      time: parseMtime(i.mtime),
      size: i.size,
      by: i.by || '',
      likes: i.likes || 0,
      comments: i.comments || [],
      order: i.order != null ? i.order : null
    }))
    .sort((a, b) => sortKey(a) - sortKey(b))
}

// 排序权重：自定义 order 优先，否则按时间倒序（新照片在前）
function sortKey(p) {
  return p.order != null ? p.order : 1e15 - p.time
}

/**
 * 互动接口：点赞 / 评论 / 排序，返回更新后的条目（排序时无）
 * @param {string} name 文件名（排序时传 ''）
 * @param {{action:string, [k:string]:any}} payload
 */
export async function metaAction(name, payload) {
  const res = await fetch(META_BASE + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    let msg = '操作失败（' + res.status + '）'
    try {
      msg = (await res.text()) || msg
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

/** 保存新人自定义顺序：按序点选的文件名数组 */
export async function saveOrder(names) {
  return metaAction('', { action: 'order', names })
}
