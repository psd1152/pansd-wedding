import { createRouter, createWebHashHistory } from 'vue-router'
import Upload from '../views/Upload.vue'
import Gallery from '../views/Gallery.vue'

// Hash 路由：nginx 无需任何重写规则
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'upload', component: Upload },
    { path: '/gallery', name: 'gallery', component: Gallery }
  ]
})

export default router
