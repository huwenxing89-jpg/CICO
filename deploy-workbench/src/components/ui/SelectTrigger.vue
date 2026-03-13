<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-vue-next'

interface Props {
  class?: string
  isOpen?: boolean
  displayValue?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
}>()

const triggerClass = computed(() =>
  cn(
    'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    props.class
  )
)
</script>

<template>
  <button :class="triggerClass" @click="emit('toggle')">
    <slot>{{ displayValue }}</slot>
    <ChevronDown :class="['h-4 w-4 opacity-50 transition-transform', isOpen && 'rotate-180']" />
  </button>
</template>
