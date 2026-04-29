// import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import './styles/main.css'
import 'uno.css'

const app = createApp(App)

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {},
})
app.use(i18n)

// const pinia = createPinia()
// app.use(pinia)

const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})
app.use(router)

app.mount('#app')
