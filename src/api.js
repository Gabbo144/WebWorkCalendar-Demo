export const API_BASE_URL = import.meta.env.VITE_URL || '';

/**
 * Utility function that handles the fetching and data parsing for every other function in this file.
 * Accepts the API route endpoint to fetch and optional fetch configurations.
 */
async function customFetch(endpoint, options = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Unknown network error.');
  }

  return data;
}

/**
 * Get the status options defined in the Salesforce status__c picklist.
 */
export async function apiGetStatusOptions() {
  return await customFetch('/api/status-options');
}

/**
 * Gets the employee list. 
 * It can include inactive employees or filter the list to only return those who work in a specific week.
 */
export async function apiGetEmployees(includeInactive = false, weekStart = '', weekEnd = '') {
  const params = new URLSearchParams();
  
  // Appends parameters to the URL only if they were provided
  if (includeInactive) params.append('includeInactive', includeInactive);
  if (weekStart) params.append('weekStart', weekStart);
  if (weekEnd) params.append('weekEnd', weekEnd);

  return await customFetch(`/api/employees?${params.toString()}`);
}

/**
 * Create a new employee.
 * @param {Object} newEmp - An object (dictionary) containing the new employee's data (name, startDate, endDate).
 */
export async function apiCreateEmployee(newEmp) { 
  return await customFetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEmp)
  });
}

/**
 * Updates an existing employee using their unique ID.
 * @param {Object} emp - The employee object containing the updated data and the ID.
 */
export async function apiUpdateEmployee(emp) {
  return await customFetch(`/api/employees/${emp.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emp)
  });
}

/**
 * Deletes (or makes inactive) an employee based on their ID.
 * @param {string|number} id - The unique identifier of the employee.
 */
export async function apiDeleteEmployee(id) {
  return await customFetch(`/api/employees/${id}`, {
    method: 'DELETE'
  });
}

// CALENDAR FUNCTIONS

/**
 * Gets the schedule and the shifts for a specific date range (like a week).
 */
export async function apiFetchSchedule(startDate, endDate) {
  return await customFetch(`/api/schedule?startDate=${startDate}&endDate=${endDate}`);
}

/**
 * Updates the daily status of a specific employee for a given date.
 */
export async function apiUpdateDay(empId, dateStr, status, note) {
  return await customFetch(`/api/schedule/day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: empId, date: dateStr, status, note })
  });
}

/**
 * Bulk applies a single status to multiple dates for a specific employee through their ID.
 * @param {string|number} empId - The employee's ID.
 * @param {Array<string>} dates - Array of date strings.
 * @param {string} status - The status to apply to all provided dates.
 */
export async function apiApplyBulk(empId, dates, status) {
  return await customFetch(`/api/schedule/week`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: empId, dates, status })
  });
}