<template>
  <div class="page" :class="{ selecting: owner && selecting }">
    <!-- 新人入口：密码门槛 -->
    <template v-if="owner && !authed">
      <div class="lock-wrap">
        <div class="card lock-card">
          <div class="lock-icon serif">囍</div>
          <h2 class="lock-title">新人相册</h2>
          <p class="lock-tip">请输入密码管理婚礼全部照片</p>
          <input
            v-model="pwd"
            class="lock-input"
            type="password"
            placeholder="密码"
            @keyup.enter="doLogin"
          />
          <p v-if="lockError" class="lock-error">密码不正确</p>
          <button class="btn primary" @click="doLogin">进入相册</button>
          <router-link to="/" class="back">返回上传页</router-link>
        </div>
      </div>
    </template>

    <!-- 相册主体 -->
    <template v-else>
      <header class="g-header">
        <div>
          <h1 class="g-title serif">{{ config.groom }} &amp; {{ config.bride }} {{ owner ? '的新人相册' : '的婚礼照片墙' }}</h1>
          <div class="g-sub">共 {{ photos.length }} 张照片</div>
        </div>
        <div class="g-actions">
          <button class="refresh" :disabled="loading" @click="load">
            {{ loading ? '加载中' : '刷新' }}
          </button>
          <button v-if="owner" class="refresh" @click="toggleSelecting">
            {{ selecting ? '退出管理' : '管理' }}
          </button>
        </div>
      </header>

      <!-- 现场二维码（仅新人可见） -->
      <section v-if="owner" class="card qr-card">
        <canvas ref="qrCanvas"></canvas>
        <div class="qr-info">
          <div class="qr-title">现场二维码</div>
          <p>宾客扫码即可上传照片，可截图打印放在迎宾处。</p>
          <p class="qr-url">{{ siteUrl }}</p>
        </div>
      </section>

      <!-- 照片墙 -->
      <div v-if="loading && !photos.length" class="state">正在加载照片…</div>
      <div v-else-if="error" class="state error">
        {{ error }}
        <button class="retry" @click="load">重试</button>
      </div>
      <div v-else-if="!photos.length" class="state">还没有照片，等待宾客的第一份祝福吧</div>
      <div v-else class="wall">
        <figure
          v-for="(p, i) in photos"
          :key="p.name"
          class="wall-item"
          @click="onWallClick(p, i)"
        >
          <img :src="p.url" loading="lazy" alt="婚礼照片" />
          <span
            v-if="owner && selecting && manageMode === 'select'"
            class="check"
            :class="{ on: selected.has(p.name) }"
          >✓</span>
          <span
            v-if="owner && selecting && manageMode === 'order' && orderSeq.indexOf(p.name) >= 0"
            class="order-badge"
          >{{ orderSeq.indexOf(p.name) + 1 }}</span>
          <figcaption v-if="p.by || p.likes" class="wall-by">
            {{ p.by }}<span v-if="p.likes" class="wall-likes"> ❤{{ p.likes }}</span>
          </figcaption>
        </figure>
      </div>

      <!-- 多选操作栏（仅新人管理模式） -->
      <div v-if="owner && selecting && manageMode === 'select'" class="select-bar">
        <button class="sb-btn" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
        <span class="sb-count">已选 {{ selected.size }} 张</span>
        <button class="sb-btn" @click="startOrder">排序</button>
        <button class="sb-btn" :disabled="!selected.size" @click="downloadSelected">下载</button>
        <button class="sb-btn danger" :disabled="!selected.size" @click="deleteSelected">删除</button>
      </div>

      <!-- 排序操作栏：按想要的顺序依次点照片 -->
      <div v-else-if="owner && selecting" class="select-bar">
        <span class="sb-count sb-tip">按想要的顺序点击照片（已排 {{ orderSeq.length }} 张，再点一次可移除）</span>
        <button class="sb-btn" :disabled="!orderSeq.length || savingOrder" @click="saveOrderFn">
          {{ savingOrder ? '保存中' : '保存顺序' }}
        </button>
        <button class="sb-btn" @click="cancelOrder">取消</button>
      </div>

      <!-- 大图预览 -->
      <transition name="fade">
        <div v-if="viewer.index >= 0" class="lightbox" @click.self="viewer.index = -1">
          <div class="lb-bar">
            <span>{{ viewer.index + 1 }} / {{ photos.length }}</span>
            <span v-if="current.by" class="lb-by">来自 {{ current.by }}</span>
            <a :href="current.url" download target="_blank">下载</a>
            <span v-if="owner" class="lb-del" @click="removePhoto">删除</span>
            <span class="lb-close" @click="viewer.index = -1">关闭</span>
          </div>
          <img :src="current.url" alt="大图预览" @click="viewer.index = -1" />
          <div class="lb-nav">
            <button :disabled="viewer.index === 0" @click="viewer.index--">‹ 上一张</button>
            <button
              class="lb-like"
              :class="{ liked: hasLiked(current.name) }"
              @click="likePhoto"
            >{{ hasLiked(current.name) ? '❤ 已赞' : '♡ 点赞' }}<span v-if="current.likes"> {{ current.likes }}</span></button>
            <button :disabled="viewer.index >= photos.length - 1" @click="viewer.index++">下一张 ›</button>
          </div>

          <!-- 留言区：所有人都能看到、都能写 -->
          <div class="lb-comments">
            <div v-if="!(current.comments || []).length" class="cm-empty">还没有留言，写下第一句祝福吧</div>
            <div v-for="(c, ci) in current.comments" :key="ci" class="cm-item">
              <span class="cm-by">{{ c.by }}：</span>{{ c.text }}
            </div>
            <div class="cm-form">
              <input
                v-if="!commentBy"
                v-model.trim="commentByDraft"
                class="cm-name"
                maxlength="12"
                placeholder="您的名字"
              />
              <input
                v-model.trim="commentText"
                class="cm-text"
                maxlength="200"
                placeholder="写下祝福…"
                @keyup.enter="sendComment"
              />
              <button class="cm-send" :disabled="sendingComment" @click="sendComment">{{ sendingComment ? '…' : '发送' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import QRCode from 'qrcode'
import config from '../config'
import { storage } from '../storage'

const props = defineProps({
  owner: { type: Boolean, default: false } // 新人模式：密码门槛 + 删除权限 + 二维码
})

const AUTH_KEY = 'wedding-owner-authed'

// ---- 密码门槛（仅新人模式；宾客直接进入） ----
const authed = ref(!props.owner || sessionStorage.getItem(AUTH_KEY) === '1')
const pwd = ref('')
const lockError = ref(false)

function doLogin() {
  if (pwd.value === config.ownerPassword) {
    sessionStorage.setItem(AUTH_KEY, '1')
    authed.value = true
  } else {
    lockError.value = true
  }
}

// ---- 照片墙 ----
const photos = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    photos.value = await storage.list()
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

watch(authed, (v) => v && load(), { immediate: true })

// ---- 大图预览 ----
const viewer = reactive({ index: -1 })
const current = computed(() => photos.value[viewer.index] || {})

// ---- 管理模式：多选后批量删除/下载，或按序点选调整顺序（仅新人） ----
const selecting = ref(false)
const selected = ref(new Set())
const manageMode = ref('select') // select=多选 | order=排序
const orderSeq = ref([]) // 排序模式下按点击顺序记录的文件名
const savingOrder = ref(false)

const allSelected = computed(
  () => photos.value.length > 0 && selected.value.size === photos.value.length
)

function toggleSelecting() {
  selecting.value = !selecting.value
  selected.value = new Set()
  manageMode.value = 'select'
  orderSeq.value = []
}

function startOrder() {
  manageMode.value = 'order'
  selected.value = new Set()
  orderSeq.value = []
}

function cancelOrder() {
  manageMode.value = 'select'
  orderSeq.value = []
}

function toggleOrder(p) {
  const arr = orderSeq.value.slice()
  const at = arr.indexOf(p.name)
  if (at >= 0) arr.splice(at, 1)
  else arr.push(p.name)
  orderSeq.value = arr
}

async function saveOrderFn() {
  if (!orderSeq.value.length) return
  savingOrder.value = true
  try {
    await storage.saveOrder(orderSeq.value)
    await load()
    toggleSelecting() // 保存成功后退出管理
  } catch (err) {
    window.alert(err.message || '保存顺序失败')
  } finally {
    savingOrder.value = false
  }
}

function toggleSelect(p) {
  const s = new Set(selected.value)
  if (s.has(p.name)) s.delete(p.name)
  else s.add(p.name)
  selected.value = s
}

function toggleAll() {
  selected.value = allSelected.value
    ? new Set()
    : new Set(photos.value.map((p) => p.name))
}

function onWallClick(p, i) {
  if (props.owner && selecting.value) {
    if (manageMode.value === 'order') toggleOrder(p)
    else toggleSelect(p)
  } else {
    viewer.index = i
  }
}

async function deleteSelected() {
  const names = Array.from(selected.value)
  if (!names.length) return
  if (!window.confirm('确定删除所选 ' + names.length + ' 张照片吗？删除后无法恢复')) return
  const failed = new Set()
  for (const name of names) {
    try {
      await storage.remove(name)
    } catch (e) {
      failed.add(name)
    }
  }
  photos.value = photos.value.filter((p) => !selected.value.has(p.name) || failed.has(p.name))
  if (failed.size) window.alert(failed.size + ' 张删除失败，请重试')
  selected.value = new Set()
  selecting.value = false
}

// 批量下载：逐张触发保存，间隔 400ms 避免浏览器拦截
function downloadSelected() {
  const targets = photos.value.filter((p) => selected.value.has(p.name))
  targets.forEach((p, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = p.url
      a.download = p.name
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }, i * 400)
  })
}

// ---- 点赞（每设备限一次，本机记录） ----
const likedSet = ref(new Set(JSON.parse(localStorage.getItem('wedding-liked') || '[]')))

function hasLiked(name) {
  return !!name && likedSet.value.has(name)
}

async function likePhoto() {
  const p = current.value
  if (!p.name || hasLiked(p.name)) return
  try {
    const res = await storage.metaAction(p.name, { action: 'like' })
    applyEntry(res.entry)
    likedSet.value.add(p.name)
    localStorage.setItem('wedding-liked', JSON.stringify(Array.from(likedSet.value)))
  } catch (err) {
    window.alert(err.message || '点赞失败')
  }
}

// ---- 留言 ----
const commentBy = ref(localStorage.getItem('wedding-guest-name') || '')
const commentByDraft = ref('')
const commentText = ref('')
const sendingComment = ref(false)

async function sendComment() {
  const p = current.value
  if (!p.name || !commentText.value) return
  const by = commentBy.value || commentByDraft.value
  if (!by) {
    window.alert('请先填写您的名字')
    return
  }
  sendingComment.value = true
  try {
    const res = await storage.metaAction(p.name, { action: 'comment', by, text: commentText.value })
    applyEntry(res.entry)
    commentText.value = ''
    commentBy.value = by
    localStorage.setItem('wedding-guest-name', by)
  } catch (err) {
    window.alert(err.message || '留言失败')
  } finally {
    sendingComment.value = false
  }
}

// 用服务端返回的条目刷新列表中的对应照片（赞数/留言/顺序）
function applyEntry(entry) {
  const i = photos.value.findIndex((p) => p.name === entry.name)
  if (i < 0) return
  const p = photos.value[i]
  photos.value[i] = Object.assign({}, p, {
    likes: entry.likes,
    comments: entry.comments,
    order: entry.order != null ? entry.order : p.order
  })
}

// ---- 删除照片（仅新人） ----
async function removePhoto() {
  const p = current.value
  if (!p.name) return
  if (!window.confirm('确定删除这张照片吗？删除后无法恢复')) return
  try {
    await storage.remove(p.name)
    photos.value = photos.value.filter((x) => x.name !== p.name)
    viewer.index = -1
  } catch (err) {
    window.alert(err.message || '删除失败')
  }
}

// ---- 二维码 ----
const qrCanvas = ref(null)
const siteUrl = computed(
  () => config.siteUrl || location.origin + location.pathname
)

watch(
  [authed, qrCanvas],
  ([ok, canvas]) => {
    if (ok && canvas) {
      QRCode.toCanvas(canvas, siteUrl.value, { width: 110, margin: 1, color: { dark: '#4a4038' } })
    }
  },
  { immediate: true, flush: 'post' }
)
</script>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 40px;
}

/* ---- 密码页 ---- */
.lock-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

.lock-card {
  width: 100%;
  max-width: 340px;
  text-align: center;
  padding: 34px 24px;
}

.lock-icon {
  width: 58px;
  height: 58px;
  margin: 0 auto 12px;
  border: 1.5px solid var(--gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--gold-deep);
}

.lock-title {
  font-size: 20px;
  color: var(--gold-deep);
  letter-spacing: 3px;
}

.lock-tip {
  margin: 8px 0 18px;
  font-size: 13px;
  color: var(--ink-light);
}

.lock-input {
  width: 100%;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  text-align: center;
  letter-spacing: 4px;
}

.lock-input:focus {
  border-color: var(--gold);
}

.lock-error {
  color: var(--red);
  font-size: 13px;
  margin-bottom: 8px;
}

.back {
  display: inline-block;
  margin-top: 16px;
  font-size: 13px;
  color: var(--ink-light);
  text-decoration: none;
}

/* ---- 头部 ---- */
.g-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26px 18px 6px;
}

.g-title {
  font-size: 21px;
  color: var(--gold-deep);
  letter-spacing: 1px;
}

.g-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ink-light);
}

.refresh {
  flex-shrink: 0;
  padding: 8px 18px;
  border: 1px solid var(--gold);
  border-radius: 999px;
  background: transparent;
  color: var(--gold-deep);
  font-size: 14px;
  cursor: pointer;
}

.refresh:disabled {
  opacity: 0.5;
}

/* ---- 二维码卡片 ---- */
.qr-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.qr-card canvas {
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--line);
}

.qr-title {
  font-weight: 600;
  color: var(--gold-deep);
}

.qr-info p {
  font-size: 13px;
  color: var(--ink-light);
  margin-top: 2px;
}

.qr-url {
  word-break: break-all;
}

/* ---- 状态提示 ---- */
.state {
  text-align: center;
  color: var(--ink-light);
  padding: 50px 20px;
  font-size: 14px;
}

.state.error {
  color: var(--red);
}

.retry {
  margin-left: 8px;
  border: none;
  background: none;
  color: var(--gold-deep);
  text-decoration: underline;
  cursor: pointer;
}

/* ---- 照片墙（每行 4 张网格） ---- */
.wall {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 14px 16px;
}

.wall-item {
  position: relative;
  aspect-ratio: 1; /* 统一方形，行列整齐 */
  margin: 0;
  cursor: pointer;
}

.wall-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 10px;
  background: var(--line);
}

.wall-by {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 10px 5px;
  border-radius: 0 0 10px 10px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
  color: #fff;
  font-size: 12px;
  text-align: right;
  pointer-events: none;
}

/* ---- 管理模式：多选 ---- */
.page.selecting {
  padding-bottom: 86px; /* 给底部操作栏让位 */
}

.g-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.check {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: rgba(0, 0, 0, 0.35);
  color: transparent;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.check.on {
  background: var(--gold);
  border-color: var(--gold);
  color: #fff;
}

.order-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--gold);
  color: #fff;
  font-size: 12px;
  line-height: 22px;
  text-align: center;
}

.wall-likes {
  color: #ffd7d0;
  margin-left: 6px;
}

/* ---- 多选操作栏 ---- */
.select-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--line);
  box-shadow: 0 -4px 16px rgba(176, 141, 87, 0.12);
}

.sb-count {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--ink-light);
}

.sb-btn {
  padding: 8px 14px;
  border: 1px solid var(--gold);
  border-radius: 999px;
  background: transparent;
  color: var(--gold-deep);
  font-size: 13px;
  cursor: pointer;
}

.sb-btn:disabled {
  opacity: 0.4;
}

.sb-btn.danger {
  border-color: var(--red);
  color: var(--red);
}

.sb-tip {
  text-align: left;
  font-size: 12px;
}

/* ---- 大图预览 ---- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(20, 16, 12, 0.94);
  display: flex;
  flex-direction: column;
}

.lb-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  color: #e8ddcd;
  font-size: 14px;
}

.lb-bar a {
  color: #e8ddcd;
}

.lb-by {
  color: var(--rose);
}

.lb-del {
  color: #e8927c;
  cursor: pointer;
}

.lb-close {
  margin-left: auto;
  cursor: pointer;
}

.lightbox > img {
  flex: 1;
  min-height: 0;
  object-fit: contain;
  padding: 0 12px;
  cursor: pointer; /* 点击大图返回列表 */
}

.lb-nav {
  display: flex;
  justify-content: space-between;
  padding: 14px 18px 22px;
}

.lb-nav button {
  padding: 8px 16px;
  border: 1px solid rgba(232, 221, 205, 0.5);
  border-radius: 999px;
  background: transparent;
  color: #e8ddcd;
  font-size: 14px;
  cursor: pointer;
}

.lb-nav button:disabled {
  opacity: 0.3;
}

.lb-like {
  border-color: var(--rose) !important;
  color: #f2c9c2 !important;
}

.lb-like.liked {
  background: rgba(212, 165, 165, 0.25);
}

/* ---- 留言区 ---- */
.lb-comments {
  max-height: 26vh;
  overflow-y: auto;
  padding: 6px 18px 18px;
  color: #e8ddcd;
  font-size: 13px;
}

.cm-empty {
  color: rgba(232, 221, 205, 0.55);
  text-align: center;
  padding: 4px 0 10px;
}

.cm-item {
  padding: 5px 0;
  border-top: 1px solid rgba(232, 221, 205, 0.14);
  word-break: break-all;
}

.cm-by {
  color: var(--rose);
}

.cm-form {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.cm-name {
  width: 82px;
  flex-shrink: 0;
}

.cm-name,
.cm-text {
  padding: 8px 10px;
  border: 1px solid rgba(232, 221, 205, 0.35);
  border-radius: 8px;
  background: transparent;
  color: #f5eee2;
  font-size: 13px;
  outline: none;
}

.cm-text {
  flex: 1;
  min-width: 0;
}

.cm-name::placeholder,
.cm-text::placeholder {
  color: rgba(232, 221, 205, 0.45);
}

.cm-send {
  flex-shrink: 0;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--gold);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.cm-send:disabled {
  opacity: 0.5;
}
</style>
