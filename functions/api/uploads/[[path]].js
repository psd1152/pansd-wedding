// Cloudflare Pages Function：上传接口，存储用 KV（免费、无需绑卡）
// 路由：/api/uploads/*
//   PUT  /api/uploads/{name}  接收图片，写入 KV（绑定变量名 PHOTOS）
//                             请求头 X-Uploader 携带上传人姓名（URL 编码）
//   GET  /api/uploads/        返回图片列表 JSON（含上传人，格式与 nginx autoindex 对齐）
//   GET  /api/uploads/{name}  读取图片
//   DELETE /api/uploads/{name} 删除照片（新人相册用）
// 前端无需任何改动（打包时 BASE 指向 /api/uploads/）
//
// 说明：KV 的 list() 最长有 60 秒延迟，为保证主人刷新能立即看到新照片，
// 额外维护一个索引键 __index__（KV 读写是强一致的）。

const IMG_REG = /\.(jpe?g|png|webp|gif|bmp)$/i
const INDEX_KEY = '__index__'

async function readIndex(kv) {
  try {
    return (await kv.get(INDEX_KEY, 'json')) || []
  } catch (e) {
    return []
  }
}

export async function onRequest(context) {
  try {
    return await handle(context)
  } catch (e) {
    // 把真实异常回显给前端，方便定位（婚礼站点可接受）
    return new Response('服务器异常: ' + e.message, { status: 500 })
  }
}

async function handle(context) {
  const { request, params, env } = context
  const kv = env.PHOTOS
  // 校验绑定类型：必须是 KV 命名空间，而不是同名纯文本变量/密钥
  if (!kv || typeof kv.put !== 'function') {
    return new Response(
      'PHOTOS 绑定无效：请到项目 Settings → Functions → KV namespace bindings 里' +
      '绑定 KV 命名空间（变量名 PHOTOS），而不是加在 Environment variables 里',
      { status: 500 }
    )
  }

  // catch-all 参数：文件名是数组形式 ['xxx.jpg']，列表请求时为空数组 []
  const name = (params.path || []).join('/').replace(/^\/+/, '')

  // 上传
  if (request.method === 'PUT') {
    if (!name || name.includes('..') || name.includes('/')) {
      return new Response('bad file name', { status: 400 })
    }
    const body = await request.arrayBuffer()
    if (body.byteLength === 0) {
      return new Response('empty file', { status: 400 })
    }
    // 上传人姓名由前端放在 X-Uploader 头（URL 编码，兼容中文）
    const by = decodeURIComponent(request.headers.get('X-Uploader') || '').slice(0, 20)
    const meta = {
      time: Date.now(),
      size: body.byteLength,
      by: by || '',
      contentType: request.headers.get('Content-Type') || 'image/jpeg'
    }
    await kv.put(name, body, { metadata: meta })
    // 更新索引（婚礼并发量低，读-改-写足够）
    const index = await readIndex(kv)
    index.push({ name, time: meta.time, size: meta.size, by: meta.by })
    await kv.put(INDEX_KEY, JSON.stringify(index))
    return new Response(null, { status: 201 })
  }

  // 删除（新人相册）
  if (request.method === 'DELETE' && name) {
    await kv.delete(name)
    const index = await readIndex(kv)
    await kv.put(INDEX_KEY, JSON.stringify(index.filter((i) => i.name !== name)))
    return new Response(null, { status: 204 })
  }

  // 列表（与 nginx autoindex_format json 字段保持一致）
  if (request.method === 'GET' && !name) {
    const index = await readIndex(kv)
    const items = index
      .filter((i) => IMG_REG.test(i.name))
      .map((i) => ({
        name: i.name,
        mtime: new Date(i.time).toISOString(),
        size: i.size,
        by: i.by || '',
        type: 'file'
      }))
    return new Response(JSON.stringify(items), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    })
  }

  // 读图
  if (request.method === 'GET' && name) {
    const obj = await kv.getWithMetadata(name, 'arrayBuffer')
    if (!obj || obj.value === null) {
      return new Response('not found', { status: 404 })
    }
    const contentType = (obj.metadata && obj.metadata.contentType) || 'image/jpeg'
    return new Response(obj.value, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  }

  return new Response('method not allowed', { status: 405 })
}
