<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  isOpen?: boolean
  modelValue?: string
  class?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [value: string]
}>()

const contentClass = computed(() =>
  cn(
    'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md',
    !props.isOpen && 'hidden',
    props.class
  )
)

const selectValue = (value: string) => {
  emit('select', value)
}
</script>

<template>
  <div :class="contentClass">
    <slot :select="selectValue" :model-value="modelValue" :is-open="isOpen" />
  </div>
</template>
