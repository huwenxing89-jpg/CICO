<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  modelValue: boolean
  disabled?: boolean
  id?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  modelValue: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}

const checkboxClass = computed(() =>
  cn(
    'h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'transition-all appearance-none cursor-pointer',
    'checked:bg-primary checked:border-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    props.modelValue ? 'bg-primary text-primary-foreground' : 'bg-background',
    props.class
  )
)
</script>

<template>
  <input
    type="checkbox"
    :id="id"
    :checked="modelValue"
    :disabled="disabled"
    :class="checkboxClass"
    @change="handleChange"
  />
</template>

<style scoped>
input[type="checkbox"] {
  position: relative;
}

input[type="checkbox"]:checked {
  background-color: hsl(var(--primary));
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
}

input[type="checkbox"]:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>
