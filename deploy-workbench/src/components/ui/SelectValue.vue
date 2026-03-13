<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const valueClass = computed(() =>
  cn('text-sm', props.class)
)
</script>

<template>
  <span :class="valueClass">
    <slot />
  </span>
</template>
