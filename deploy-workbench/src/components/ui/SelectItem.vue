<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-vue-next'

interface Props {
  value: string
  modelValue?: string
  class?: string
}

const props = defineProps<Props>()

// 不再自己 emit，而是通过 slot 接收 select 函数
const isSelected = computed(() => props.value === props.modelValue)

const itemClass = computed(() =>
  cn(
    'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
    isSelected.value && 'bg-accent',
    props.class
  )
)
</script>

<template>
  <div :class="itemClass" @click="$emit('select', value)">
    <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <Check v-if="isSelected" class="h-4 w-4" />
    </span>
    <slot />
  </div>
</template>
