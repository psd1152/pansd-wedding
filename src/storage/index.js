// 存储适配层：统一对外暴露 upload / list
// - 默认（开发/生产）都走 WebDAV：
//   开发时由 vite 内置的模拟服务把照片保存到项目 uploads/ 目录（真实文件），
//   生产时由服务器 nginx 接收。
// - 如需浏览器内存储（无服务环境），设 VITE_UPLOAD_MODE=local

import * as dav from './webdav'
import * as local from './local'

const mode = import.meta.env.VITE_UPLOAD_MODE || 'dav'

export const storage = mode === 'dav' ? dav : local
