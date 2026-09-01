<template>
  <div class="page">
    <!-- 密码门槛 -->
    <template v-if="!authed">
      <div class="lock-wrap">
        <div class="card lock-card">
          <div class="lock-icon serif">囍</div>
          <h2 class="lock-title">新人相册</h2>
          <p class="lock-tip">请输入密码查看婚礼全部照片</p>
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
          <h1 class="g-title serif">{{ config.groom }} &amp; {{ config.bride }} 的婚礼相册</h1>
          <div class="g-sub">共 {{ photos.length }} 张照片</div>
        </div>
        <button class="refresh" :disabled="loading" @click="load">
          {{ loading ? '加载中' : '刷新' }}
        </button>
      </header>

      <!-- 现场二维码 -->
      <section class="card qr-card">
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
        <img
          v-for="(p, i) in photos"
          :key="p.name"
          :src="p.url"
          loading="lazy"
          alt="婚礼照片"
          @click="viewer.index = i"
        />
      </div>

      <!-- 大图预览 -->
      <transition name="fade">
        <div v-if="viewer.index >= 0" class="lightbox" @click.self="viewer.index = -1">
          <div class="lb-bar">
            <span>{{ viewer.index + 1 }} / {{ photos.length }}</span>
            <a :href="current.url" download target="_blank">下载</a>
            <span class="lb-close" @click="viewer.index = -1">关闭</span>
          </div>
          <img :src="current.url" alt="大图预览" />
          <div class="lb-nav">
            <button :disabled="viewer.index === 0" @click="viewer.index--">‹ 上一张</button>
            <button :disabled="viewer.index >= photos.length - 1" @click="viewer.index++">下一张 ›</button>
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

const AUTH_KEY = 'wedding-owner-authed'

// ---- 密码门槛 ----
const authed = ref(sessionStorage.getItem(AUTH_KEY) === '1')
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

/* ---- 照片墙（瀑布流） ---- */
.wall {
  columns: 3 180px;
  column-gap: 8px;
  padding: 14px 16px;
}

.wall img {
  width: 100%;
  display: block;
  border-radius: 10px;
  margin-bottom: 8px;
  break-inside: avoid;
  cursor: pointer;
  background: var(--line);
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

.lb-close {
  margin-left: auto;
  cursor: pointer;
}

.lightbox > img {
  flex: 1;
  min-height: 0;
  object-fit: contain;
  padding: 0 12px;
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
</style>
