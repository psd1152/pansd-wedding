// WebDAV 适配器：上传（PUT）+ 列表（JSON）
// 支持两种服务端：
// - nginx WebDAV：BASE 默认 /uploads/（npm run build）
// - Cloudflare Pages + R2：BASE 设为 /api/uploads/（npm run build:cf）

const BASE = import.meta.env.VITE_UPLOAD_BASE || '/uploads/'

const IMG_REG = /\.(jpe?g|png|webp|gif|bmp)$/i

/**
 * 上传文件
 * @param {Blob} blob 已压缩的图片数据
 * @param {string} name 文件名
 * @param {(p:number)=>void} onProgress 进度回调 0~1
 * @returns {Promise<{url:string}>}
 */
export function upload(blob, name, onProgress) {
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
    xhr.send(blob)
  })
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
      size: i.size
    }))
    .sort((a, b) => b.time - a.time)
}
