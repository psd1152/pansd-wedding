<template>
  <!-- 背景音乐：Web Audio 合成喜庆旋律，无音频文件，零流量 -->
  <button
    class="music-btn"
    :class="{ playing: on }"
    :title="on ? '关闭背景音乐' : '播放背景音乐'"
    aria-label="背景音乐开关"
    @click="toggle"
  >♪</button>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const on = ref(false)
let ctx = null
let master = null
let timer = null

// 五声音阶频率表（C 宫调式：C D E G A，喜庆中国风）
const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.51
}

// 主旋律：32 个八分音符（8 小节 4/4），d 为八分音符数
const melody = [
  { n: 'E5', d: 1 }, { n: 'G5', d: 1 }, { n: 'A5', d: 1 }, { n: 'G5', d: 1 },
  { n: 'E5', d: 1 }, { n: 'D5', d: 1 }, { n: 'C5', d: 1 }, { n: 'D5', d: 1 },
  { n: 'E5', d: 1 }, { n: 'G5', d: 1 }, { n: 'A5', d: 1 }, { n: 'C6', d: 1 },
  { n: 'A5', d: 1 }, { n: 'G5', d: 1 }, { n: 'E5', d: 1 }, { n: 'D5', d: 1 },
  { n: 'C5', d: 1 }, { n: 'D5', d: 1 }, { n: 'E5', d: 1 }, { n: 'G5', d: 1 },
  { n: 'A5', d: 1 }, { n: 'G5', d: 1 }, { n: 'E5', d: 1 }, { n: 'D5', d: 1 },
  { n: 'E5', d: 1 }, { n: 'G5', d: 1 }, { n: 'A5', d: 1 }, { n: 'G5', d: 1 },
  { n: 'C6', d: 4 }
]

// 低音伴奏：每拍一个（2 个八分音符一拍）
const bass = [
  { n: 'C4' }, { n: 'C4' }, { n: 'G4' }, { n: 'G4' },
  { n: 'A4' }, { n: 'A4' }, { n: 'E4' }, { n: 'E4' },
  { n: 'D4' }, { n: 'D4' }, { n: 'G4' }, { n: 'G4' },
  { n: 'C4' }, { n: 'C4' }, { n: 'G4' }, { n: 'G4' }
]

// 小节末的"叮"点缀
const chimes = [
  { n: 'C6', at: 7 },
  { n: 'C6', at: 15 },
  { n: 'C6', at: 23 },
  { n: 'E6', at: 31 }
]

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** 播放一个音符：三角波 + 快速起音/指数衰减，听感柔和喜庆 */
function playNote(freq, t, dur, vol) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

const STEP = 0.25 // 八分音符时长（120 BPM）

function scheduleLoop() {
  const t0 = ctx.currentTime + 0.15
  melody.forEach((m, i) => {
    playNote(N[m.n], t0 + i * STEP, STEP * m.d * 0.92, 0.16)
  })
  bass.forEach((b, i) => {
    playNote(N[b.n], t0 + i * STEP * 2, STEP * 2 * 0.9, 0.1)
  })
  chimes.forEach((c) => {
    playNote(N[c.n], t0 + c.at * STEP, 0.12, 0.05)
  })
  const totalMs = melody.reduce((s, m) => s + m.d, 0) * STEP * 1000
  timer = setTimeout(scheduleLoop, totalMs)
}

function start() {
  ensureCtx()
  if (!timer) scheduleLoop()
  on.value = true
}

function stop() {
  clearTimeout(timer)
  timer = null
  on.value = false
}

function toggle() {
  if (on.value) stop()
  else start()
}

onMounted(() => {
  // 浏览器禁止无交互自动播放：宾客第一次点击页面任意处，音乐自动响起
  const kick = () => {
    if (!on.value) start()
  }
  window.addEventListener('pointerdown', kick, { once: true })
  window.addEventListener('touchstart', kick, { once: true })
})

onUnmounted(stop)
</script>

<style scoped>
.music-btn {
  position: fixed;
  right: 16px;
  bottom: 18px;
  z-index: 99;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1.5px solid var(--gold);
  background: rgba(255, 255, 255, 0.94);
  color: var(--gold-deep);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}

.music-btn.playing {
  animation: music-spin 2.4s linear infinite;
}

@keyframes music-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
