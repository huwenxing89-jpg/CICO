<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

const variants = {
  default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
  outline: 'border border-border text-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80'
}

const badgeClass = computed(() =>
  cn(
    'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variants[props.variant],
    props.class
  )
)
</script>

<template>
  <div :class="badgeClass">
    <slot />
  </div>
</template>
