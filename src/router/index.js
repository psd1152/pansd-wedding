import { createRouter, createWebHashHistory } from 'vue-router'
import Upload from '../views/Upload.vue'
import GuestGallery from '../views/GuestGallery.vue'
import OwnerGallery from '../views/OwnerGallery.vue'

// Hash 路由：nginx 无需任何重写规则
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'upload', component: Upload },
    { path: '/gallery', name: 'guest-gallery', component: GuestGallery }, // 宾客公开相册
    { path: '/owner', name: 'owner-gallery', component: OwnerGallery } // 新人相册（密码）
  ]
})

export default router
