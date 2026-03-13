<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const contentClass = computed(() =>
  cn('p-6', props.class)
)
</script>

<template>
  <div :class="contentClass">
    <slot />
  </div>
</template>
