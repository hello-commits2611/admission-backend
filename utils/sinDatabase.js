/**
 * Database helper functions for SIN number management
 * Handles both Firebase Firestore and local JSON storage
 */

const fs = require('fs');
const path = require('path');

/**
 * Get all existing SIN numbers from the database
 * @param {Object} firestore - Firestore instance (null if not available)
 * @param {boolean} firebaseInitialized - Whether Firebase is initialized
 * @returns {Promise<Array>} Array of existing SIN numbers
 */
async function getExistingSINNumbers(firestore, firebaseInitialized) {
  const existingSINs = [];
  
  try {
    if (firebaseInitialized && firestore) {
      console.log('🔍 Fetching existing SIN numbers from Firebase...');
      
      // Query Firestore for all registrations with SIN numbers
      const snapshot = await firestore.collection('registrations')
        .where('sinNumber', '!=', null)
        .select('sinNumber')
        .get();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.sinNumber) {
          existingSINs.push(data.sinNumber);
        }
      });
      
      console.log(`📊 Found ${existingSINs.length} existing SIN numbers in Firebase`);
      
    } else {
      console.log('🔍 Fetching existing SIN numbers from local storage...');
      
      // Read from local JSON file
      const registrationsFile = path.join(__dirname, '..', 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          const registrations = JSON.parse(fileContent);
          
          registrations.forEach(registration => {
            if (registration.sinNumber) {
              existingSINs.push(registration.sinNumber);
            }
          });
          
          console.log(`📊 Found ${existingSINs.length} existing SIN numbers in local storage`);
          
        } catch (error) {
          console.error('❌ Error reading local registrations file:', error);
        }
      } else {
        console.log('📁 No local registrations file found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching existing SIN numbers:', error);
  }
  
  return existingSINs;
}

/**
 * Update registration with SIN number in database
 * @param {string} registrationId - The registration ID
 * @param {string} sinNumber - The SIN number to assign
 * @param {Object} firestore - Firestore instance (null if not available)
 * @param {boolean} firebaseInitialized - Whether Firebase is initialized
 * @returns {Promise<boolean>} Success status
 */
async function updateRegistrationWithSIN(registrationId, sinNumber, firestore, firebaseInitialized) {
  try {
    let success = false;
    
    // Try Firebase first if available
    if (firebaseInitialized && firestore) {
      try {
        const admin = require('firebase-admin');
        
        await firestore.collection('registrations').doc(registrationId).update({
          sinNumber: sinNumber,
          sinGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ SIN number ${sinNumber} assigned to registration ${registrationId} in Firebase`);
        success = true;
        
      } catch (firebaseError) {
        console.error('❌ Firebase SIN update failed:', firebaseError.message);
        console.log('📁 Falling back to local storage update...');
      }
    }
    
    // If Firebase failed or not available, update local storage
    if (!success) {
      const registrationsFile = path.join(__dirname, '..', 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          let registrations = JSON.parse(fileContent);
          
          // Find and update the registration
          const registrationIndex = registrations.findIndex(reg => reg.id === registrationId);
          
          if (registrationIndex !== -1) {
            registrations[registrationIndex].sinNumber = sinNumber;
            registrations[registrationIndex].sinGeneratedAt = new Date().toISOString();
            registrations[registrationIndex].updatedAt = new Date().toISOString();
            
            // Save back to file
            fs.writeFileSync(registrationsFile, JSON.stringify(registrations, null, 2));
            console.log(`✅ SIN number ${sinNumber} assigned to registration ${registrationId} in local storage`);
            success = true;
            
          } else {
            console.error(`❌ Registration ${registrationId} not found in local storage`);
          }
          
        } catch (error) {
          console.error('❌ Error updating local storage with SIN:', error);
        }
      }
    }
    
    return success;
    
  } catch (error) {
    console.error('❌ Error updating registration with SIN:', error);
    return false;
  }
}

/**
 * Get all registrations eligible for SIN generation (paid but no SIN assigned)
 * @param {Object} firestore - Firestore instance (null if not available)
 * @param {boolean} firebaseInitialized - Whether Firebase is initialized
 * @returns {Promise<Array>} Array of registrations eligible for SIN generation
 */
async function getEligibleRegistrationsForSIN(firestore, firebaseInitialized) {
  const eligibleRegistrations = [];
  
  try {
    if (firebaseInitialized && firestore) {
      console.log('🔍 Fetching registrations eligible for SIN from Firebase...');
      
      // Query for paid registrations without SIN numbers
      const snapshot = await firestore.collection('registrations')
        .where('paymentStatus', 'in', ['paid', 'Paid', 'paid/due', 'Paid/Due'])
        .get();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only include if has transaction ID and no SIN assigned
        if (data.transactionId && !data.sinNumber) {
          eligibleRegistrations.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      console.log(`📊 Found ${eligibleRegistrations.length} registrations eligible for SIN in Firebase`);
      
    } else {
      console.log('🔍 Fetching registrations eligible for SIN from local storage...');
      
      const registrationsFile = path.join(__dirname, '..', 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          const registrations = JSON.parse(fileContent);
          
          registrations.forEach(registration => {
            const eligibleStatuses = ['paid', 'Paid', 'paid/due', 'Paid/Due'];
            // Only include if paid, has transaction ID, and no SIN assigned
            if (eligibleStatuses.includes(registration.paymentStatus) && 
                registration.transactionId && 
                !registration.sinNumber) {
              eligibleRegistrations.push(registration);
            }
          });
          
          console.log(`📊 Found ${eligibleRegistrations.length} registrations eligible for SIN in local storage`);
          
        } catch (error) {
          console.error('❌ Error reading local registrations file:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching eligible registrations for SIN:', error);
  }
  
  return eligibleRegistrations;
}

/**
 * Verify SIN uniqueness across the entire database
 * @param {string} sinNumber - SIN number to verify
 * @param {Object} firestore - Firestore instance (null if not available)
 * @param {boolean} firebaseInitialized - Whether Firebase is initialized
 * @returns {Promise<boolean>} True if SIN is unique, false if already exists
 */
async function verifySINUniqueness(sinNumber, firestore, firebaseInitialized) {
  try {
    console.log(`🔍 Verifying SIN uniqueness: ${sinNumber}`);
    
    if (firebaseInitialized && firestore) {
      // Check Firebase for any existing SIN
      const snapshot = await firestore.collection('registrations')
        .where('sinNumber', '==', sinNumber)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        console.log(`❌ SIN ${sinNumber} already exists in Firebase`);
        return false;
      }
      
      console.log(`✅ SIN ${sinNumber} is unique in Firebase`);
      return true;
      
    } else {
      // Check local storage
      const registrationsFile = path.join(__dirname, '..', 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          const registrations = JSON.parse(fileContent);
          
          const existingRegistration = registrations.find(reg => reg.sinNumber === sinNumber);
          
          if (existingRegistration) {
            console.log(`❌ SIN ${sinNumber} already exists in local storage for student: ${existingRegistration.studentName}`);
            return false;
          }
          
          console.log(`✅ SIN ${sinNumber} is unique in local storage`);
          return true;
          
        } catch (error) {
          console.error('❌ Error reading local registrations for SIN verification:', error);
          return true; // Assume unique if can't read file
        }
      } else {
        console.log(`✅ SIN ${sinNumber} is unique (no local storage file exists)`);
        return true;
      }
    }
    
  } catch (error) {
    console.error('❌ Error verifying SIN uniqueness:', error);
    return true; // Assume unique if verification fails (better to allow than block)
  }
}

/**
 * Enhanced function to update registration with SIN - includes pre-verification
 * @param {string} registrationId - The registration ID
 * @param {string} sinNumber - The SIN number to assign
 * @param {Object} firestore - Firestore instance (null if not available)
 * @param {boolean} firebaseInitialized - Whether Firebase is initialized
 * @returns {Promise<boolean>} Success status
 */
async function updateRegistrationWithSINSafe(registrationId, sinNumber, firestore, firebaseInitialized) {
  try {
    // First verify the SIN is truly unique
    const isUnique = await verifySINUniqueness(sinNumber, firestore, firebaseInitialized);
    
    if (!isUnique) {
      console.error(`❌ CRITICAL: Attempted to assign duplicate SIN ${sinNumber} to registration ${registrationId}`);
      return false;
    }
    
    // If unique, proceed with the original update function
    return await updateRegistrationWithSIN(registrationId, sinNumber, firestore, firebaseInitialized);
    
  } catch (error) {
    console.error('❌ Error in safe SIN update:', error);
    return false;
  }
}

module.exports = {
  getExistingSINNumbers,
  updateRegistrationWithSIN,
  updateRegistrationWithSINSafe,
  getEligibleRegistrationsForSIN,
  verifySINUniqueness
};
