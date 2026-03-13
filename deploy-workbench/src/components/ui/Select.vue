<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

interface Props {
  modelValue?: string
  disabled?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: '请选择',
  options: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const selectRef = ref<HTMLElement>()

const displayValue = computed(() => {
  const option = props.options.find(o => o.value === props.modelValue)
  return option?.label || props.placeholder
})

const toggle = async () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value

    // 等待 DOM 更新后再滚动到视图
    if (isOpen.value) {
      await nextTick()
      const dropdown = selectRef.value?.querySelector('[role="listbox"]') as HTMLElement
      if (dropdown) {
        dropdown.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
  }
}

const select = (value: string) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

// 点击外部关闭
const handleClickOutside = (e: MouseEvent) => {
  if (isOpen.value && selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', handleClickOutside)
}
</script>

<template>
  <div ref="selectRef" class="relative" :class="class">
    <button
      type="button"
      :disabled="disabled"
      :class="[
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        isOpen && 'ring-2 ring-ring ring-offset-2'
      ]"
      @click="toggle"
    >
      <span class="truncate">{{ displayValue }}</span>
      <ChevronDown :class="['h-4 w-4 opacity-50 transition-transform flex-shrink-0', isOpen && 'rotate-180']" />
    </button>

    <div
      v-show="isOpen"
      role="listbox"
      class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white text-slate-950 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
    >
      <div
        v-for="option in options"
        :key="option.value"
        :class="[
          'relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-800',
          modelValue === option.value && 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        ]"
        @click="select(option.value)"
      >
        <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg v-if="modelValue === option.value" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        {{ option.label }}
      </div>
      <div v-if="options.length === 0" class="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
        暂无选项
      </div>
    </div>
  </div>
</template>
