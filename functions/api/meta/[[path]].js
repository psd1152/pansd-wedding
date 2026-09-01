// Cloudflare Pages Function：照片互动接口（点赞 / 评论 / 排序）
// 路由：/api/meta/*
//   POST /api/meta/{name}  body: {"action":"like"}
//                          body: {"action":"comment","by":"姓名","text":"内容"}
//                          返回更新后的该照片条目
//   POST /api/meta/        body: {"action":"order","names":["a.jpg","b.jpg",...]}
//                          新人按序点选的照片排到最前，其余保持原相对顺序
// 数据全部写在索引键 __index__ 中（与上传接口共用），无额外成本

const INDEX_KEY = '__index__'
const MAX_COMMENTS = 50

// 与上传接口一致的排序权重
function sortKey(e) {
  return e.order != null ? e.order : 1e15 - e.time
}

async function readIndex(kv) {
  try {
    return (await kv.get(INDEX_KEY, 'json')) || []
  } catch (e) {
    return []
  }
}

function entryToJson(e) {
  return {
    name: e.name,
    likes: e.likes || 0,
    comments: e.comments || [],
    order: e.order != null ? e.order : null
  }
}

export async function onRequest(context) {
  try {
    return await handle(context)
  } catch (e) {
    return new Response('服务器异常: ' + e.message, { status: 500 })
  }
}

async function handle(context) {
  const { request, params, env } = context
  const kv = env.PHOTOS
  if (!kv || typeof kv.put !== 'function') {
    return new Response('KV 未绑定（变量名 PHOTOS）', { status: 500 })
  }
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const name = (params.path || []).join('/').replace(/^\/+/, '')
  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response('bad json', { status: 400 })
  }

  const index = await readIndex(kv)

  // 保存排序：点选的照片排到最前（0,1,2...），其余保持原相对顺序接在后面
  if (!name && body.action === 'order' && Array.isArray(body.names)) {
    const pos = {}
    body.names.forEach((n, i) => {
      if (typeof n === 'string' && !(n in pos)) pos[n] = i
    })
    const picked = index.filter((e) => e.name in pos)
    const rest = index
      .filter((e) => !(e.name in pos))
      .sort((a, b) => sortKey(a) - sortKey(b))
    picked.forEach((e) => (e.order = pos[e.name]))
    rest.forEach((e, i) => (e.order = picked.length + i))
    await kv.put(INDEX_KEY, JSON.stringify(index))
    return json({ ok: true })
  }

  // 点赞 / 评论：针对单张照片
  const entry = index.find((e) => e.name === name)
  if (!entry) return new Response('not found', { status: 404 })

  if (body.action === 'like') {
    entry.likes = Math.min((entry.likes || 0) + 1, 9999)
  } else if (body.action === 'comment') {
    const by = String(body.by || '').trim().slice(0, 20)
    const text = String(body.text || '').trim().slice(0, 200)
    if (!by || !text) return new Response('姓名和评论内容不能为空', { status: 400 })
    entry.comments = entry.comments || []
    entry.comments.push({ by, text, time: Date.now() })
    if (entry.comments.length > MAX_COMMENTS) entry.comments = entry.comments.slice(-MAX_COMMENTS)
  } else {
    return new Response('unknown action', { status: 400 })
  }

  await kv.put(INDEX_KEY, JSON.stringify(index))
  return json({ ok: true, entry: entryToJson(entry) })
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}
