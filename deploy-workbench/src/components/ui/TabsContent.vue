<script setup lang="ts">
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  class?: string
}

const props = defineProps<Props>()

const tabs = inject('tabs') as { activeTab: Ref<string> }

const isActive = computed(() => tabs.activeTab.value === props.value)

const contentClass = computed(() =>
  cn(
    'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    !isActive.value && 'hidden',
    props.class
  )
)
</script>

<template>
  <div :class="contentClass">
    <slot />
  </div>
</template>
