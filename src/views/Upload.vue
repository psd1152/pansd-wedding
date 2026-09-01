<template>
  <div class="page">
    <!-- 婚礼主题头部 -->
    <header class="hero">
      <div class="ring">♥</div>
      <h1 class="names serif">{{ config.groom }} <span class="amp">&amp;</span> {{ config.bride }}</h1>
      <div class="date serif">{{ config.date }}</div>
      <p class="slogan">{{ config.slogan }}</p>
    </header>

    <!-- 选择与上传 -->
    <section class="card">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="onPick"
      />
      <div class="pick" @click="$refs.fileInput.click()">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
        <div class="pick-title">拍照 / 从相册选择</div>
        <div class="pick-tip">支持多选 · 上传前自动压缩，更快更省流量</div>
      </div>

      <!-- 待上传预览 -->
      <div v-if="items.length" class="grid">
        <div
          v-for="it in items"
          :key="it.id"
          class="cell"
          :class="it.status"
          @click="it.status === 'failed' && uploadOne(it)"
        >
          <img :src="it.previewUrl" alt="待上传照片" />
          <span v-if="canRemove(it)" class="del" @click.stop="remove(it)">×</span>
          <div v-if="it.status === 'uploading'" class="mask uploading">
            <span class="pct">{{ it.progress }}%</span>
          </div>
          <div v-else-if="it.status === 'success'" class="mask success">✓</div>
          <div v-else-if="it.status === 'failed'" class="mask failed">失败 · 点我重试</div>
        </div>
      </div>

      <!-- 结果横幅 -->
      <transition name="fade">
        <div v-if="banner" class="banner" :class="banner.type">{{ banner.text }}</div>
      </transition>

      <div class="actions">
        <button
          v-if="pendingCount > 0"
          class="btn primary"
          :disabled="uploading"
          @click="uploadAll"
        >
          {{ uploading ? '正在上传…' : '开始上传（' + pendingCount + ' 张）' }}
        </button>
        <button v-else-if="items.length" class="btn ghost" @click="reset">继续上传下一批</button>
      </div>
    </section>

    <!-- 我的上传记录 -->
    <section v-if="records.length" class="card">
      <h3 class="sec-title">我的上传记录</h3>
      <div class="record-list">
        <div v-for="r in recordsDesc" :key="r.time + r.name" class="record">
          <img :src="r.url" loading="lazy" alt="已上传照片" />
          <div class="record-meta">
            <span class="t">{{ formatTime(r.time) }}</span>
            <span class="st" :class="r.status">{{ r.status === 'success' ? '已上传' : '未成功' }}</span>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <router-link to="/gallery" class="owner-link serif">新人入口</router-link>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import config from '../config'
import { storage } from '../storage'
import { compressImage, genFileName } from '../utils/compress'
import { getRecords, addRecord } from '../utils/record'

const items = ref([]) // {id, file, previewUrl, status, progress}
const uploading = ref(false)
const banner = ref(null)
const records = ref(getRecords())
let uid = 0

const pendingCount = computed(() =>
  items.value.filter((i) => i.status === 'pending' || i.status === 'failed').length
)
const recordsDesc = computed(() => [...records.value].reverse())

function onPick(e) {
  const files = Array.from(e.target.files || [])
  files.forEach((file) => {
    items.value.push({
      id: ++uid,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0
    })
  })
  e.target.value = ''
}

function canRemove(it) {
  return !uploading.value || (it.status !== 'uploading' && it.status !== 'pending')
}

function remove(it) {
  URL.revokeObjectURL(it.previewUrl)
  items.value = items.value.filter((i) => i.id !== it.id)
}

function reset() {
  items.value.forEach((i) => URL.revokeObjectURL(i.previewUrl))
  items.value = []
  banner.value = null
}

async function uploadOne(it) {
  if (it.status === 'uploading') return
  it.status = 'uploading'
  it.progress = 0
  try {
    const blob = await compressImage(it.file)
    const name = genFileName()
    const { url } = await storage.upload(blob, name, (p) => {
      it.progress = Math.round(p * 100)
    })
    it.status = 'success'
    it.progress = 100
    records.value = addRecord({ name, url, time: Date.now(), status: 'success' })
  } catch (err) {
    it.status = 'failed'
    it.error = err.message
    records.value = addRecord({ name: it.file.name, url: '', time: Date.now(), status: 'failed' })
  }
}

async function uploadAll() {
  uploading.value = true
  banner.value = null
  const targets = items.value.filter((i) => i.status === 'pending' || i.status === 'failed')
  for (const it of targets) {
    await uploadOne(it) // 逐张串行上传，弱网下更稳
  }
  uploading.value = false
  const failed = targets.filter((i) => i.status === 'failed').length
  banner.value = failed === 0
    ? { type: 'ok', text: '全部上传成功，感谢你的祝福！' }
    : { type: 'warn', text: failed + ' 张上传失败，点击照片可重试' }
}

function formatTime(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: 30px;
}

/* ---- 头部 ---- */
.hero {
  text-align: center;
  padding: 42px 20px 26px;
  background: linear-gradient(180deg, #fdf9f1 0%, var(--bg) 100%);
}

.ring {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border: 1.5px solid var(--gold);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gold);
  font-size: 20px;
}

.names {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 4px;
  color: var(--gold-deep);
}

.amp {
  font-style: italic;
  color: var(--rose);
  padding: 0 6px;
}

.date {
  margin-top: 6px;
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--ink-light);
}

.slogan {
  margin-top: 14px;
  font-size: 14px;
  color: var(--ink);
}

/* ---- 选择区 ---- */
.pick {
  border: 1.5px dashed var(--gold);
  border-radius: var(--radius);
  padding: 26px 16px;
  text-align: center;
  color: var(--gold-deep);
  cursor: pointer;
  transition: background 0.2s;
}

.pick:active {
  background: #fdf7ec;
}

.pick-title {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
}

.pick-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ink-light);
}

/* ---- 预览网格 ---- */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
}

.cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  line-height: 22px;
  text-align: center;
}

.mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #fff;
}

.mask.uploading {
  background: rgba(0, 0, 0, 0.35);
}

.mask.success {
  background: rgba(93, 160, 105, 0.75);
  font-size: 26px;
}

.mask.failed {
  background: rgba(212, 106, 90, 0.85);
  font-size: 12px;
  padding: 0 6px;
  text-align: center;
}

/* ---- 横幅与按钮 ---- */
.banner {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  text-align: center;
}

.banner.ok {
  background: #edf6ef;
  color: var(--green);
}

.banner.warn {
  background: #fdf0ee;
  color: var(--red);
}

.actions {
  margin-top: 16px;
}

/* ---- 上传记录 ---- */
.sec-title {
  font-size: 16px;
  color: var(--gold-deep);
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record img {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--line);
}

.record-meta {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.record-meta .t {
  color: var(--ink-light);
}

.record-meta .st {
  font-weight: 600;
}

.record-meta .st.success {
  color: var(--green);
}

.record-meta .st.failed {
  color: var(--red);
}

/* ---- 页脚 ---- */
.footer {
  text-align: center;
  margin-top: 26px;
}

.owner-link {
  font-size: 13px;
  color: var(--ink-light);
  text-decoration: none;
  letter-spacing: 2px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 2px;
}
</style>
