<template>
  <RouterView />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'

onMounted(() => {
  console.log('onMounted')
})
</script>

<style scoped></style>
