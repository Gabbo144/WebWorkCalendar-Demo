const path = require('path');
const sfdc = require('./sfdc2.js');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Configuration object for Salesforce authentication.
 * Stores the file path for the token and the client credentials from environment variables.
 */
const authConfig = {
  sfdcTokenFile: './token.json', 
  sfdcClientId: process.env.CLIENT_ID,
  sfdcClientSecret: process.env.CLIENT_SECRET
};

/**
 * Initializes the connection to Salesforce.
 * Handles the environment setup, credential assignment, and the OAuth2 token lifecycle.
 * @returns {Promise<void>}
 */
async function initDb() {
  // Set the environment to Sandbox (use sfdc.setProductionBaseUrl() in production, as it uses login.salesforce.com isntead of test.salesforce.com)
  sfdc.setSandboxBaseUrl(); 
  
  // Apply configuration settings
  sfdc.setTokenFile(authConfig.sfdcTokenFile); // Reused the variable instead of hardcoding
  sfdc.setClientId(authConfig.sfdcClientId);
  sfdc.setClientSecret(authConfig.sfdcClientSecret);

  // 1. Look for an existing token in the environment variables
  if (process.env.SF_TOKEN) {
    console.log('Token found in .env');
    try {
      sfdc.credentials = JSON.parse(process.env.SF_TOKEN);
    } catch (err) {
      console.error('Error parsing SF_TOKEN from .env:', err);
    }
  } 
  // 2. If not in .env, look for it in token.json. If that fails too, start the login process.
  else if (!(await sfdc.getSalesforceToken())) {
    console.log('No token found. Starting OAuth2 process...');
    await sfdc.initToken((loginUrl) => {
      console.log(`\n=== OPEN THIS LINK TO AUTHENTICATE ===\n${loginUrl}\n`);
    });
  } else {
    // Token was successfully found in token.json
    console.log('Token loaded from token.json.');
  }

  // Verify if the current token is valid; if it is expired, refresh it
  await sfdc.checkToken();
  console.log('Successfully connected to Salesforce.');
}

// Store the initialization promise so other modules (like the Express server.js) can await it before starting
sfdc.initPromise = initDb();

module.exports = sfdc;