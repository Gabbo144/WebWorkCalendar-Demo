const sfdc = require('./db');

/**
 * Retrieves all active employees from Salesforce.
 * @returns {Promise<Array>} Array of formatted employee objects.
 */
async function getEmployees() {
  // SOQL (Salesforce Object Query Language): the fields we want to extract
  const soql = "SELECT Id, Name, start_date__c, end_date__c FROM employee__c WHERE Is_Active__c = true ORDER BY Name ASC"; 
  
  const result = await sfdc.query(soql); // Sends the query to Salesforce
  
  if (!result.records) {
    console.error("Salesforce error:", result);
    throw new Error("Query failed.");
  }

  // result.records is the raw array from Salesforce. 
  // We map over it to format each record into a cleaner JavaScript object (array of objects/dictionaries).
  return result.records.map(record => ({
    id: record.Id, 
    name: record.Name,
    startDate: record.start_date__c || null,
    endDate: record.end_date__c || null
  })); 
}

/**
 * Creates a new employee record in Salesforce.
 * @param {string} name - Employee's full name.
 * @param {string|null} startDate - Start date (YYYY-MM-DD).
 * @param {string|null} endDate - End date (YYYY-MM-DD).
 * @returns {Promise<string>} The Salesforce ID of the newly created employee.
 */
async function createEmployee(name, startDate, endDate) {
  const record = { 
    Name: name.substring(0, 80), // Standard Salesforce Name fields have an 80-character limit
    start_date__c: startDate || null, 
    end_date__c: endDate || null
  };
  
  // Call create with the table name and data payload
  const result = await sfdc.create('employee__c', record); 
  
  if (result instanceof Error) {
    // Try to extract the specific error message from the Salesforce payload
    const sfMessage = result.response?.data?.[0]?.message || result.message; 
    throw new Error(sfMessage);
  }
  
  return result.id; // Returns the newly created employee's Salesforce ID
}

/**
 * Updates an existing employee in Salesforce.
 * @param {string} name - Employee's full name.
 * @param {string|null} startDate - Start date (YYYY-MM-DD).
 * @param {string|null} endDate - End date (YYYY-MM-DD).
 * @param {string} id - The Salesforce Record ID.
 * @returns {Promise<string>} Success message.
 */
async function updateEmployee(name, startDate, endDate, id) {
  const record = {
    Name: name.substring(0, 80), 
    start_date__c: startDate || null,
    end_date__c: endDate || null
  };
  
  // sfdc.update requires ('tableName', recordId, newData) - recordId is the unique 15/18 char string that Salesforce generates for every record
  await sfdc.update('employee__c', id, record); 
  
  return "Employee successfully updated.";
}

/**
 * Soft-deletes an employee by setting them as inactive.
 * @param {string} id - The Salesforce Record ID.
 * @returns {Promise<string>} Success message.
 */
async function deleteEmployee(id) {
  // Update Is_Active__c to false (Logical/Soft delete)
  const record = { Is_Active__c: false };
  await sfdc.update('employee__c', id, record);
  return "Employee successfully deactivated.";
}

/**
 * Gets the schedule/shifts for all employees within a specific date range.
 * @param {string} startDate - Start date (YYYY-MM-DD).
 * @param {string} endDate - End date (YYYY-MM-DD).
 * @returns {Promise<Array>} Array of schedule records.
 */
async function getSchedule(startDate, endDate) {
  // employee_id__c is the Master-Detail or Lookup relationship connecting the schedule/shift to the employee
  const soql = `SELECT Id, employee_id__c, date__c, status__c, note__c 
                FROM schedule__c 
                WHERE date__c >= ${startDate} AND date__c <= ${endDate}`; 
  
  let allRecords = []; // Array to hold all results (Salesforce limits a single query response to 2000 records)
  let isNext = false;
  let currentQuery = soql;

  do {
    // On the first iteration, we pass the SOQL query and 'false'.
    // On subsequent iterations (pagination), we pass the nextRecordsUrl and 'true'.
    const result = await sfdc.query(currentQuery, isNext); 
    
    if (!result.records) {
      console.error("SALESFORCE ERROR:", result);
      throw new Error("Query failed.");
    }

    // Append the results of this "page" to the total data array
    allRecords = allRecords.concat(result.records);

    // Salesforce responds with "done: false" and a URL if there are still more records to fetch
    if (!result.done && result.nextRecordsUrl) {
      currentQuery = result.nextRecordsUrl;
      isNext = true;
    } else {
      isNext = false;
    }
  } while (isNext);

  return allRecords.map(record => ({ 
    id: record.Id,
    employee_id: record.employee_id__c,
    date: record.date__c,
    status: record.status__c,
    note: record.note__c || ''
  }));
}

/**
 * Updates or inserts a single day's schedule for an employee.
 * @param {string} employee_id - The employee's Salesforce ID.
 * @param {string} date - The date of the shift (YYYY-MM-DD).
 * @param {string} status - The attendance status.
 * @param {string} note - Optional notes for the day.
 * @returns {Promise<string>} Success message.
 */
async function updateDay(employee_id, date, status, note) {
  const extId = `${employee_id}_${date}`; // Join ID and date to create a unique External ID
  
  const record = { 
    employee_id__c: employee_id, 
    date__c: date,
    status__c: status || null,
    note__c: note || null,
    ext_id_date__c: extId // The unique key we just generated
  };

  // Upsert uses the specified External ID field to prevent duplicates.
  // If a record with this key exists, it updates it; otherwise, it creates a new one.
  /** why?
   * 1. identifies empty calendar cells before a Salesforce ID even exists
   * 2. prevents duplicate record creation
   * 3. better performance
   */
  const result = await sfdc.upsert('schedule__c', 'ext_id_date__c', [record]);
  
  if (result instanceof Error) { 
    // If the API call fails before reaching the database, sfdc2.js returns an Error object
    throw result;
  }
  
  // We send an array of data, so Salesforce responds with an array of results.
  // Example of a failure response: [ { success: false, errors: [ { message: "Invalid ID" } ] } ]
  if (Array.isArray(result) && result[0] && result[0].success === false) { 
    throw new Error("Salesforce error: " + result[0].errors[0].message); 
  }
  
  return "Successfully updated day.";
}

/**
 * Bulk updates an employee's schedule for multiple dates (e.g., a whole week).
 * @param {string} employee_id - The employee's Salesforce ID.
 * @param {Array<string>} dates - Array of date strings (e.g., 7 dates).
 * @param {string} status - The status to apply to all provided dates.
 * @returns {Promise<string>} Success message.
 */
async function updateWeek(employee_id, dates, status) { 
  // .map turns the array of date strings into an array of JSON objects with unique external IDs
  const records = dates.map(date => ({ 
    employee_id__c: employee_id,
    date__c: date,
    status__c: status || null,
    note__c: null, 
    ext_id_date__c: `${employee_id}_${date}` 
  }));
  
  // Salesforce processes the entire array simultaneously via the upsert call
  const result = await sfdc.upsert('schedule__c', 'ext_id_date__c', records); // all-in-one thanks to sfdc2
  
  if (result instanceof Error) { 
    throw result;
  }
  
  // Check the first element for an error (assuming bulk failure logic)
  if (Array.isArray(result) && result[0] && result[0].success === false) { 
    throw new Error("Salesforce error: " + result[0].errors[0].message);
  }
  
  return "Week updated successfully.";
}

/**
 * Fetches the available picklist values for the status__c field in Salesforce.
 * @returns {Promise<Array<string>>} Array of status options.
 */
async function getStatusOptions() {
  const describe = await sfdc.objectFields('schedule__c'); // get the fields from the table "schedule"
  
  if (!describe || !describe.fields) {
    console.error("Incomplete describe response:", describe);
    throw new Error("Unable to load metadata from Salesforce.");
  }

  // Look for the status__c field in the array of fields returned by the describe call
  const statusField = describe.fields.find(f => f.name === 'status__c');
  
  if (!statusField || !statusField.picklistValues) {
    throw new Error("Field status__c not found or not configured as a Picklist.");
  }

  // Maps the array, returning just the text value of every picklist option
  return statusField.picklistValues.map(p => p.value);
}

module.exports = { 
  getEmployees, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee, 
  getSchedule, 
  updateDay, 
  updateWeek, 
  getStatusOptions 
};