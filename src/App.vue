<template>
  <div class="app-container">
    <div class="header-toggle-wrapper"> <!-- Hide/Show header -->
      <button @click="toggleMode" class="toggle-dark-button">
        {{ darkMode ? '💡' : '🌙' }}
      </button>
      <button class="btn-toggle" @click="showHeader = !showHeader">
        {{ showHeader ? 'Hide Header ▲' : 'Show Header ▼' }}
      </button>
    </div>
    <header class="app-header glass-panel" v-show="showHeader">
      <div>
        <h1>Web Work Calendar</h1>
        <p class="subtitle">A project by Gabriele La Vista</p>
      </div>
      <div>
      <IdentitySelector v-if="currentView === 'calendar'" />
      </div>
    </header>

    <div class="tabs"> 
      <button :class="{ active: currentView === 'calendar' }" @click="currentView = 'calendar'">Calendar</button>
      <button :class="{ active: currentView === 'manager' }" @click="currentView = 'manager'">Manage Employees</button>
    </div>
    
    <main> <!-- Defines the current tab -->
      <div v-if="currentView === 'calendar'" class="calendar-view"> 
        <WeekNavigator />
        <Calendar />
      </div>
      <EmployeeManager v-if="currentView === 'manager'" />
    </main>
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
import IdentitySelector from './components/IdentitySelector.vue';
import WeekNavigator from './components/WeekNavigator.vue';
import Calendar from './components/Calendar.vue';
import EmployeeManager from './components/EmployeeManager.vue';

const currentView = ref('calendar'); // Sets the currently active tab/view
const currentUserId = ref(null); // Selected user from the dropdown menu
const selectedDate = ref(new Date()); // The date the user is currently viewing (defaults to today)
const isLoading = ref(false); // Global loading state
const showHeader = ref(true); // Toggle state for the top header
const darkMode = ref(false); // Toggle state for the theme

// Provide global state to child components so they can inject and use it
provide('currentUserId', currentUserId); 
provide('selectedDate', selectedDate);
provide('isLoading', isLoading);

/**
 * Toggles the dark mode theme, updates the body class, and persists the choice in localStorage.
 */
function toggleMode() {
  darkMode.value = !darkMode.value;
  localStorage.setItem("darkMode", darkMode.value); 
  document.body.classList.toggle("dark-mode", darkMode.value);
}

onMounted(() => {
  // Check localStorage on component mount to restore the user's theme preference
  if (localStorage.getItem("darkMode") === "true") {
    darkMode.value = true;
    document.body.classList.add("dark-mode");
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  align-content: center;
  overflow-x: auto; /* Enables horizontal scrolling */
  white-space: nowrap; /* no newline text*/
  padding-bottom: 0.25rem;   
  -webkit-overflow-scrolling: touch; /* IOS smooth scrolling */

}

.tabs button {
  background: var(--card-bg);
  color: var(--text-muted);
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--border-color);
  font-size: 1rem;
  flex-shrink: 0; /* No button's shrinking */
}

.tabs button.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-hover);
}

.app-header {
  display: flex;
  flex-direction: column; /* Column-align the divs */
  gap: 1.5rem; /* vertica space */
  padding: 1.5rem;
  align-items: flex-start; /* left */
}

@media (min-width: 768px) { /* When the user isn't using a mobile device */
  .app-header {
    flex-direction: row; /* Align elements horizontally */
    justify-content: space-between; /* title to the left, selector to the right */
    align-items: center;            
    padding: 1.5rem 2rem;
  }

  .tabs {
      justify-content: center; /* Horizontally centers the buttons */
  }
}




h1 {
  font-size: 1.75rem;
  color: var(--primary-color);
  margin-bottom: 0.25rem;
  background: linear-gradient(135deg, #818cf8, #4f46e5);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
}

main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.calendar-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.header-toggle-wrapper {
  display: flex;
  justify-content: space-between;
  margin-bottom: -1rem; 
}

.btn-toggle {
  background: transparent;
  justify-content: flex-end; 
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  padding: 0.3rem 0.8rem;
  font-size: 0.8rem;
  border-radius: 20px; 
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-toggle:hover {
  background: var(--card-bg);
  color: var(--text-main);
}

.toggle-dark-button {
  background: transparent;
  justify-content: flex-start; 
  color: var(--text-muted);
  border: 3px solid var(--border-color);
  padding: 0.3rem 0.8rem;
  font-size: 1rem;
  border-radius: 20px; 
  cursor: pointer;
  transition: all 0.2s ease;
}
</style>
