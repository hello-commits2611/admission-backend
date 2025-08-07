// Course options for different programs
const courseOptions = {
  polytechnic: ["Civil Engineering", "Electrical Engineering", "Mechanical Engineering", "Computer Science Engineering"],
  ug: ["BCA (Bachelor of Computer Applications)"],
  iti: ["Fitter", "Electrician", "COPA (Computer Operator and Programming Assistant)", "Surveyor"],
  others: ["Not Applicable"]
};

// Function to update course options based on selected program
function updateCourses() {
  const programSelect = document.getElementById("program");
  const courseSelect = document.getElementById("course");
  
  if (!programSelect || !courseSelect) {
    console.error("Program or Course select elements not found");
    return;
  }

  const selectedProgram = programSelect.value;
  const options = courseOptions[selectedProgram] || [];

  // Clear previous options
  courseSelect.innerHTML = '<option value="">--Select Your Branch--</option>';

  // Add new options
  options.forEach(course => {
    const option = document.createElement("option");
    option.value = course.toLowerCase().replace(/\s+/g, "_");
    option.textContent = course;
    courseSelect.appendChild(option);
  });
}

// Make updateCourses function globally available
window.updateCourses = updateCourses;

// Function to handle "Same as Permanent Address" checkbox
function handleAddressCheckbox() {
  const checkbox = document.querySelector('input[type="checkbox"]');
  const permanentAddress = document.querySelector('input[placeholder="Enter permanent address"]');
  const correspondenceAddress = document.querySelector('input[placeholder="Enter correspondence address"]');
  
  if (checkbox && permanentAddress && correspondenceAddress) {
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        correspondenceAddress.value = permanentAddress.value;
        correspondenceAddress.disabled = true;
      } else {
        correspondenceAddress.disabled = false;
        correspondenceAddress.value = '';
      }
    });
    
    // Update correspondence address when permanent address changes
    permanentAddress.addEventListener('input', function() {
      if (checkbox.checked) {
        correspondenceAddress.value = this.value;
      }
    });
  }
}

// Optimized file validation
function validateFile(file, maxSizeMB = 5) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const maxSize = maxSizeMB * 1024 * 1024;
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Please upload JPG, PNG, or PDF files only.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: ${maxSizeMB}MB.`);
  }
  
  return true;
}

// Simplified progress tracking
function showUploadProgress(message) {
  let progressDiv = document.getElementById('upload-status');
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.id = 'upload-status';
    progressDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #003349;
      color: white;
      padding: 15px 25px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      font-weight: bold;
    `;
    document.body.appendChild(progressDiv);
  }
  progressDiv.textContent = message;
}

function hideUploadProgress() {
  const progressDiv = document.getElementById('upload-status');
  if (progressDiv) {
    document.body.removeChild(progressDiv);
  }
}

// Optimized upload function using secure backend API
async function uploadFile(file, fieldName) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fieldName', fieldName);
    
    const xhr = new XMLHttpRequest();
    
    // Reduced timeout to 2 minutes
    const timeout = setTimeout(() => {
      xhr.abort();
      reject(new Error('Upload timeout. Please check your internet connection.'));
    }, 120000);
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        if (progress % 25 === 0) { // Update every 25%
          showUploadProgress(`Uploading files... ${progress}%`);
        }
      }
    });
    
    xhr.addEventListener('load', () => {
      clearTimeout(timeout);
      
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve({
              name: response.file.name,
              size: response.file.size,
              type: response.file.type,
              path: response.file.path, // Only store the secure path - NO public URLs
              filename: response.file.filename,
              storage: response.file.storage
            });
          } else {
            reject(new Error(response.error || 'Upload failed'));
          }
        } catch (error) {
          reject(new Error('Invalid server response'));
        }
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Network error during upload'));
    });
    
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

// Optimized form submission with concurrent uploads
async function handleFormSubmission(event) {
  event.preventDefault();
  
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  // Quick validation
  const requiredFields = form.querySelectorAll('[required]');
  for (const field of requiredFields) {
    if (field.type === 'file') {
      if (field.files.length === 0) {
        alert(`Please select a file for ${field.name.replace('File', '').replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        field.focus();
        return;
      }
      try {
        validateFile(field.files[0]);
      } catch (error) {
        alert(error.message);
        field.focus();
        return;
      }
    } else if (!field.value.trim()) {
      alert(`Please fill in the ${field.name.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
      field.focus();
      return;
    }
  }
  
  // Form is ready for submission - no external dependencies needed
  
  submitButton.disabled = true;
  submitButton.textContent = 'Processing...';
  showUploadProgress('Starting upload...');
  
  try {
    // Collect form data
    const formData = {
      program: form.program.value,
      course: form.course.value,
      studentName: form.studentName.value,
      email: form.email.value,
      phoneNumber: form.phoneNumber.value,
      aadharNumber: form.aadharNumber.value,
      permanentAddress: form.permanentAddress.value,
      correspondenceAddress: form.correspondenceAddress.value,
      dateOfBirth: form.dateOfBirth.value,
      paymentAmount: form.paymentAmount.value,
      totalFee: form.totalFee.value,
      sameAddress: form.sameAddress?.checked || false,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Prepare file uploads - CONCURRENT UPLOAD
    const fileFields = [
      { name: 'aadharFile', required: true },
      { name: 'casteFile', required: false },
      { name: 'residentialFile', required: false },
      { name: 'incomeFile', required: false },
      { name: 'marksheetFile', required: true },
      { name: 'signatureFile', required: true }
    ];
    
    const uploadPromises = [];
    const timestamp = Date.now();
    
    for (const field of fileFields) {
      const fileInput = form[field.name];
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Add to concurrent upload queue
        uploadPromises.push(
          uploadFile(file, field.name).then(result => ({
            field: field.name,
            data: result
          }))
        );
      }
    }
    
    showUploadProgress('Uploading files...');
    
    // Upload all files concurrently
    const uploadResults = await Promise.all(uploadPromises);
    
    // Add upload results to form data
    uploadResults.forEach(result => {
      formData[result.field] = result.data;
    });
    
    showUploadProgress('Saving registration...');
    
    // Save to backend API with optimized data structure
    const response = await fetch('/api/registrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Registration saved with ID:', result.id);
    
    // Save to localStorage for confirmation page
    localStorage.setItem('submittedData', JSON.stringify({...formData, id: result.id}));
    localStorage.setItem('applicationId', result.id);
    
    hideUploadProgress();
    
    // Success - redirect immediately
    window.location.href = 'confirmation.html';
    
  } catch (error) {
    console.error('❌ Submission error:', error);
    hideUploadProgress();
    
    let errorMessage = 'Submission failed. Please try again.';
    if (error.message.includes('timeout') || error.message.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      errorMessage = 'Permission error. Please refresh the page and try again.';
    }
    
    alert(`❌ ${errorMessage}\n\nError details: ${error.message}`);
    
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

// Initialize all functionality when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Form system initializing...');
  
  // Set up address checkbox functionality
  handleAddressCheckbox();
  
  // Set up program dropdown change event
  const programSelect = document.getElementById('program');
  if (programSelect) {
    programSelect.addEventListener('change', updateCourses);
  }

  // Set up form submission
  const form = document.getElementById('registrationForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
    
    // Add real-time file size validation
    form.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file) {
          try {
            validateFile(file);
            event.target.style.borderColor = '#888';
          } catch (error) {
            alert(error.message);
            event.target.value = '';
            event.target.style.borderColor = 'red';
          }
        }
      });
    });
    
    console.log('✅ Form system ready');
  } else {
    console.error('❌ Registration form not found!');
  }
});
