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
  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }
  return {
    name: 'dev-upload-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url.split('?')[0])
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
            res.statusCode = 201 // 与 nginx dav 一致
            res.end()
          })
          ws.on('error', () => {
            res.statusCode = 500
            res.end()
          })
          return
        }

        // DELETE /uploads/{name} 删除照片（连同侧车文件）
        if (req.method === 'DELETE') {
          const name = path.basename(url.slice('/uploads/'.length))
          const file = path.join(dir, name)
          if (fs.existsSync(file)) fs.unlinkSync(file)
          const metaFile = file + '.meta.json'
          if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile)
          res.statusCode = 204
          return res.end()
        }

        // GET /uploads/ 返回 JSON 列表（模拟 nginx autoindex_format json，额外带 by 字段）
        if (req.method === 'GET' && (url === '/uploads/' || url === '/uploads')) {
          fs.mkdirSync(dir, { recursive: true })
          const items = fs
            .readdirSync(dir)
            .filter((n) => !n.endsWith('.meta.json') && fs.statSync(path.join(dir, n)).isFile())
            .map((n) => {
              const st = fs.statSync(path.join(dir, n))
              let by = ''
              try {
                by = JSON.parse(fs.readFileSync(path.join(dir, n + '.meta.json'), 'utf8')).by || ''
              } catch {}
              return { name: n, mtime: fmt(st.mtime), size: st.size, by, type: 'file' }
            })
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          return res.end(JSON.stringify(items))
        }

        // GET /uploads/{name} 交给 vite 静态文件服务返回图片本身（侧车文件不允许访问）
        if (url.endsWith('.meta.json')) {
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
