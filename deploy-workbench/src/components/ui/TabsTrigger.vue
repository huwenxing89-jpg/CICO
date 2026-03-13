<script setup lang="ts">
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  class?: string
}

const props = defineProps<Props>()

const tabs = inject('tabs') as { activeTab: Ref<string>; setActiveTab: (value: string) => void }

const isActive = computed(() => tabs.activeTab.value === props.value)

const triggerClass = computed(() =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    isActive.value && 'bg-background text-foreground shadow-sm',
    !isActive.value && 'hover:bg-background/50',
    props.class
  )
)
</script>

<template>
  <button :class="triggerClass" @click="tabs.setActiveTab(value)">
    <slot />
  </button>
</template>
