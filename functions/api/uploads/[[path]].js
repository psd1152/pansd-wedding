// Cloudflare Pages Function：上传接口，存储用 KV（免费、无需绑卡）
// 路由：/api/uploads/*
//   PUT  /api/uploads/{name}  接收图片，写入 KV（绑定变量名 PHOTOS）
//   GET  /api/uploads/        返回图片列表 JSON（格式与 nginx autoindex 一致）
//   GET  /api/uploads/{name}  读取图片
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
  const { request, params, env } = context
  const kv = env.PHOTOS
  if (!kv) {
    return new Response('KV 未绑定（变量名 PHOTOS）', { status: 500 })
  }

  // catch-all 参数：列表请求时为 '' 或 undefined
  const name = (params.path || '').replace(/^\/+/, '')

  // 上传
  if (request.method === 'PUT') {
    if (!name || name.includes('..') || name.includes('/')) {
      return new Response('bad file name', { status: 400 })
    }
    const body = await request.arrayBuffer()
    if (body.byteLength === 0) {
      return new Response('empty file', { status: 400 })
    }
    const meta = {
      time: Date.now(),
      size: body.byteLength,
      contentType: request.headers.get('Content-Type') || 'image/jpeg'
    }
    await kv.put(name, body, { metadata: meta })
    // 更新索引（婚礼并发量低，读-改-写足够）
    const index = await readIndex(kv)
    index.push({ name, time: meta.time, size: meta.size })
    await kv.put(INDEX_KEY, JSON.stringify(index))
    return new Response(null, { status: 201 })
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
