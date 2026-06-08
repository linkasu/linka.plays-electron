<script setup lang="ts">
import { computed } from "vue";
import { useTobiiStatus } from "../composables/useTobiiStatus";

const { status } = useTobiiStatus();

const color = computed(() => {
  if (status.value.state === "tracking") return "secondary";
  if (status.value.state === "connected") return "primary";
  if (status.value.state === "error") return "error";
  return "accent";
});

const icon = computed(() => {
  if (status.value.state === "tracking" || status.value.state === "connected") return "mdi-eye-check";
  if (status.value.state === "error") return "mdi-eye-alert";
  return "mdi-mouse";
});
</script>

<template>
  <v-chip :color="color" size="large" variant="flat">
    <v-icon start :icon="icon" />
    {{ status.message }}
  </v-chip>
</template>
