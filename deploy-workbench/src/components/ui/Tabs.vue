<script setup lang="ts">
import { provide, ref, computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue?: string
  class?: string
  defaultValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const activeTab = ref(props.modelValue || props.defaultValue)

const setActiveTab = (value: string) => {
  activeTab.value = value
  emit('update:modelValue', value)
}

provide('tabs', {
  activeTab,
  setActiveTab
})

const tabsClass = computed(() =>
  cn('w-full', props.class)
)
</script>

<template>
  <div :class="tabsClass">
    <slot />
  </div>
</template>
