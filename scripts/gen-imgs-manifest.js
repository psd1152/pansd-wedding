// 轮播图资源管线（构建时自动执行）：
// 1. 扫描 src/imgs/ 下的照片（原图，任意数量，放这里即可）
// 2. 用 jimp 压缩为网页版（最长边 1600、JPEG 质量 82），输出到 public/imgs/
// 3. 生成 public/imgs/manifest.json 清单，前端轮播动态加载
// 用法：照片丢进 src/imgs/，重新构建即自动生效，无需改任何代码
const fs = require('fs')
const path = require('path')
const Jimp = require('jimp')

const SRC = path.resolve(__dirname, '../src/imgs')
const OUT = path.resolve(__dirname, '../public/imgs')
const MAX_SIDE = 1600
const QUALITY = 82
const IMG_EXT = /\.(jpe?g|png|webp)$/i // gif/bmp 不参与轮播压缩

async function main() {
  if (!fs.existsSync(SRC)) {
    console.log('src/imgs 不存在，跳过轮播图生成')
    return
  }
  fs.mkdirSync(OUT, { recursive: true })

  const names = fs
    .readdirSync(SRC)
    .filter((n) => fs.statSync(path.join(SRC, n)).isFile() && IMG_EXT.test(n))

  let compressed = 0
  let reused = 0
  for (const n of names) {
    const srcFile = path.join(SRC, n)
    const outFile = path.join(OUT, n)
    const srcMtime = fs.statSync(srcFile).mtimeMs
    // 目标已存在且不比源旧则跳过，避免每次构建全量重压
    if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= srcMtime) {
      reused++
      continue
    }
    try {
      const img = await Jimp.read(srcFile)
      // 等比缩放：最长边不超过 MAX_SIDE，不拉伸变形
      const scale = Math.min(1, MAX_SIDE / Math.max(img.bitmap.width, img.bitmap.height))
      if (scale < 1) {
        img.resize(
          Math.round(img.bitmap.width * scale),
          Math.round(img.bitmap.height * scale),
          Jimp.RESIZE_BICUBIC
        )
      }
      await img.quality(QUALITY).writeAsync(outFile)
      compressed++
      console.log('压缩: ' + n)
    } catch (e) {
      console.log('跳过 ' + n + '：' + e.message)
    }
  }

  const list = fs
    .readdirSync(OUT)
    .filter((n) => n !== 'manifest.json' && IMG_EXT.test(n))
    .sort()
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(list))
  console.log('轮播清单：' + list.length + ' 张（新压缩 ' + compressed + '，复用 ' + reused + '）')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
