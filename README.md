# 婚礼照片收集站

纯前端（Vue 3 + Vite）实现的婚礼现场照片收集网站，无后端代码：

- 宾客扫码进入上传页，填写姓名后拍照/选图，自动压缩并上传；
- 上传页带喜庆飘落动画（玫瑰/爱心），每张照片记录上传人姓名；
- **宾客相册**（`#/gallery`）：免密码，所有宾客可查看大家上传的照片；
- **新人相册**（`#/owner`，密码保护）：查看全部照片，支持**下载与删除**；
- 新人相册内置现场二维码，可截图打印放在迎宾处。

## 目录结构

```
├── index.html
├── vite.config.js
├── nginx/wedding.conf      # 服务器 nginx 配置（WebDAV + autoindex）
└── src/
    ├── config.js           # 新人名/婚期/密码/站点地址（部署前必改）
    ├── router/             # Hash 路由：/ 上传页、/gallery 宾客相册、/owner 新人相册
    ├── storage/            # 存储适配层：上传/列表/删除，支持携带上传人姓名
    ├── utils/              # 图片压缩、本机上传记录
    └── views/              # Upload.vue（宾客）、Gallery.vue + 宾客/新人两个入口
```

## 本地开发

```bash
npm install
npm run dev
```

本地开发时，`npm run dev` 内置了一个模拟 nginx 的服务：上传的照片会**真实保存到项目根的 `uploads/` 目录**（不是浏览器存储），因此：

- 换任何浏览器、清缓存都不影响，照片始终在 `uploads/` 文件夹里；
- 手机和电脑连同一 WiFi，访问 `http://电脑局域网IP:5173` 也能上传、查看，提前模拟婚礼现场；
- 上传、列表的代码路径与线上 nginx 完全一致，部署零改动。

如需浏览器内存储（不落盘）的特殊场景：设环境变量 `VITE_UPLOAD_MODE=local` 后启动。

## 部署前配置

编辑 `src/config.js`：

| 字段 | 说明 |
| --- | --- |
| `groom` / `bride` | 新郎、新娘姓名 |
| `date` | 婚期展示文案 |
| `slogan` | 上传页欢迎语 |
| `ownerPassword` | 相册页密码（默认 `0521`，请务必修改） |
| `siteUrl` | 二维码指向的地址；留空则用当前访问地址 |

## 打包与部署

```bash
npm run build   # 产物在 dist/
```

服务器上（以 Ubuntu 为例）：

```bash
# 1. 上传 dist 到服务器
scp -r dist/* user@server:/var/www/wedding/dist/

# 2. 创建照片目录并授权给 nginx 运行用户（WebDAV 写入的前提）
mkdir -p /var/www/wedding/dist/uploads
chown -R www-data:www-data /var/www/wedding/dist/uploads

# 3. 应用 nginx 配置（参考本项目 nginx/wedding.conf，改好域名/路径）
nginx -t && nginx -s reload
```

要点：

- `uploads` 目录必须属于 nginx 运行用户（Ubuntu 为 `www-data`，CentOS 通常为 `nginx`），否则 PUT 会返回 403；
- 标准发行版 / Docker 官方镜像的 nginx 均自带 `ngx_http_dav_module`，无需重新编译；
- 站点使用 Hash 路由，nginx 无需任何 rewrite 规则；
- 若启用 HTTPS（强烈建议，婚礼现场多为公共网络），上传同样自动走加密通道，无需额外改动。

## 使用流程

1. 部署完成后，新人用手机/电脑打开 `站点地址/#/gallery`，输入密码进入相册页；
2. 相册页顶部是现场二维码，截图打印（二维码默认指向站点首页，即上传页）；
3. 婚礼当天宾客扫码上传；新人随时在相册页点"刷新"查看最新照片；
4. 所有照片保存在服务器 `dist/uploads/` 目录，婚礼后可整体打包留档。

## 部署方式二：Cloudflare 全免费（推荐婚礼使用）

无需自己的服务器，用 Cloudflare 免费三件套：

| 现有组件 | Cloudflare 免费替代 | 免费额度 |
| --- | --- | --- |
| 静态托管 | Pages | 无限请求 |
| nginx WebDAV 接收上传 | Pages Functions（`functions/` 目录） | 10万请求/天 |
| `uploads/` 目录 | KV 键值存储（**无需绑卡**） | 1GB 存储、1千次写/天 |

### 部署步骤（GitHub + Pages，无需本地装新工具）

1. 把本项目推到 GitHub 仓库（公开或私有均可）；
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create application → Pages → Connect to Git，选刚才的仓库；
3. 构建设置：
   - Framework preset：选 `None` 或 `Vite`
   - Build command：`npm run build:cf`
   - Build output directory：`dist`
   - 注意 `functions/` 目录会随仓库一起被自动识别部署；
4. 创建 KV 命名空间：左侧菜单 Workers & Pages → KV → Create a namespace，名字随意（如 `wedding-photos`），**不需要绑卡**；
5. 给 Pages 项目绑定 KV：项目 → Settings → Functions → KV namespace bindings → Add binding，**变量名填 `PHOTOS`**，选刚创建的命名空间；
6. 重新触发一次部署（Deployments → Retry deployment），完成后访问分配的 `xxx.pages.dev` 域名。

验证：打开 `站点地址/#/gallery` 输密码进相册，上传几张照片后刷新，能看到即全部打通。
婚礼现场二维码：相册页内置的二维码自动指向当前站点地址，截图打印即可。

### 备注

- `build:cf` 会把上传接口指向 `/api/uploads/`（Pages Function），普通 `build` 仍指向 `/uploads/`（nginx），两套部署互不影响；
- 如习惯用命令行，也可用 `wrangler pages deploy`（需 Node ≥ 16.13），并在 Pages 项目设置里同样绑定 KV；
- 存储选型说明：R2 需要绑定信用卡，改用 KV 后完全免费；婚礼几百张压缩照片约 100MB，远小于 KV 免费 1GB；每天 1000 次写入额度也够用（每张照片占 2 次写入：图片本身 + 索引）；
- 婚礼后可在 KV 面板逐张下载留档，或提前联系摄影师备份。

## 常见问题


- **上传报 413**：`client_max_body_size` 太小，调大后重载 nginx；
- **上传报 403**：`uploads` 目录权限不对，按上面第 2 步授权；
- **相册页看不到照片**：确认 `location /uploads/` 开启了 `autoindex_format json`；
- **想限制上传权限**：见 `nginx/wedding.conf` 末尾的 Basic Auth 可选方案。
