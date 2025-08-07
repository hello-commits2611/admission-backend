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

// File upload utility functions
function validateFile(file, maxSizeMB = 5) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type for ${file.name}. Please upload JPG, PNG, or PDF files only.`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please upload files smaller than ${maxSizeMB}MB.`);
  }
  
  return true;
}

function createProgressBar(filename) {
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    margin: 10px 0;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    background: #f9f9f9;
  `;
  
  progressContainer.innerHTML = `
    <div style="font-size: 12px; margin-bottom: 5px;">${filename}</div>
    <div style="background: #e0e0e0; border-radius: 10px; height: 20px; position: relative;">
      <div class="progress-fill" style="background: #4CAF50; height: 100%; border-radius: 10px; width: 0%; transition: width 0.3s;"></div>
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">0%</div>
    </div>
  `;
  
  return progressContainer;
}

function updateProgress(progressContainer, percent) {
  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('div[style*="position: absolute"]');
  
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
}

async function uploadFile(file, fieldName, progressContainer, retries = 3) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fieldName', fieldName);
    
    const xhr = new XMLHttpRequest();
    
    // Set timeout for stuck uploads
    const timeout = setTimeout(() => {
      xhr.abort();
      reject(new Error('Upload timed out. Please try again.'));
    }, 300000); // 5 minutes timeout
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        updateProgress(progressContainer, progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      clearTimeout(timeout);
      
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            updateProgress(progressContainer, 100);
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
        // Retry logic
        if (retries > 0 && xhr.status !== 413) { // Don't retry if file too large
          console.log(`Retrying upload for ${file.name}. Attempts left: ${retries - 1}`);
          uploadFile(file, fieldName, progressContainer, retries - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Failed to upload ${file.name}: HTTP ${xhr.status}`));
        }
      }
    });
    
    xhr.addEventListener('error', () => {
      clearTimeout(timeout);
      
      // Retry logic
      if (retries > 0) {
        console.log(`Retrying upload for ${file.name}. Attempts left: ${retries - 1}`);
        uploadFile(file, fieldName, progressContainer, retries - 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error(`Network error uploading ${file.name}`));
      }
    });
    
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

// Function to handle form submission
async function handleFormSubmission(event) {
  event.preventDefault();
  
  const form = event.target;
  const requiredFields = form.querySelectorAll('[required]');
  let isValid = true;
  
  // Validate required fields
  requiredFields.forEach(field => {
    if (field.type === 'file') {
      if (field.files.length === 0) {
        field.style.borderColor = 'red';
        isValid = false;
      } else {
        // Validate file
        try {
          validateFile(field.files[0]);
          field.style.borderColor = '#888';
        } catch (error) {
          alert(`${field.name}: ${error.message}`);
          field.style.borderColor = 'red';
          isValid = false;
        }
      }
    } else {
      if (!field.value.trim()) {
        field.style.borderColor = 'red';
        isValid = false;
      } else {
        field.style.borderColor = '#888';
      }
    }
  });
  
  if (!isValid) {
    alert('Please fix the errors and try again.');
    return;
  }
  
  // Form is ready for submission - no external dependencies needed
  
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  
  // Create progress container
  const progressContainer = document.createElement('div');
  progressContainer.id = 'upload-progress';
  progressContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border: 2px solid #003349;
    border-radius: 10px;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
    max-width: 400px;
    width: 90%;
    z-index: 1000;
  `;
  
  progressContainer.innerHTML = `
    <h3 style="color: #003349; text-align: center; margin-top: 0;">Uploading Files...</h3>
    <div id="progress-items"></div>
    <div style="text-align: center; margin-top: 20px;">
      <div id="overall-status">Starting upload...</div>
    </div>
  `;
  
  document.body.appendChild(progressContainer);
  
  try {
    submitButton.textContent = 'Uploading files...';
    
    // Collect basic form data
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
      sameAddress: form.sameAddress.checked,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Upload files
    const fileFields = [
      { name: 'aadharFile', required: true },
      { name: 'casteFile', required: false },
      { name: 'residentialFile', required: false },
      { name: 'incomeFile', required: false },
      { name: 'marksheetFile', required: true },
      { name: 'signatureFile', required: true }
    ];
    
    const progressItems = document.getElementById('progress-items');
    const overallStatus = document.getElementById('overall-status');
    
    let uploadedCount = 0;
    const totalFiles = fileFields.filter(field => {
      const fileInput = form[field.name];
      return fileInput && fileInput.files.length > 0;
    }).length;
    
    overallStatus.textContent = `Uploading 0 of ${totalFiles} files...`;
    
    const uploadPromises = [];

    for (const field of fileFields) {
      const fileInput = form[field.name];
      
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        const fileProgress = createProgressBar(file.name);
        progressItems.appendChild(fileProgress);

        const uploadPromise = uploadFile(file, field.name, fileProgress)
          .then(uploadResult => {
            formData[field.name] = uploadResult;
            uploadedCount++;
            overallStatus.textContent = `Uploaded ${uploadedCount} of ${totalFiles} files...`;
            return uploadResult;
          })
          .catch(error => {
            console.error(`Error uploading ${field.name}:`, error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
          });

        uploadPromises.push(uploadPromise);
      }
    }

    await Promise.all(uploadPromises);
    
    overallStatus.textContent = 'Saving registration data...';
    submitButton.textContent = 'Saving data...';
    
    // Save to backend API
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
    
    // Save to localStorage
    localStorage.setItem("submittedData", JSON.stringify({...formData, id: result.id}));
    localStorage.setItem("applicationId", result.id);
    
    overallStatus.textContent = 'Registration completed successfully!';
    
    // Remove progress container after a short delay
    setTimeout(() => {
      document.body.removeChild(progressContainer);
      window.location.href = "confirmation.html";
    }, 1500);
    
  } catch (error) {
    console.error('❌ Error submitting form: ', error);
    
    // Remove progress container
    if (document.getElementById('upload-progress')) {
      document.body.removeChild(progressContainer);
    }
    
    alert(`❌ Error: ${error.message}\n\nPlease check your internet connection and try again.`);
    
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
}

// Initialize all functionality when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set up address checkbox functionality
  handleAddressCheckbox();
  
  // Set up program dropdown change event (backup to inline onchange)
  const programSelect = document.getElementById('program');
  if (programSelect) {
    programSelect.addEventListener('change', updateCourses);
  }

  const form = document.getElementById('registrationForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
    
    // Add file size validation
    form.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file && file.size > 5 * 1024 * 1024) {
          alert(`The file ${file.name} is too large. Maximum allowed size is 5MB.`);
          event.target.value = '';
        }
      });
    });
  } else {
    console.error('Registration form not found!');
  }
  
  console.log('Form JavaScript loaded successfully');
  console.log('Course options available:', courseOptions);
});
