<template>
  <router-view />
</template>

<style>
/* ========== 全局样式：婚礼主题（暖色 / 卡片式） ========== */
:root {
  --gold: #b08d57;
  --gold-deep: #96733f;
  --rose: #d4a5a5;
  --ink: #4a4038;
  --ink-light: #9a8d80;
  --bg: #faf5ee;
  --card: #ffffff;
  --line: #f0e6d8;
  --green: #5da069;
  --red: #d46a5a;
  --radius: 14px;
  --shadow: 0 4px 18px rgba(176, 141, 87, 0.12);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html,
body {
  background: var(--bg);
}

body {
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
}

.serif {
  font-family: Georgia, 'Times New Roman', 'STSong', 'SimSun', serif;
}

/* 通用按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 13px 0;
  border: none;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
}

.btn.primary {
  background: linear-gradient(135deg, var(--gold), var(--gold-deep));
  color: #fff;
  box-shadow: 0 6px 16px rgba(176, 141, 87, 0.35);
}

.btn.ghost {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold-deep);
}

/* 通用卡片 */
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px;
  margin: 14px 16px;
}

/* 淡入动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
