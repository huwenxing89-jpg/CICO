<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  value?: number
  max?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  max: 100
})

const percentage = computed(() => {
  return Math.min(100, Math.max(0, (props.value || 0) / props.max * 100))
})

const progressClass = computed(() =>
  cn(
    'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
    props.class
  )
)

const indicatorClass = computed(() =>
  cn(
    'h-full w-full flex-1 bg-primary transition-all duration-300',
    'after:absolute after:inset-0 after:bg-[length:10px_10px] after:bg-[image:linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] after:bg-[position:0_0,5px_5px]'
  )
)
</script>

<template>
  <div :class="progressClass">
    <div
      :class="indicatorClass"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
