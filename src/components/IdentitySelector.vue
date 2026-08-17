<template> 
  <div class="identity-selector">
    <label for="user-select">Login as:</label>
    <select id="user-select" v-model="currentUserId"> 
      <option :value="null">-- Select your profile --</option>
      <option v-for="emp in employees" :key="emp.id" :value="emp.id">
        {{ emp.name }} <!-- Displays the name -->
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue'
import { API_BASE_URL } from '../api'


const currentUserId = inject('currentUserId')
const employees = ref([])

onMounted(async () => { // Updates 'employees' 
  try {
    const res = await fetch(`${API_BASE_URL}/api/employees`)
    const data = await res.json()
    employees.value = data 
  } catch (e) {
    console.error('Failed to load employees', e)
  }
})
</script>

<style scoped>
.identity-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  
}

label {
  font-weight: 500;
  color: var(--text-muted);
}
</style>
