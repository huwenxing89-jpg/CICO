<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const cardClass = computed(() =>
  cn('rounded-xl border bg-card text-card-foreground shadow-sm', props.class)
)
</script>

<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>
