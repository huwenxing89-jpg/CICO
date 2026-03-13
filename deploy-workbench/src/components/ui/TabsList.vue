<script setup lang="ts">
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const tabs = inject('tabs') as { activeTab: Ref<string> }

const listClass = computed(() =>
  cn(
    'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
    props.class
  )
)
</script>

<template>
  <div :class="listClass">
    <slot />
  </div>
</template>
