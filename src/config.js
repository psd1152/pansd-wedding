// 婚礼信息配置：部署前请按需修改
export default {
  // 新郎 & 新娘姓名（展示在页面顶部）
  groom: '潘圣东',
  bride: '姜文秀',
  // 婚期
  date: '2026.10.03',
  // 欢迎语
  slogan: '感谢你来见证我们的幸福，请留下你眼中的美好瞬间',
  // 主人相册页密码（纯前端校验，防误入）
  ownerPassword: '0521',
  // 现场二维码指向的站点地址；不配置则默认使用当前访问地址
  siteUrl: import.meta.env.VITE_SITE_URL || ''
}
