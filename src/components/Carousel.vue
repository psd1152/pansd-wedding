<template>
  <!-- 轮播图：图片清单来自 public/imgs/manifest.json（构建时自动扫描生成），
       新增照片只需放入 public/imgs/，无需改代码 -->
  <section v-if="slides.length" class="card carousel-card">
    <h3 class="sec-title">我们的幸福瞬间</h3>
    <div
      class="carousel"
      @mouseenter="pause()"
      @mouseleave="play()"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- 只渲染当前一张，切换淡入淡出；下一张提前预加载 -->
      <transition name="fade">
        <img :key="current" :src="slides[current]" alt="轮播图" draggable="false" />
      </transition>
      <!-- 左右手动切换 -->
      <button class="arrow left" aria-label="上一张" @click="go(current - 1)">‹</button>
      <button class="arrow right" aria-label="下一张" @click="go(current + 1)">›</button>
      <!-- 指示点（照片多时仅显示前若干，避免拥挤） -->
      <div class="dots">
        <span
          v-for="(s, i) in dots"
          :key="s"
          class="dot"
          :class="{ on: i === current }"
          @click="go(i)"
        ></span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const base = import.meta.env.BASE_URL // base:'./' 时是 './'，hash 路由下可正常解析
const slides = ref([]) // 图片 URL 数组（已随机打乱）
const current = ref(0)
const STEP_MS = 2000 // 每张停留 2 秒

let timer = null
let touchX = 0

// 照片多时指示点只显示前 9 个，避免一排塞不下
const dots = computed(() => slides.value.slice(0, 9))

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function go(i) {
  const n = slides.value.length
  if (!n) return
  current.value = (i + n) % n
  restart()
}

function play() {
  if (timer) return
  timer = setInterval(() => {
    current.value = (current.value + 1) % slides.value.length
  }, STEP_MS)
}

function pause() {
  clearInterval(timer)
  timer = null
}

function restart() {
  pause()
  play()
}

// 预加载下一张，切换不白屏
function preloadNext() {
  const n = slides.value.length
  if (!n) return
  const img = new Image()
  img.src = slides.value[(current.value + 1) % n]
}

async function loadSlides() {
  try {
    // no-store：避免浏览器/CDN 缓存旧清单，新增照片后刷新即可见
    const res = await fetch(base + 'imgs/manifest.json', { cache: 'no-store' })
    if (!res.ok) return
    const names = await res.json()
    if (!Array.isArray(names) || !names.length) return
    slides.value = shuffle(names.map((n) => base + 'imgs/' + n))
    play()
    preloadNext()
  } catch (e) {
    // 清单不存在（旧版本部署）则静默不显示轮播
  }
}

function onTouchStart(e) {
  touchX = e.touches[0].clientX
}

function onTouchMove(e) {
  // 阻止纵向滚动穿透
  if (Math.abs(e.touches[0].clientX - touchX) > 20) e.preventDefault()
}

function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchX
  if (dx < -30) go(current.value + 1) // 左滑下一张
  else if (dx > 30) go(current.value - 1) // 右滑上一张
}

// 每次切换后预加载下一张，保证切换无白屏
watch(current, preloadNext)

onMounted(loadSlides)

onUnmounted(pause)
</script>

<style scoped>
.carousel-card {
  margin-top: 4px;
  padding: 14px 16px 16px;
}

.sec-title {
  font-size: 16px;
  color: var(--gold-deep);
  letter-spacing: 2px;
  text-align: center;
  margin-bottom: 12px;
}

.carousel {
  position: relative;
  aspect-ratio: 2 / 3; /* 竖版婚纱照裁切 */
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--line);
  touch-action: pan-y;
}

.carousel img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-drag: none;
}

.arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
}

.arrow.left {
  left: 6px;
}

.arrow.right {
  right: 6px;
}

.dots {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 2;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.dot.on {
  background: var(--gold);
  transform: scale(1.25);
}
</style>
