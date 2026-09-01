const { defineConfig } = require('vite')
const vue = require('@vitejs/plugin-vue')

const fs = require('fs')
const path = require('path')

/**
 * 本地开发模拟 nginx WebDAV：
 * 上传的照片真实保存到项目根的 uploads/ 目录（而不是浏览器存储），
 * 换浏览器、换手机（同一局域网）都能看到，行为与线上 nginx 一致。
 */
function devUploadMock() {
  const dir = path.resolve(__dirname, 'uploads')
  const metaFile = path.join(dir, '__meta.json') // 点赞/评论/排序数据，与 CF 索引对齐
  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  const readMeta = () => {
    try {
      return JSON.parse(fs.readFileSync(metaFile, 'utf8'))
    } catch {
      return {}
    }
  }
  const writeMeta = (m) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(metaFile, JSON.stringify(m))
  }
  // 目录中的照片条目（含 meta 数据）
  const collectEntries = () => {
    fs.mkdirSync(dir, { recursive: true })
    const metaStore = readMeta()
    return fs
      .readdirSync(dir)
      .filter((n) => n !== '__meta.json' && !n.endsWith('.meta.json') && fs.statSync(path.join(dir, n)).isFile())
      .map((n) => {
        const e = metaStore[n] || {}
        return {
          name: n,
          time: fs.statSync(path.join(dir, n)).mtimeMs,
          likes: e.likes || 0,
          comments: e.comments || [],
          order: e.order != null ? e.order : null
        }
      })
  }
  const sortKeyOf = (e) => (e.order != null ? e.order : 1e15 - e.time)
  const respondJson = (res, obj, status) => {
    res.statusCode = status || 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(obj))
  }

  return {
    name: 'dev-upload-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url.split('?')[0])

        // POST /api/meta/* 互动接口（点赞/评论/排序），与 CF 函数同语义
        if (url.startsWith('/api/meta')) {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end()
          }
          let raw = ''
          req.on('data', (c) => (raw += c))
          req.on('end', () => {
            let body
            try {
              body = JSON.parse(raw || '{}')
            } catch {
              res.statusCode = 400
              return res.end('bad json')
            }
            const mname = path.basename(url.slice('/api/meta/'.length))

            // 保存排序：点选的排最前，其余保持原相对顺序
            if (!mname && body.action === 'order' && Array.isArray(body.names)) {
              const entries = collectEntries()
              const pos = {}
              body.names.forEach((n, i) => {
                if (!(n in pos)) pos[n] = i
              })
              const picked = entries.filter((e) => e.name in pos)
              const rest = entries
                .filter((e) => !(e.name in pos))
                .sort((a, b) => sortKeyOf(a) - sortKeyOf(b))
              const metaStore = readMeta()
              picked.forEach((e) => {
                metaStore[e.name] = Object.assign(metaStore[e.name] || {}, { order: pos[e.name] })
              })
              rest.forEach((e, i) => {
                metaStore[e.name] = Object.assign(metaStore[e.name] || {}, { order: picked.length + i })
              })
              writeMeta(metaStore)
              return respondJson(res, { ok: true })
            }

            // 点赞 / 评论：针对单张照片
            if (!fs.existsSync(path.join(dir, mname))) {
              res.statusCode = 404
              return res.end('not found')
            }
            const metaStore = readMeta()
            const e = metaStore[mname] || { likes: 0, comments: [] }
            if (body.action === 'like') {
              e.likes = Math.min((e.likes || 0) + 1, 9999)
            } else if (body.action === 'comment') {
              const by = String(body.by || '').trim().slice(0, 20)
              const text = String(body.text || '').trim().slice(0, 200)
              if (!by || !text) {
                res.statusCode = 400
                return res.end('姓名和评论内容不能为空')
              }
              e.comments = (e.comments || []).concat([{ by, text, time: Date.now() }]).slice(-50)
            } else {
              res.statusCode = 400
              return res.end('unknown action')
            }
            metaStore[mname] = e
            writeMeta(metaStore)
            return respondJson(res, {
              ok: true,
              entry: { name: mname, likes: e.likes || 0, comments: e.comments || [], order: e.order != null ? e.order : null }
            })
          })
          return
        }

        if (!url.startsWith('/uploads')) return next()

        // PUT /uploads/{name} 接收上传，落盘到 ./uploads/
        // X-Uploader 头（URL 编码）存为同名 .meta.json 侧车文件，与 CF 接口对齐
        if (req.method === 'PUT') {
          const name = path.basename(url.slice('/uploads/'.length))
          if (!name) {
            res.statusCode = 400
            return res.end('bad file name')
          }
          fs.mkdirSync(dir, { recursive: true })
          const ws = fs.createWriteStream(path.join(dir, name))
          req.pipe(ws)
          ws.on('finish', () => {
            const by = decodeURIComponent(req.headers['x-uploader'] || '')
            if (by) {
              fs.writeFileSync(
                path.join(dir, name + '.meta.json'),
                JSON.stringify({ by })
              )
            }
            // 新照片排最前：order = 当前最小排序权重 - 1，与 CF 函数一致
            const metaStore = readMeta()
            const orders = collectEntries()
              .filter((e) => e.name !== name)
              .map(sortKeyOf)
            const minOrder = orders.length ? Math.min.apply(null, orders) : 0
            metaStore[name] = { likes: 0, comments: [], order: minOrder - 1 }
            writeMeta(metaStore)
            res.statusCode = 201 // 与 nginx dav 一致
            res.end()
          })
          ws.on('error', () => {
            res.statusCode = 500
            res.end()
          })
          return
        }

        // DELETE /uploads/{name} 删除照片（连同侧车文件与 meta 数据）
        if (req.method === 'DELETE') {
          const name = path.basename(url.slice('/uploads/'.length))
          const file = path.join(dir, name)
          if (fs.existsSync(file)) fs.unlinkSync(file)
          const metaFile2 = file + '.meta.json'
          if (fs.existsSync(metaFile2)) fs.unlinkSync(metaFile2)
          const metaStore = readMeta()
          if (metaStore[name]) {
            delete metaStore[name]
            writeMeta(metaStore)
          }
          res.statusCode = 204
          return res.end()
        }

        // GET /uploads/ 返回 JSON 列表（模拟 nginx autoindex，额外带 by/likes/comments/order）
        if (req.method === 'GET' && (url === '/uploads/' || url === '/uploads')) {
          const items = collectEntries().map((e) => {
            let by = ''
            try {
              by = JSON.parse(fs.readFileSync(path.join(dir, e.name + '.meta.json'), 'utf8')).by || ''
            } catch {}
            return {
              name: e.name,
              mtime: fmt(new Date(e.time)),
              size: fs.statSync(path.join(dir, e.name)).size,
              by,
              likes: e.likes,
              comments: e.comments,
              order: e.order,
              type: 'file'
            }
          })
          return respondJson(res, items)
        }

        // GET /uploads/{name} 交给 vite 静态文件服务返回图片本身（内部文件不允许访问）
        if (url.endsWith('.meta.json') || url.endsWith('__meta.json')) {
          res.statusCode = 404
          return res.end()
        }
        next()
      })
    }
  }
}

// base 用相对路径，打包产物可放在任意子路径部署
module.exports = defineConfig({
  plugins: [vue(), devUploadMock()],
  base: './',
  server: {
    port: 5173,
    host: true
  }
})
