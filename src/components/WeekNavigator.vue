<template>
  <div class="week-navigator glass-panel">

    
    <div class="week-display"> <!-- mostra settimana corrente e range di giorni -->
      <h2>Week {{ weekNumber }}</h2>
      <span class="muted-text">{{ displayRange }}</span>
    </div>

    <div class="nav-buttons">
    <button @click="previousWeek" class="nav-btn" :disabled="loading"> <!--bottone per settimana precedente-->
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      Prev Week
    </button>

    <button @click="nextWeek" class="nav-btn" :disabled="loading"> <!--bottone settimana successiva-->
      Next Week
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    </div>
  </div>
</template>

<script setup>
import { inject, computed } from 'vue';
import { addWeeks, getISOWeek, startOfISOWeek, endOfISOWeek, format } from 'date-fns';

// Global state injected from App.vue
const selectedDate = inject('selectedDate'); 
const loading = inject('isLoading');

/**
 * Computes the current ISO week number based on the selected date.
 */
const weekNumber = computed(() => getISOWeek(selectedDate.value)); 

/**
 * Generates the string representation of the current week's date range (e.g., "May 18 - May 24, 2026").
 */
const displayRange = computed(() => { 
  const start = startOfISOWeek(selectedDate.value);
  const end = endOfISOWeek(selectedDate.value);
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
});

/**
 * Navigates to the previous week. Current date - 1
 */
const previousWeek = () => { 
  selectedDate.value = addWeeks(selectedDate.value, -1);
};

/**
 * Navigates to the next week. Current date + 1
 */
const nextWeek = () => { 
  selectedDate.value = addWeeks(selectedDate.value, 1);
};
</script>

<style scoped>
.week-navigator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none; /* avoids hover */
}

.week-navigator button {
  margin: 5px;
}

.week-display {
  text-align: center;
}

.week-display h2 {
  color: #4f46e5;
  margin: 0.25rem;
}

.muted-text {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--card-bg);
  color: var(--text-main);
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
}

.nav-btn:hover {
  background-image: var(--primary-hover);
  color: white;
  border-color: rgba(79, 70, 229, 0.4);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
}

@media (max-width: 768px) {
  .week-display{
    white-space: nowrap;
  }
  .week-navigator {
    max-width: 100rem;
    flex-direction: column;
  }
}

</style>
