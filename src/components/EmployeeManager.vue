<template>
  <div class="employee-manager glass-panel">
    <div class="header">
      <h2>Manage Employees</h2>
      <label class="toggle">
        <input type="checkbox" v-model="showInactive" @change="fetchEmployees" /> 
        Show Inactive
      </label>
    </div>

    <div class="add-form"> 
      <input type="text" v-model="newEmp.name" placeholder="Employee Name" /> <!-- v-model: immediate updates to the newEmp.name var -->
      <div class="date-group">
        <label>Start:</label>
        <input type="date" v-model="newEmp.startDate" />
      </div>
      <div class="date-group">
        <label>End:</label>
        <input type="date" v-model="newEmp.endDate" />
      </div>
      <button @click="createEmployee" class="btn-primary">Add</button> 
    </div>
    
    <div class="table-responsive">
      <table class="manager-table"> 
        <thead>
          <tr>
            <th>Name</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employees" :key="emp.id"> <!-- table of existing employees -->
            <td><input type="text" v-model="emp.name" /></td>
            <td><input type="date" v-model="emp.startDate" /></td>
            <td><input type="date" v-model="emp.endDate" /></td>
            <td class="actions">
              <button @click="updateEmployee(emp)" class="btn-save">Save</button>
              <button @click="deleteEmployee(emp.id)" class="btn-delete">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { 
  apiGetEmployees, 
  apiCreateEmployee, 
  apiUpdateEmployee, 
  apiDeleteEmployee, 
} from '../api';
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

// Reactive references: when data inside ref() changes, dom gets updated
const employees = ref([]); // Main list of employees fetched from the API, bridge? between Frontend and Backend for employees
const showInactive = ref(false); // Toggle state for showing inactive employees
const newEmp = ref({ name: '', startDate: '', endDate: '' }); // Holds the data for the new employee creation form

/**
 * Fetches the list of employees from the backend.
 * Automatically passes the current state of the showInactive toggle.
 */
const fetchEmployees = async () => { 
  try {
    employees.value = await apiGetEmployees(showInactive.value);
    // .value give you access to the data inside a ref() so you can see it and edit it. 
  } catch (error) {
    console.error("Error fetching employees:", error);
    toast.error("Failed to load employees.");
  }
};

/**
 * Validates and creates a new employee.
 * Refreshes the employee list on success.
 */
const createEmployee = async () => { 
  // Ensure name is provided
  if (!newEmp.value.name.trim()) {
    toast.warning('Employee name is required.');
    return;
  }

  // Check if dates are valid (either missing, or start is before/equal to end)
  const isValidDate = !newEmp.value.startDate || !newEmp.value.endDate || newEmp.value.startDate <= newEmp.value.endDate;
  
  if (isValidDate) { 
    try {
      await apiCreateEmployee(newEmp.value); 
      // Reset the input fields
      newEmp.value = { name: '', startDate: '', endDate: '' }; 
      await fetchEmployees();
      toast.success("Employee created successfully!");
    } catch(error) {
      toast.error(error.message || "Error while creating the employee.");
    }
  } else {
    toast.warning('The start date cannot be after the end date.', { autoClose: 5000 });
  }
};

/**
 * Validates and updates an existing employee's data.
 * @param {Object} emp - The employee object to update.
 */
const updateEmployee = async (emp) => {  
  // Check if dates are valid (either missing, or start is before/equal to end)
  const isValidDate = !emp.startDate || !emp.endDate || emp.startDate <= emp.endDate;
  
  if (isValidDate) {  
    try {
      await apiUpdateEmployee(emp); 
      toast.success('Saved!', { autoClose: 5000 });
    } catch (error) {
      toast.error(error.message || "Error while saving the employee.");
    }
  } else {
    toast.warning('The start date cannot be after the end date.', { autoClose: 5000 });  
  }
};

/**
 * Prompts for confirmation and deletes (deactivates) an employee.
 * @param {string|number} id - The ID of the employee to delete.
 */
const deleteEmployee = async (id) => { 
  if (!confirm('Are you sure you want to delete this employee?')) return;
  
  try {
    await apiDeleteEmployee(id); 
    await fetchEmployees();
    toast.success("Employee deleted successfully!");
  } catch (error) {
    toast.error(error.message || "Error while deleting the employee.");
  }
};

// Fetch employees as soon as the component mounts
onMounted(() => {
  fetchEmployees();
});
</script>

<style scoped>
.employee-manager {
  padding: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.add-form {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  align-items: center;
  background: var(--card-bg);
  padding: 1rem;
  border-radius: var(--border-radius);
}

.date-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

input[type="text"], input[type="date"] {
  padding: 0.5rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-main);
  font-family: inherit;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  padding: 0.5rem 1rem;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.manager-table {
  width: 100%;
  border-collapse: collapse;
}

.manager-table td.actions {
  min-width: 120px; /* Less space needed for the actions column */
}

.manager-table th, .manager-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  min-width: 160px; /* Prevents input fields from being squeezed */
}

.actions {
  gap: 0.5rem;
}

.btn-save {
  background: var(--success);
  color: white;
  padding: 0.4rem 0.8rem;
}

.btn-delete {
  background: #ef4444;
  color: white;
  padding: 0.4rem 0.8rem;
  margin-left: 5px;
}

@media (max-width: 768px) {
  .add-form {
    flex-direction: column; 
    align-items: stretch; /* Fill the screen on mobile devices */
  }
  
  .date-group {
    justify-content: space-between;
  }
}
</style>