<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <header class="app-header">
      <button class="theme-toggle" type="button" @click="toggleTheme">
        Theme: {{ theme }}
      </button>
    </header>
    <main class="app-main">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
const theme = useState<'light' | 'dark'>('theme', () => 'light')

const applyTheme = (value: 'light' | 'dark') => {
  if (!import.meta.client) return
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem('theme', value)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme
  }
  applyTheme(theme.value)
})

watch(theme, (value) => {
  applyTheme(value)
})

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>
