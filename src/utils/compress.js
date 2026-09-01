// Canvas 图片压缩：限制最长边、输出 JPEG，兼顾清晰度与上传速度

/**
 * @param {File|Blob} file 原始图片
 * @param {{maxEdge?:number, quality?:number}} opts
 * @returns {Promise<Blob>} 压缩后的 JPEG
 */
export function compressImage(file, opts = {}) {
  const { maxEdge = 1600, quality = 0.82 } = opts
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
          'image/jpeg',
          quality
        )
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败，请换一张试试'))
    }
    img.src = url
  })
}

/** 生成唯一文件名：时间戳 + 随机串 */
export function genFileName() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg'
}
