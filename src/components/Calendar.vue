<template>
  <div class="calendar glass-panel">
    <div v-if="loading" class="loading">Loading calendar...</div> 
    <table v-else>
      <thead>

        <tr>
          <th class="col-employee">Employee</th>
          <th class="col-bulk">Bulk Apply</th>
          <th v-for="day in weekDays" :key="day.dateStr" class="col-day"> <!-- Generates columns for days of the current week -->
            <div class="day-header">
              <span class="day-name">{{ day.name }}</span>
              <span class="day-date">{{ day.shortDate }}</span>
            </div>
          </th>
        </tr>

      </thead>
      <tbody>

        <tr v-for="emp in employees" :key="emp.id" :class="{ 'highlight': emp.id === currentUserId }"> 
          <td class="col-employee font-medium">{{ emp.name }}</td>

          <td class="col-bulk">
            <select v-if="emp.id === currentUserId" @change="e => applyBulk(emp.id, e.target.value)"> 
              <option value="">(Set all)</option>
              <option v-for="opt in statusOptions" :key="opt" :value="opt">{{ opt }}</option>
              <option value="">Clear</option>
            </select>
          </td>

          <td v-for="day in weekDays" :key="day.dateStr" class="col-day">
            <div v-if="emp.id === currentUserId" class="cell-editable"> <!-- if the row's employee is the same as the selected employee -->
              <div v-if="checkDay(emp.id, day.dateStr)" class="greyed-out" style="display: flex; justify-content: center; width: 100%;"> <!-- if the day is outside the user's schedule -->
                <span class="status-none">—</span>
              </div>
              <div v-else>
                <select :value="getScheduleStatus(emp.id, day.dateStr)" @change="e => updateDay(emp.id, day.dateStr, e.target.value)">
                  <option value=""></option>
                  <option v-for="opt in statusOptions" :key="opt" :value="opt">{{ opt }}</option> <!-- fetch the status options -->
                </select>
                <div v-if="getScheduleStatus(emp.id, day.dateStr) === 'Other'" class="note-input-wrapper"> <!-- insert a text input if the status is set to "Others" -->
                  <input 
                    type="text" 
                    :value="getScheduleNote(emp.id, day.dateStr)" 
                    @change="e => updateDayNote(emp.id, day.dateStr, e.target.value)" 
                    placeholder="Add note..." 
                    class="note-input"
                  />
                </div>
              </div>
            </div>
            <div v-else class="cell-readonly"> <!-- read-only -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <span v-if="!checkDay(emp.id, day.dateStr) && getScheduleStatus(emp.id, day.dateStr)" 
                      :class="'status-badge status-' + getScheduleClass(getScheduleStatus(emp.id, day.dateStr))"> <!-- sets the status badge class -->
                  {{ getScheduleStatus(emp.id, day.dateStr) }}
                </span>
                <span v-else class="status-none">—</span>
                <span v-if="!checkDay(emp.id, day.dateStr) && getScheduleStatus(emp.id, day.dateStr) === 'Other' && getScheduleNote(emp.id, day.dateStr)" 
                      class="note-display">
                  {{ getScheduleNote(emp.id, day.dateStr) }}
                </span>
              </div>
            </div>
          </td>

        </tr>

      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted, computed } from 'vue';
import { startOfISOWeek, addDays, format } from 'date-fns';
import { apiFetchSchedule, apiGetEmployees, apiUpdateDay, apiApplyBulk, apiGetStatusOptions } from '../api';
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

// Global state injected from App.vue
const currentUserId = inject('currentUserId'); 
const selectedDate = inject('selectedDate');
const loading = inject('isLoading'); 

// Local reactive state
const employees = ref([]);
const schedules = ref([]); // Array of raw database rows
const statusOptions = ref([]);

/**
 * Creates a map to easily find a schedule by combining employee ID and date.
 * Automatically recalculates whenever 'schedules.value' changes.
 */
const schedulesMap = computed(() => { 
  const map = {}; 
  schedules.value.forEach(s => {
    const key = `${s.employee_id}_${s.date}`;
    map[key] = s;
  });
  return map;
});

/**
 * Creates a map to easily find employee details by their ID.
 */
const employeesMap = computed(() => {
  const map = {};
  employees.value.forEach(emp => {
    map[emp.id] = emp; 
  });
  return map;
});

/**
 * Calculates the dates for the currently selected ISO week.
 * @returns {Array} Array of formatted date objects.
 */
const weekDays = computed(() => {
  const start = startOfISOWeek(selectedDate.value); 
  const days = []; 
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i); 
    days.push({
      dateStr: format(d, 'yyyy-MM-dd'),
      name: format(d, 'EEEE'),
      shortDate: format(d, 'd MMM')
    });
  }
  return days;
});

/**
 * Fetches the active employees for the current week range.
 */
const fetchEmployees = async () => { 
  if (!weekDays.value.length) return; 
  
  const weekStart = weekDays.value[0].dateStr; // Monday
  const weekEnd = weekDays.value[6].dateStr;   // Sunday
  
  try {
    employees.value = await apiGetEmployees(false, weekStart, weekEnd);  
  } catch (e) {
    console.error("Error fetching employees:", e);
  }
};

/**
 * Fetches the shifts/schedules for the current week.
 */
const fetchSchedule = async () => {
  if (!weekDays.value.length) return;
  
  loading.value = true; // Triggers the loading spinner in UI
  const startDate = weekDays.value[0].dateStr; 
  const endDate = weekDays.value[6].dateStr; 
  
  try {
    schedules.value = await apiFetchSchedule(startDate, endDate); 
  } catch (e) {
    console.error(e);
    toast.error("Error loading schedule.");
  } finally {
    loading.value = false;
  }
};

// --- Helper Functions ---

const getScheduleStatus = (empId, dateStr) => {
  const key = `${empId}_${dateStr}`;
  const s = schedulesMap.value[key]; 
  return s ? s.status : '';
};

const getScheduleNote = (empId, dateStr) => {
  const key = `${empId}_${dateStr}`;
  const s = schedulesMap.value[key];
  return s ? s.note : '';
};

/**
 * Converts a status string into a valid CSS class name format.
 * (e.g., "Sick Leave" -> "sick-leave")
 */
const getScheduleClass = (status) => {
  if (!status || typeof status !== 'string') return 'none';
  return status.toLowerCase().split('/').join('-');
};

/**
 * Checks if a specific date falls OUTSIDE the employee's working period.
 * @returns {boolean} True if the day should be disabled, false if it's a valid working day.
 */
const checkDay = (empId, dateStr) => {
  const targetEmp = employeesMap.value[empId];
  if (!targetEmp) return true; // Block day if employee data isn't found
  
  const isBeforeStart = targetEmp.startDate && dateStr < targetEmp.startDate;
  const isAfterEnd = targetEmp.endDate && dateStr > targetEmp.endDate;
  
  return isBeforeStart || isAfterEnd;
};

// --- Actions ---

/**
 * Updates the schedule status (and note) for a single day.
 */
const updateDay = async (empId, dateStr, status, note = null) => {
  let existingNote = note; 
  
  // Logic to preserve or clear the note based on the status
  if (note === null) {
      existingNote = getScheduleNote(empId, dateStr); 
      if (status !== 'Other') existingNote = ''; // Clear note if status is not 'Other'
  }

  const targetEmp = employeesMap.value[empId];

  if (!targetEmp || checkDay(empId, dateStr)) {
    toast.warning(`${targetEmp?.name || 'Employee'} isn't working this day!`); 
    return;
  }

  // Optimistic UI Update: update the local array immediately before the API call finishes
  let existingSchedule = schedules.value.find(s => s.employee_id === empId && s.date === dateStr);
  if (existingSchedule) { 
    existingSchedule.status = status;
    existingSchedule.note = existingNote;
  } else { 
    schedules.value.push({ employee_id: empId, date: dateStr, status, note: existingNote });
  }

  try {
    await apiUpdateDay(empId, dateStr, status, existingNote);
  } catch (error) {
    await fetchSchedule(); // Revert local changes if the API fails
    toast.error(error.message || "Error while saving schedule.");
    console.error("API Error in updateDay:", error);
  }
};

/**
 * Wrapper to update only the note without altering the current status.
 */
const updateDayNote = async (empId, dateStr, note) => {
  const status = getScheduleStatus(empId, dateStr); 
  if (!status) return;
  await updateDay(empId, dateStr, status, note);
};

/**
 * Applies a single status to all valid working days in the week for an employee.
 */
const applyBulk = async (empId, status) => {
  const validDates = [];
  
  // Filter out days where the employee is inactive
  for (const day of weekDays.value) {
      if (!checkDay(empId, day.dateStr)) {
          validDates.push(day.dateStr);
      }
  }

  // Optimistic UI update
  validDates.forEach(dateStr => { 
    let existingSchedule = schedules.value.find(s => s.employee_id === empId && s.date === dateStr);
    if (existingSchedule) {
      existingSchedule.status = status; 
    } else {
      schedules.value.push({ employee_id: empId, date: dateStr, status }); 
    }
  });

  try {
    await apiApplyBulk(empId, validDates, status);
  } catch (error) {
    await fetchSchedule(); // Revert on failure
    toast.error("Error while making the bulk change");
    console.error("API Error in applyBulk:", error);
  }
};


// Re-fetch data whenever the user navigates to a different week
watch(selectedDate, () => { 
  fetchEmployees();
  fetchSchedule();
});

// Initial data load when the component mounts
onMounted(async () => {
  fetchEmployees();
  fetchSchedule();
  try {
    statusOptions.value = await apiGetStatusOptions();
  } catch (e) {
    console.error("Error while loading status component:", e);
  }
});
</script>

<style scoped>

.calendar {
  overflow-x: auto;
  padding: 1rem 0;
}

.greyed-out {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(100%)
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

th {
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.day-header {
  display: flex;
  flex-direction: column;
}

.day-name {
  color: var(--text-main);
  font-weight: 600;
  font-size: 0.9rem;
}

.day-date {
  font-size: 0.75rem;
}

tr:hover {
  background-color: rgba(255, 255, 255, 0.02);
}

tr.highlight {
  background-color: rgba(79, 70, 229, 0.1);
}

.col-employee {
  min-width: 150px;
  position: sticky;
  left: 0 !important; /* avoids transparent spaces around the sticky column */
  background-color: var(--card-bg);
  z-index: 1; 
  border-right: none; 
  box-shadow: inset -2px 0 0 var(--border-color); 
}

th.col-employee {
  position: sticky; 
  left: 0 !important;
  background-color: var(--card-bg);
  z-index: 2; 
  border-right: none;
  box-shadow: inset -2px 0 0 var(--border-color);
}

.col-bulk {
  min-width: 120px;
}

.col-day {
  min-width: 130px;
  text-align: center;
}

th.col-day {
  text-align: center;
}

select {
  width: 100%;
  padding: 0.4rem;
  font-size: 0.85rem;
}

.cell-readonly {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 38px;
}

.note-input-wrapper {
  margin-top: 0.25rem;
}

.note-input {
  width: 100%;
  padding: 0.25rem;
  font-size: 0.75rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-main);
  font-family: inherit;
}

.note-display {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  word-break: break-all;
}

@media (max-width: 768px) {
  .col-employee {
    width: 100px !important;
    min-width: 100px !important;
    max-width: 100px !important;
    padding: 0.5rem; /* inner margins */
    font-size: 0.9rem; 
    
    /* new line if text is too long */
    white-space: normal;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th.col-employee { /* smaller header */
    padding: 0.5rem;
    font-size: 0.7rem;
    width: 90px !important;
    min-width: 90px !important;
    max-width: 90px !important;
  }

  /* smaller day columns */
  .col-day {
    min-width: 110px;
    padding: 0.5rem;
  }

  .calendar {
  overflow-x: auto;
  padding: 0.6rem 0;
}
}

</style>
