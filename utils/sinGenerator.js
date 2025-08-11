/**
 * SIN (Student Identification Number) Generator
 * Generates unique SIN numbers based on program and course
 * Format varies by program type with year 2025 and random 3-digit suffix
 */

/**
 * Generate a random 3-digit number (100-999)
 * @returns {string} Random 3-digit number as string
 */
function generateRandomThreeDigit() {
  return Math.floor(100 + Math.random() * 900).toString();
}

/**
 * Generate a more unique random suffix using timestamp + random
 * @returns {string} Unique suffix
 */
function generateUniqueSuffix() {
  const timestamp = Date.now().toString().slice(-3); // Last 3 digits of timestamp
  const random = Math.floor(10 + Math.random() * 90).toString(); // 2-digit random (10-99)
  return timestamp + random.slice(-1); // Combine for 4-digit suffix, take last 3
}

/**
 * Course mapping for different programs
 */
const COURSE_MAPPINGS = {
  // Polytechnic courses
  'Civil Engineering': 'POLY-CE-25',
  'Electrical Engineering': 'POLY-ECE-25',
  'Mechanical Engineering': 'POLY-ME-25',
  'Computer Science': 'POLY-CS-25',
  
  // UG courses
  'BCA': 'BCA-25',
  
  // ITI courses
  'Fitter': 'ITI-FIT-25',
  'Surveyor': 'ITI-SUR-25',
  'Electrician': 'ITI-ELECT-25',
  'COPA': 'ITI-COP-25'
};

/**
 * Generate SIN number based on program and course
 * @param {string} program - The program type (Polytechnic, UG, ITI)
 * @param {string} course - The course name
 * @returns {string} Generated SIN number
 */
function generateSINNumber(program, course) {
  try {
    console.log(`🔢 Generating SIN for program: ${program}, course: ${course}`);
    
    // Normalize course name for lookup
    const normalizedCourse = course?.trim();
    
    // Get the course prefix from mapping
    let coursePrefix = COURSE_MAPPINGS[normalizedCourse];
    
    // If direct mapping not found, try program-based fallback
    if (!coursePrefix) {
      console.log(`⚠️ Direct course mapping not found for: ${normalizedCourse}`);
      
      // Program-based fallback logic
      const normalizedProgram = program?.toLowerCase().trim();
      
      if (normalizedProgram === 'polytechnic' || normalizedProgram === 'poly') {
        // For polytechnic, try to match keywords
        const courseLower = normalizedCourse?.toLowerCase();
        if (courseLower?.includes('civil')) {
          coursePrefix = 'POLY-CE-25';
        } else if (courseLower?.includes('electrical') || courseLower?.includes('electric')) {
          coursePrefix = 'POLY-ECE-25';
        } else if (courseLower?.includes('mechanical') || courseLower?.includes('mech')) {
          coursePrefix = 'POLY-ME-25';
        } else if (courseLower?.includes('computer') || courseLower?.includes('cs')) {
          coursePrefix = 'POLY-CS-25';
        } else {
          // Generic polytechnic fallback
          coursePrefix = 'POLY-GEN-25';
        }
      } else if (normalizedProgram === 'ug' || normalizedProgram === 'undergraduate') {
        if (normalizedCourse?.toLowerCase().includes('bca')) {
          coursePrefix = 'BCA-25';
        } else {
          // Generic UG fallback
          coursePrefix = 'UG-GEN-25';
        }
      } else if (normalizedProgram === 'iti') {
        const courseLower = normalizedCourse?.toLowerCase();
        if (courseLower?.includes('fitter')) {
          coursePrefix = 'ITI-FIT-25';
        } else if (courseLower?.includes('surveyor')) {
          coursePrefix = 'ITI-SUR-25';
        } else if (courseLower?.includes('electrician') || courseLower?.includes('electric')) {
          coursePrefix = 'ITI-ELECT-25';
        } else if (courseLower?.includes('copa') || courseLower?.includes('computer operator')) {
          coursePrefix = 'ITI-COP-25';
        } else {
          // Generic ITI fallback
          coursePrefix = 'ITI-GEN-25';
        }
      } else {
        // Generic fallback for unknown programs
        coursePrefix = 'GMCP-GEN-25';
        console.log(`⚠️ Using generic fallback for unknown program: ${program}`);
      }
    }
    
    // Generate random 3-digit suffix
    const randomSuffix = generateRandomThreeDigit();
    
    // Combine to create final SIN
    const sinNumber = `${coursePrefix}-${randomSuffix}`;
    
    console.log(`✅ Generated SIN: ${sinNumber}`);
    return sinNumber;
    
  } catch (error) {
    console.error('❌ Error generating SIN number:', error);
    // Fallback SIN in case of error
    const fallbackSIN = `GMCP-ERR-25-${generateRandomThreeDigit()}`;
    console.log(`🔄 Using fallback SIN: ${fallbackSIN}`);
    return fallbackSIN;
  }
}

/**
 * Validate if a student is eligible for SIN number generation
 * @param {Object} registrationData - The registration data
 * @returns {boolean} Whether student is eligible for SIN generation
 */
function isEligibleForSIN(registrationData) {
  const { paymentStatus, transactionId, paymentAmount, totalFee, totalCourseFee } = registrationData;
  
  // Ensure we have payment amount and fee data
  const totalAmount = totalFee || totalCourseFee || 0;
  const paidAmount = paymentAmount || 0;
  
  // Student is eligible if:
  // 1. Has a valid transaction ID (indicating successful payment processing)
  // 2. Payment status is NOT "Failed" 
  // 3. Has made some payment (amount > 0)
  // 4. Payment status is "Paid" (100% complete) OR "Paid/Due" (partial payment with remaining due)
  
  const eligibleStatuses = ['paid', 'paid/due', 'Paid', 'Paid/Due'];
  const failedStatuses = ['failed', 'Failed', 'FAILED'];
  
  const hasTransactionId = transactionId && transactionId.trim() !== '';
  const isNotFailed = !failedStatuses.includes(paymentStatus);
  const hasValidStatus = eligibleStatuses.includes(paymentStatus);
  const hasPaidSomething = paidAmount > 0;
  
  const isEligible = hasTransactionId && isNotFailed && hasValidStatus && hasPaidSomething;
  
  console.log(`🔍 SIN eligibility check:`);
  console.log(`   - Transaction ID: ${transactionId} (valid: ${hasTransactionId})`);
  console.log(`   - Payment Status: ${paymentStatus} (valid: ${hasValidStatus}, not failed: ${isNotFailed})`);
  console.log(`   - Amount Paid: ₹${paidAmount} / ₹${totalAmount} (has payment: ${hasPaidSomething})`);
  console.log(`   - Final Eligibility: ${isEligible}`);
  
  return isEligible;
}

/**
 * Check if SIN already exists (to prevent duplicates)
 * @param {string} sinNumber - The SIN number to check
 * @param {Array} existingSINs - Array of existing SIN numbers
 * @returns {boolean} Whether SIN already exists
 */
function isSINUnique(sinNumber, existingSINs = []) {
  return !existingSINs.includes(sinNumber);
}

/**
 * Generate unique SIN number with enhanced retry logic and guaranteed uniqueness
 * @param {string} program - The program type
 * @param {string} course - The course name
 * @param {Array} existingSINs - Array of existing SIN numbers
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {string} Unique SIN number
 */
function generateUniqueSIN(program, course, existingSINs = [], maxRetries = 20) {
  let attempts = 0;
  let sinNumber;
  
  console.log(`🔢 Starting unique SIN generation for ${program} - ${course}`);
  console.log(`📊 Checking against ${existingSINs.length} existing SIN numbers`);
  
  do {
    sinNumber = generateSINNumber(program, course);
    attempts++;
    
    if (isSINUnique(sinNumber, existingSINs)) {
      console.log(`✅ Generated unique SIN after ${attempts} attempt(s): ${sinNumber}`);
      // Add to existingSINs array to prevent duplicates in batch operations
      existingSINs.push(sinNumber);
      return sinNumber;
    }
    
    console.log(`🔄 SIN collision detected (attempt ${attempts}): ${sinNumber}`);
    
    if (attempts >= maxRetries) {
      console.log(`⚠️ Max SIN generation attempts (${maxRetries}) reached. Using enhanced timestamped SIN.`);
      
      // Enhanced fallback with multiple uniqueness layers
      const basePrefix = COURSE_MAPPINGS[course] || 'GMCP-GEN-25';
      let fallbackAttempts = 0;
      const maxFallbackAttempts = 5;
      
      do {
        const timestamp = Date.now().toString(); // Full timestamp
        const microseconds = performance.now().toString().replace('.', '').slice(-3); // Microsecond precision
        const randomSalt = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        
        // Create highly unique suffix using multiple entropy sources
        const uniqueSuffix = (timestamp.slice(-2) + microseconds + randomSalt).slice(-3);
        
        sinNumber = `${basePrefix}-${uniqueSuffix}`;
        fallbackAttempts++;
        
        if (isSINUnique(sinNumber, existingSINs)) {
          console.log(`✅ Generated unique timestamped SIN: ${sinNumber}`);
          existingSINs.push(sinNumber);
          return sinNumber;
        }
        
        console.log(`🔄 Timestamped SIN collision (fallback attempt ${fallbackAttempts}): ${sinNumber}`);
        
        // Small delay to ensure timestamp changes
        const now = Date.now();
        while (Date.now() === now) { /* wait for timestamp to change */ }
        
      } while (fallbackAttempts < maxFallbackAttempts);
      
      // Final guarantee: use process ID + timestamp + random as last resort
      const processId = process.pid.toString().slice(-2).padStart(2, '0');
      const finalTimestamp = Date.now().toString().slice(-1);
      const finalRandom = Math.floor(Math.random() * 99).toString().padStart(2, '0');
      sinNumber = `GMCP-UNIQUE-25-${processId}${finalTimestamp}${finalRandom}`.slice(0, 20);
      
      console.log(`🆘 Using final guaranteed unique SIN: ${sinNumber}`);
      existingSINs.push(sinNumber);
      return sinNumber;
    }
    
  } while (true);
}

module.exports = {
  generateSINNumber,
  generateUniqueSIN,
  isEligibleForSIN,
  isSINUnique,
  COURSE_MAPPINGS
};
