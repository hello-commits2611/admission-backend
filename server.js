const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const Razorpay = require('razorpay');
require('dotenv').config();

// Import SIN number utilities
const { generateUniqueSIN, isEligibleForSIN } = require('./utils/sinGenerator');
const { getExistingSINNumbers, updateRegistrationWithSIN, getEligibleRegistrationsForSIN } = require('./utils/sinDatabase');

// Firebase Admin Initialization - Using environment variables for production
let firestore, bucket;
let firebaseInitialized = false;

try {
  console.log('🚀 Initializing Firebase Admin SDK...');
  
  // Initialize with service account from environment or file
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('📄 Using service account from environment variable');
    // Using environment variable (for production)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "admission-form-2025.firebasestorage.app"
    });
    firestore = admin.firestore();
    bucket = admin.storage().bucket();
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully with service account from environment');
    console.log(`📊 Project ID: ${serviceAccount.project_id}`);
    console.log(`🪣 Storage Bucket: admission-form-2025.firebasestorage.app`);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.log(`📄 Using service account from file: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
    // Using service account file path (for development)
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "admission-form-2025.firebasestorage.app"
    });
    firestore = admin.firestore();
    bucket = admin.storage().bucket();
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully with service account file');
    console.log(`📊 Project ID: ${serviceAccount.project_id}`);
    console.log(`🪣 Storage Bucket: admission-form-2025.firebasestorage.app`);
    
    // Test Firebase connection
    console.log('🔍 Testing Firebase Storage connection...');
    try {
      const testFile = bucket.file('test-connection.txt');
      console.log('✅ Firebase Storage connection successful');
    } catch (testError) {
      console.log('⚠️ Firebase Storage connection test failed:', testError.message);
    }
  } else {
    console.log('⚠️ No Firebase service account found in environment variables or file path');
    console.log('Expected: FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH');
    console.log('Running in development mode with sample data');
    firestore = null;
    bucket = null;
    firebaseInitialized = false;
  }
} catch (error) {
  console.log('❌ Firebase Admin initialization failed:');
  console.log('Error:', error.message);
  if (error.code) {
    console.log('Error Code:', error.code);
  }
  console.log('Stack:', error.stack);
  console.log('Running in development mode with sample data');
  firestore = null;
  bucket = null;
  firebaseInitialized = false;
}

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Host validation middleware - ensure requests only come from allowed domain
const hostValidation = (req, res, next) => {
  const host = req.get('host');
  const allowedHost = 'www.gmcpnalanda.com';
  const isLocalDevelopment = process.env.NODE_ENV !== 'production' || host.includes('localhost') || host.includes('127.0.0.1');
  
  // Allow local development and the main domain
  if (isLocalDevelopment || host === allowedHost) {
    return next();
  }
  
  // Redirect to the correct domain with permanent redirect (301)
  console.log(`🔒 Host validation: Redirecting from ${host} to ${allowedHost}`);
  return res.redirect(301, `https://${allowedHost}${req.originalUrl}`);
  
  // Alternative: Block access completely (uncomment if you prefer blocking over redirecting)
  // console.log(`🚫 Host validation: Blocking access from unauthorized host: ${host}`);
  // return res.status(403).json({ 
  //   error: 'Access denied', 
  //   message: `This service is only available through ${allowedHost}` 
  // });
};

// Middleware
app.use(hostValidation); // Apply host validation first
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Admin credentials (In production, store these in database)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: '$2b$10$maFL1CWAtb.sIFL8l6grQuW4GelnQxx/zKmP9LyL8cgN9PQNqI4fi' // password: "password"
};

// Middleware to check if user is authenticated
const authenticateAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized access' });
  }
};

// Serve static files (your existing HTML/CSS/JS files)

// Routes
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (error) {
    // Fallback if file doesn't exist
    res.status(200).send('GMCP Admission Backend - Server Running');
  }
});

app.get('/confirmation.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirmation.html'));
});

// Admin login page
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Admin login POST
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    if (username === ADMIN_CREDENTIALS.username) {
      const isValidPassword = await bcrypt.compare(password, ADMIN_CREDENTIALS.password);
      
      if (isValidPassword) {
        req.session.isAdmin = true;
        req.session.username = username;
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Check admin authentication status
app.get('/admin/check-auth', (req, res) => {
  if (req.session.isAdmin) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Admin logout
app.post('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Could not log out' });
    } else {
      res.json({ success: true, message: 'Logged out successfully' });
    }
  });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fs = require('fs');
    const uploadDir = path.join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow only specific file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'));
    }
  }
});

// File upload endpoint using Firebase Admin SDK
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`📁 Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // If Firebase is initialized, upload to Firebase Storage
    if (firebaseInitialized && bucket) {
      try {
        const fieldName = req.body.fieldName || 'file';
        const fileName = `${fieldName}-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
        const filePath = `uploads/${fileName}`;
        
        console.log(`🚀 Starting Firebase upload: ${filePath}`);
        
        // Upload to Firebase Storage using Admin SDK (NO PUBLIC ACCESS)
        const file = bucket.file(filePath);
        
        // Read file data
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(req.file.path);
        
        console.log(`📤 Uploading ${fileBuffer.length} bytes to Firebase Storage...`);
        
        const stream = file.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
            metadata: {
              originalName: req.file.originalname,
              fieldName: fieldName,
              uploadTime: new Date().toISOString()
            }
          },
          resumable: false // Use simple upload for better error handling
        });
        
        stream.on('error', (error) => {
          console.error('❌ Firebase upload error:', error.message);
          console.error('Error code:', error.code);
          console.error('Error details:', error);
          
          // Fallback to local storage (secure)
          const localPath = `uploads/${req.file.filename}`;
          res.json({
            success: true,
            file: {
              name: req.file.originalname,
              filename: req.file.filename,
              size: req.file.size,
              type: req.file.mimetype,
              path: localPath,
              storage: 'local'
            }
          });
        });
        
        stream.on('finish', () => {
          console.log(`✅ File securely uploaded to Firebase Storage: ${filePath}`);
          
          // Delete local file after successful Firebase upload
          const fs = require('fs');
          fs.unlink(req.file.path, (err) => {
            if (err) console.log('Note: Could not delete local temp file');
          });
          
          // Return ONLY the secure path - NO public URLs
          res.json({
            success: true,
            file: {
              name: req.file.originalname,
              filename: fileName,
              size: req.file.size,
              type: req.file.mimetype,
              path: filePath, // Only store the path
              storage: 'firebase'
              // NO url property - files are only accessible through admin backend
            }
          });
        });
        
        // Upload the file buffer
        stream.end(fileBuffer);
        
      } catch (firebaseError) {
        console.error('Firebase Storage error:', firebaseError);
        // Fallback to local storage (also secure - no direct URLs)
        const localPath = `uploads/${req.file.filename}`;
        res.json({
          success: true,
          file: {
            name: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            type: req.file.mimetype,
            path: localPath, // Only store the path
            storage: 'local'
            // NO url property - files are only accessible through admin backend
          }
        });
      }
    } else {
      // Firebase not initialized, use local storage (secure - no direct URLs)
      console.log('⚠️ Firebase not initialized, using secure local storage');
      const localPath = `uploads/${req.file.filename}`;
      
      res.json({
        success: true,
        file: {
          name: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          type: req.file.mimetype,
          path: localPath, // Only store the path
          storage: 'local'
          // NO url property - files are only accessible through admin backend
        }
      });
    }
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// REMOVED: No static file serving for security
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Secure admin file access endpoint using Firebase Admin SDK
app.get('/admin/files/*', authenticateAdmin, async (req, res) => {
  try {
    const filePath = req.params[0] || req.path.replace('/admin/files/', ''); // Gets everything after /admin/files/
    const downloadMode = req.query.download === 'true'; // Check if download is requested
    console.log(`🔒 Admin requesting secure file access: ${filePath} (download: ${downloadMode})`);
    
    if (!firebaseInitialized || !bucket) {
      // Fallback to local file serving for development
      const localFilePath = path.join(__dirname, filePath);
      const fs = require('fs');
      
      if (fs.existsSync(localFilePath)) {
        console.log(`📁 Serving local file: ${localFilePath}`);
        if (downloadMode) {
          return res.download(localFilePath);
        } else {
          // For viewing, send file without forcing download
          return res.sendFile(localFilePath);
        }
      } else {
        return res.status(404).json({ error: 'File not found in local storage' });
      }
    }
    
    // Serve file from Firebase Storage using Admin SDK
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'File not found in Firebase Storage' });
    }
    
    // Get file metadata
    const [metadata] = await file.getMetadata();
    
    // Set appropriate headers based on mode
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    
    if (downloadMode) {
      // Force download
      res.setHeader('Content-Disposition', `attachment; filename="${metadata.metadata?.originalName || 'download'}"`);
    } else {
      // For viewing (inline display)
      res.setHeader('Content-Disposition', `inline; filename="${metadata.metadata?.originalName || 'download'}"`);
      // Add headers to prevent caching issues
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Create read stream and pipe to response
    const stream = file.createReadStream();
    stream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
    
    stream.pipe(res);
    console.log(`✅ Securely served file: ${filePath} (mode: ${downloadMode ? 'download' : 'view'})`);
    
  } catch (error) {
    console.error('Error serving secure file:', error);
    res.status(500).json({ error: 'Failed to serve file securely' });
  }
});

// Protected admin view route
app.get('/admin/view', authenticateAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-view.html'));
});

// API endpoint to get all registrations (protected) - Optimized
app.get('/api/registrations', authenticateAdmin, async (req, res) => {
  try {
    if (!firebaseInitialized || !firestore) {
      console.log('⚠️ Firebase not properly initialized - reading from local storage');
      // Read from local JSON file when Firebase is not configured
      const fs = require('fs');
      const path = require('path');
      
      const registrationsFile = path.join(__dirname, 'data', 'registrations.json');
      let registrations = [];
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          const localRegistrations = JSON.parse(fileContent);
          
          // Transform local data to match expected format
          registrations = localRegistrations.map(registration => {
            // Convert ISO string to seconds for compatibility
            const createdAtSeconds = new Date(registration.createdAt).getTime() / 1000;
            
            return {
              id: registration.id,
              studentName: registration.studentName,
              email: registration.email,
              phoneNumber: registration.phoneNumber,
              program: registration.program,
              course: registration.course,
              aadharNumber: registration.aadharNumber,
              dateOfBirth: registration.dateOfBirth,
              permanentAddress: registration.permanentAddress,
              correspondenceAddress: registration.correspondenceAddress,
              paymentAmount: registration.paymentAmount,
              totalFee: registration.totalFee || registration.totalCourseFee,
              transactionId: registration.transactionId,
              paymentStatus: registration.paymentStatus,
              status: registration.status,
              sinNumber: registration.sinNumber || null,
              sinGeneratedAt: registration.sinGeneratedAt || null,
              createdAt: { _seconds: createdAtSeconds },
              // Individual file fields
              aadharFile: registration.aadharFile,
              casteFile: registration.casteFile,
              residentialFile: registration.residentialFile,
              incomeFile: registration.incomeFile,
              marksheetFile: registration.marksheetFile,
              signatureFile: registration.signatureFile,
              // Files object for admin view
              files: {
                aadharFile: registration.aadharFile ? { 
                  name: registration.aadharFile.name, 
                  path: `uploads/${registration.aadharFile.filename}` 
                } : null,
                casteFile: registration.casteFile ? { 
                  name: registration.casteFile.name, 
                  path: `uploads/${registration.casteFile.filename}` 
                } : null,
                residentialFile: registration.residentialFile ? { 
                  name: registration.residentialFile.name, 
                  path: `uploads/${registration.residentialFile.filename}` 
                } : null,
                incomeFile: registration.incomeFile ? { 
                  name: registration.incomeFile.name, 
                  path: `uploads/${registration.incomeFile.filename}` 
                } : null,
                marksheetFile: registration.marksheetFile ? { 
                  name: registration.marksheetFile.name, 
                  path: `uploads/${registration.marksheetFile.filename}` 
                } : null,
                signatureFile: registration.signatureFile ? { 
                  name: registration.signatureFile.name, 
                  path: `uploads/${registration.signatureFile.filename}` 
                } : null
              }
            };
          });
          
          console.log(`📁 Found ${registrations.length} registrations in local storage`);
        } catch (error) {
          console.error('Error reading local registrations file:', error);
          registrations = [];
        }
      } else {
        console.log('No local registrations file found');
      }
      
      // Sort by creation date (newest first)
      registrations.sort((a, b) => b.createdAt._seconds - a.createdAt._seconds);
      
      return res.json({
        registrations,
        metadata: {
          count: registrations.length,
          hasMore: false,
          limit: 100,
          offset: 0,
          note: 'Data from local storage - Firebase not configured'
        }
      });
    }
    
    // Add query limits and optimize for performance
    const limit = parseInt(req.query.limit) || 100; // Default to 100 records
    const offset = parseInt(req.query.offset) || 0;
    
    let query = firestore.collection('registrations')
      .orderBy('createdAt', 'desc')
      .limit(limit);
    
    if (offset > 0) {
      // For pagination, get the last document from previous page
      const prevSnapshot = await firestore.collection('registrations')
        .orderBy('createdAt', 'desc')
        .limit(offset)
        .get();
      
      if (!prevSnapshot.empty) {
        const lastVisible = prevSnapshot.docs[prevSnapshot.docs.length - 1];
        query = query.startAfter(lastVisible);
      }
    }
    
    const snapshot = await query.get();
    
    const registrations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Optimize data transfer - only send essential fields for list view
      registrations.push({
        id: doc.id,
        studentName: data.studentName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        program: data.program,
        course: data.course,
        aadharNumber: data.aadharNumber,
        dateOfBirth: data.dateOfBirth,
        permanentAddress: data.permanentAddress,
        correspondenceAddress: data.correspondenceAddress,
        paymentAmount: data.paymentAmount,
        totalFee: data.totalFee,
        transactionId: data.transactionId,
        paymentStatus: data.paymentStatus,
        status: data.status,
        sinNumber: data.sinNumber || null,
        sinGeneratedAt: data.sinGeneratedAt || null,
        createdAt: data.createdAt,
        // Include individual file fields
        aadharFile: data.aadharFile || null,
        casteFile: data.casteFile || null,
        residentialFile: data.residentialFile || null,
        incomeFile: data.incomeFile || null,
        marksheetFile: data.marksheetFile || null,
        signatureFile: data.signatureFile || null,
        // Include file metadata for action buttons (secure paths only)
        files: {
          aadharFile: data.aadharFile ? { name: data.aadharFile.name, path: data.aadharFile.path || data.aadharFile.url } : null,
          casteFile: data.casteFile ? { name: data.casteFile.name, path: data.casteFile.path || data.casteFile.url } : null,
          residentialFile: data.residentialFile ? { name: data.residentialFile.name, path: data.residentialFile.path || data.residentialFile.url } : null,
          incomeFile: data.incomeFile ? { name: data.incomeFile.name, path: data.incomeFile.path || data.incomeFile.url } : null,
          marksheetFile: data.marksheetFile ? { name: data.marksheetFile.name, path: data.marksheetFile.path || data.marksheetFile.url } : null,
          signatureFile: data.signatureFile ? { name: data.signatureFile.name, path: data.signatureFile.path || data.signatureFile.url } : null
        }
      });
      
      // Debug logging for first record
      if (registrations.length === 1) {
        console.log('🔍 DEBUG: First registration file data:');
        console.log('aadharFile:', JSON.stringify(data.aadharFile, null, 2));
        console.log('marksheetFile:', JSON.stringify(data.marksheetFile, null, 2));
        console.log('signatureFile:', JSON.stringify(data.signatureFile, null, 2));
      }
    });
    
    // Add metadata for pagination
    res.json({
      registrations,
      metadata: {
        count: registrations.length,
        hasMore: registrations.length === limit,
        limit,
        offset
      }
    });
  } catch (error) {
    console.log('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// API endpoint to get single registration by ID (public)
app.get('/api/registrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📄 Fetching registration ${id}`);
    
    let registration = null;
    
    // Try Firebase first if initialized
    if (firebaseInitialized && firestore) {
      try {
        const doc = await firestore.collection('registrations').doc(id).get();
        if (doc.exists) {
          const data = doc.data();
          registration = {
            id: doc.id,
            ...data,
            // Convert Firestore timestamp to readable format for frontend (safe conversion)
            createdAt: data.createdAt ? (
              typeof data.createdAt.toDate === 'function' 
                ? data.createdAt.toDate().toISOString() 
                : data.createdAt
            ) : null,
            sinGeneratedAt: data.sinGeneratedAt ? (
              typeof data.sinGeneratedAt.toDate === 'function' 
                ? data.sinGeneratedAt.toDate().toISOString() 
                : data.sinGeneratedAt
            ) : null
          };
          console.log(`✅ Found registration in Firebase: ${id}`);
        }
      } catch (firebaseError) {
        console.error('❌ Firebase fetch failed:', firebaseError.message);
        console.log('📁 Falling back to local storage...');
      }
    }
    
    // If not found in Firebase or Firebase not available, check local storage
    if (!registration) {
      const fs = require('fs');
      const path = require('path');
      
      const registrationsFile = path.join(__dirname, 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          const registrations = JSON.parse(fileContent);
          
          registration = registrations.find(reg => reg.id === id);
          if (registration) {
            console.log(`✅ Found registration in local storage: ${id}`);
          }
        } catch (error) {
          console.error('❌ Error reading local storage:', error);
        }
      }
    }
    
    if (registration) {
      res.json({
        success: true,
        registration
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }
  } catch (error) {
    console.error('❌ Error fetching registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch registration',
      details: error.message
    });
  }
});

// API endpoint to update payment status (public)
app.post('/api/registrations/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId, paymentStatus, paymentTime } = req.body;
    
    console.log(`💳 Updating payment status for registration ${id} with transaction ${transactionId}`);
    
    let success = false;
    
    // Try Firebase first if initialized
    if (firebaseInitialized && firestore) {
      try {
        // Get the current registration data to check if SIN should be generated
        const registrationDoc = await firestore.collection('registrations').doc(id).get();
        const registrationData = registrationDoc.data();
        
        let updateData = {
          transactionId: transactionId,
          paymentStatus: paymentStatus,
          paymentTime: admin.firestore.Timestamp.fromDate(new Date(paymentTime)),
          status: 'paid',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Generate SIN number if eligible and not already assigned
        if (!registrationData.sinNumber && registrationData) {
          const updatedRegistrationData = { ...registrationData, ...updateData, transactionId };
          
          if (isEligibleForSIN(updatedRegistrationData)) {
            console.log('🔢 Generating SIN number for newly paid registration');
            try {
              const existingSINs = await getExistingSINNumbers(firestore, firebaseInitialized);
              const sinNumber = generateUniqueSIN(registrationData.program, registrationData.course, existingSINs);
              updateData.sinNumber = sinNumber;
              updateData.sinGeneratedAt = admin.firestore.FieldValue.serverTimestamp();
              console.log(`✅ Generated SIN number: ${sinNumber}`);
            } catch (sinError) {
              console.error('❌ Error generating SIN number:', sinError);
            }
          }
        }
        
        // Update the document with payment information and possibly SIN
        await firestore.collection('registrations').doc(id).update(updateData);
        
        console.log(`✅ Payment status updated successfully in Firebase for ${id}`);
        success = true;
      } catch (firebaseError) {
        console.error('❌ Firebase payment update failed:', firebaseError.message);
        console.log('📁 Falling back to local storage update...');
      }
    }
    
    // If Firebase failed or not initialized, update local storage
    if (!success) {
      const fs = require('fs');
      const path = require('path');
      
      const registrationsFile = path.join(__dirname, 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          let registrations = JSON.parse(fileContent);
          
          // Find and update the registration
          const registrationIndex = registrations.findIndex(reg => reg.id === id);
          
          if (registrationIndex !== -1) {
            registrations[registrationIndex].transactionId = transactionId;
            registrations[registrationIndex].paymentStatus = paymentStatus;
            registrations[registrationIndex].status = 'paid';
            registrations[registrationIndex].updatedAt = new Date().toISOString();
            
            // Generate SIN number if eligible and not already assigned
            if (!registrations[registrationIndex].sinNumber) {
              const updatedRegistrationData = { ...registrations[registrationIndex] };
              
              if (isEligibleForSIN(updatedRegistrationData)) {
                console.log('🔢 Generating SIN number for newly paid registration (local storage)');
                try {
                  const existingSINs = await getExistingSINNumbers(firestore, firebaseInitialized);
                  const sinNumber = generateUniqueSIN(registrations[registrationIndex].program, registrations[registrationIndex].course, existingSINs);
                  registrations[registrationIndex].sinNumber = sinNumber;
                  registrations[registrationIndex].sinGeneratedAt = new Date().toISOString();
                  console.log(`✅ Generated SIN number: ${sinNumber}`);
                } catch (sinError) {
                  console.error('❌ Error generating SIN number:', sinError);
                }
              }
            }
            
            // Save back to file
            fs.writeFileSync(registrationsFile, JSON.stringify(registrations, null, 2));
            console.log(`✅ Payment status updated successfully in local storage for ${id}`);
            success = true;
          } else {
            console.error(`❌ Registration ${id} not found in local storage`);
          }
        } catch (error) {
          console.error('❌ Error updating local storage:', error);
        }
      }
    }
    
    if (success) {
      res.json({
        success: true,
        message: 'Payment status updated successfully',
        id: id,
        transactionId: transactionId
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Registration not found or update failed',
        id: id
      });
    }
  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status',
      details: error.message
    });
  }
});

// API endpoint to save registration data (public)
app.post('/api/registrations', async (req, res) => {
  try {
    console.log('💾 Saving registration data...');
    console.log('Received data:', JSON.stringify(req.body, null, 2));
    
    const registrationData = {
      program: req.body.program,
      course: req.body.course,
      studentName: req.body.studentName,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      aadharNumber: req.body.aadharNumber,
      dateOfBirth: req.body.dateOfBirth,
      permanentAddress: req.body.permanentAddress,
      correspondenceAddress: req.body.correspondenceAddress,
      paymentAmount: req.body.paymentAmount,
      totalFee: req.body.totalFee || req.body.totalCourseFee,
      transactionId: req.body.transactionId || null,
      paymentStatus: req.body.transactionId ? 'paid' : 'pending',
      razorpayOrderId: req.body.razorpayOrderId || null,
      razorpayPaymentId: req.body.razorpayPaymentId || null,
      razorpaySignature: req.body.razorpaySignature || null,
      aadharFile: req.body.aadharFile || null,
      casteFile: req.body.casteFile || null,
      residentialFile: req.body.residentialFile || null,
      incomeFile: req.body.incomeFile || null,
      marksheetFile: req.body.marksheetFile || null,
      signatureFile: req.body.signatureFile || null,
      status: req.body.transactionId ? 'paid' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    let docId;
    let success = false;
    
    // Generate SIN number if eligible (paid with transaction ID)
    let sinNumber = null;
    if (isEligibleForSIN(registrationData)) {
      console.log('🔢 Student is eligible for SIN number generation');
      try {
        // Get existing SIN numbers to ensure uniqueness
        const existingSINs = await getExistingSINNumbers(firestore, firebaseInitialized);
        
        // Generate unique SIN number
        sinNumber = generateUniqueSIN(registrationData.program, registrationData.course, existingSINs);
        registrationData.sinNumber = sinNumber;
        registrationData.sinGeneratedAt = new Date().toISOString();
        
        console.log(`✅ Generated SIN number for student: ${sinNumber}`);
      } catch (sinError) {
        console.error('❌ Error generating SIN number:', sinError);
        // Continue without SIN - can be generated later
      }
    } else {
      console.log('ℹ️ Student not eligible for SIN number (payment not completed or no transaction ID)');
    }

    // Try Firebase first if initialized
    if (firebaseInitialized && firestore) {
      try {
        console.log('💾 Saving to Firebase...');
        const modifiedData = {
          ...registrationData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await firestore.collection('registrations').add(modifiedData);
        docId = docRef.id;
        success = true;
        console.log('✅ Registration saved successfully to Firebase with ID:', docId);
      } catch (firebaseError) {
        console.error('❌ Firebase save failed:', firebaseError.message);
        console.log('📁 Falling back to local storage...');
        // Continue to local storage fallback
      }
    }
    
    // If Firebase failed or not initialized, use local JSON storage
    if (!success) {
      console.log('💾 Saving to local storage (Firebase not available)...');
      const fs = require('fs');
      const path = require('path');
      
      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Generate unique ID
      docId = 'reg_' + Date.now() + '_' + Math.round(Math.random() * 1E9);
      
      // Read existing registrations or create empty array
      const registrationsFile = path.join(dataDir, 'registrations.json');
      let registrations = [];
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          registrations = JSON.parse(fileContent);
        } catch (error) {
          console.warn('Could not read existing registrations file, starting fresh');
          registrations = [];
        }
      }
      
      // Add new registration
      const newRegistration = {
        id: docId,
        ...registrationData
      };
      
      registrations.push(newRegistration);
      
      // Save back to file
      fs.writeFileSync(registrationsFile, JSON.stringify(registrations, null, 2));
      console.log('✅ Registration saved successfully to local storage with ID:', docId);
      success = true;
    }
    
    res.status(201).json({
      success: true,
      message: `Registration saved successfully ${firebaseInitialized ? 'to Firebase' : 'locally'}`,
      id: docId,
      data: {
        id: docId,
        ...registrationData
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save registration',
      details: error.message
    });
  }
});

// Admin endpoint to generate SIN numbers for existing registrations
app.post('/admin/generate-sins', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔢 Starting bulk SIN generation for existing registrations...');
    
    // Get all registrations eligible for SIN generation
    const eligibleRegistrations = await getEligibleRegistrationsForSIN(firestore, firebaseInitialized);
    
    if (eligibleRegistrations.length === 0) {
      return res.json({
        success: true,
        message: 'No registrations found that are eligible for SIN generation',
        processed: 0,
        generated: 0
      });
    }
    
    console.log(`📊 Found ${eligibleRegistrations.length} registrations eligible for SIN generation`);
    
    // Get existing SIN numbers for uniqueness check
    const existingSINs = await getExistingSINNumbers(firestore, firebaseInitialized);
    
    let processed = 0;
    let generated = 0;
    const errors = [];
    
    for (const registration of eligibleRegistrations) {
      try {
        processed++;
        
        // Generate unique SIN number
        const sinNumber = generateUniqueSIN(registration.program, registration.course, existingSINs);
        
        // Add to existing SINs list to prevent duplicates in this batch
        existingSINs.push(sinNumber);
        
        // Update the registration with SIN number
        const updateSuccess = await updateRegistrationWithSIN(registration.id, sinNumber, firestore, firebaseInitialized);
        
        if (updateSuccess) {
          generated++;
          console.log(`✅ Generated SIN ${sinNumber} for student ${registration.studentName} (${registration.id})`);
        } else {
          errors.push(`Failed to update registration ${registration.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Error generating SIN for registration ${registration.id}:`, error);
        errors.push(`Error processing registration ${registration.id}: ${error.message}`);
      }
    }
    
    console.log(`🎉 SIN generation complete: ${generated}/${processed} registrations updated`);
    
    res.json({
      success: true,
      message: `SIN generation completed`,
      processed,
      generated,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('❌ Error in bulk SIN generation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SIN numbers',
      details: error.message
    });
  }
});

// Secure Firebase test endpoint (for testing purposes)
app.post('/api/test-firebase', async (req, res) => {
  try {
    console.log('🔍 Testing Firebase connection via backend...');
    
    if (!firebaseInitialized || !firestore) {
      return res.status(500).json({
        success: false,
        error: 'Firebase not properly configured',
        details: 'Firebase Admin SDK not initialized'
      });
    }
    
    const testData = {
      test: true,
      message: req.body.message || 'Firebase connection test via backend',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    };
    
    // Save to Firestore test collection
    const docRef = await firestore.collection('test').add(testData);
    console.log('✅ Test document written with ID:', docRef.id);
    
    res.status(200).json({
      success: true,
      message: 'Firebase test successful',
      documentId: docRef.id,
      data: testData
    });
  } catch (error) {
    console.error('❌ Firebase test error:', error);
    res.status(500).json({
      success: false,
      error: 'Firebase test failed',
      details: error.message
    });
  }
});

// Test endpoint to manually generate SIN (for debugging)
app.post('/api/test-generate-sin', async (req, res) => {
  try {
    const { registrationId } = req.body;
    
    if (!registrationId) {
      return res.status(400).json({
        success: false,
        error: 'Registration ID is required'
      });
    }
    
    console.log(`🧪 Test SIN generation for registration: ${registrationId}`);
    
    let registration = null;
    
    // Try Firebase first
    if (firebaseInitialized && firestore) {
      try {
        const doc = await firestore.collection('registrations').doc(registrationId).get();
        if (doc.exists) {
          registration = { id: doc.id, ...doc.data() };
        }
      } catch (firebaseError) {
        console.log('Firebase not available, checking local storage...');
      }
    }
    
    // If not found in Firebase, check local storage
    if (!registration) {
      const fs = require('fs');
      const path = require('path');
      const registrationsFile = path.join(__dirname, 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        const fileContent = fs.readFileSync(registrationsFile, 'utf8');
        const registrations = JSON.parse(fileContent);
        registration = registrations.find(reg => reg.id === registrationId);
      }
    }
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }
    
    // Check if already has SIN
    if (registration.sinNumber) {
      return res.json({
        success: true,
        message: 'Registration already has SIN number',
        sinNumber: registration.sinNumber,
        alreadyExists: true
      });
    }
    
    // Check eligibility
    const isEligible = isEligibleForSIN(registration);
    console.log(`📊 SIN eligibility for ${registrationId}: ${isEligible}`);
    
    if (!isEligible) {
      return res.json({
        success: false,
        error: 'Registration is not eligible for SIN generation',
        eligibilityCheck: {
          hasTransactionId: !!(registration.transactionId && registration.transactionId.trim() !== ''),
          paymentStatus: registration.paymentStatus,
          paymentAmount: registration.paymentAmount || 0
        }
      });
    }
    
    // Generate SIN
    try {
      const existingSINs = await getExistingSINNumbers(firestore, firebaseInitialized);
      const sinNumber = generateUniqueSIN(registration.program, registration.course, existingSINs);
      
      // Update registration with SIN
      const updateSuccess = await updateRegistrationWithSIN(registrationId, sinNumber, firestore, firebaseInitialized);
      
      if (updateSuccess) {
        res.json({
          success: true,
          message: 'SIN number generated successfully',
          sinNumber: sinNumber,
          registrationId: registrationId
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update registration with SIN number'
        });
      }
      
    } catch (sinError) {
      console.error('Error generating SIN:', sinError);
      res.status(500).json({
        success: false,
        error: 'Failed to generate SIN number',
        details: sinError.message
      });
    }
    
  } catch (error) {
    console.error('Error in test SIN generation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Generate transaction slip endpoint
app.post('/api/generate-receipt', (req, res) => {
  const { transactionId, studentName, course, amount, paymentTime, sinNumber } = req.body;
  
  // Generate receipt HTML
  const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #003349; padding-bottom: 20px; margin-bottom: 20px; }
        .receipt-details { margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .success { color: #28a745; font-weight: bold; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GMCP Admission Receipt</h1>
        <p>Ganga Memorial College of Polytechnic</p>
        <p>Harnaout, Nalanda</p>
      </div>
      
      <div class="receipt-details">
        <div class="detail-row">
          <span><strong>Transaction ID:</strong></span>
          <span>${transactionId}</span>
        </div>
        <div class="detail-row">
          <span><strong>Student Name:</strong></span>
          <span>${studentName}</span>
        </div>
        <div class="detail-row">
          <span><strong>Course:</strong></span>
          <span>${course}</span>
        </div>
        <div class="detail-row">
          <span><strong>Amount Paid:</strong></span>
          <span>₹${amount}</span>
        </div>
        <div class="detail-row">
          <span><strong>Payment Time:</strong></span>
          <span>${new Date().toLocaleString()}</span>
        </div>
        ${sinNumber ? `
        <div class="detail-row" style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; border-left: 4px solid #007bff;">
          <span><strong>SIN Number:</strong></span>
          <span style="font-weight: bold; color: #007bff;">${sinNumber}</span>
        </div>` : ''}
        <div class="detail-row success">
          <span><strong>Status:</strong></span>
          <span>PAID</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()">Print Receipt</button>
        <button onclick="window.close()">Close</button>
      </div>
    </body>
    </html>
  `;
  
  res.send(receiptHTML);
});

// Admin endpoint to delete a registration
app.delete('/admin/registrations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Admin deleting registration: ${id}`);
    
    let success = false;
    let foundRegistration = null;
    
    // Try Firebase first if initialized
    if (firebaseInitialized && firestore) {
      try {
        // Check if registration exists first
        const doc = await firestore.collection('registrations').doc(id).get();
        if (doc.exists) {
          foundRegistration = { id: doc.id, ...doc.data() };
          
          // Delete from Firebase
          await firestore.collection('registrations').doc(id).delete();
          console.log(`✅ Registration ${id} deleted from Firebase`);
          success = true;
        }
      } catch (firebaseError) {
        console.error('❌ Firebase delete failed:', firebaseError.message);
        console.log('📁 Falling back to local storage...');
      }
    }
    
    // If not found in Firebase or Firebase not available, try local storage
    if (!success) {
      const fs = require('fs');
      const path = require('path');
      
      const registrationsFile = path.join(__dirname, 'data', 'registrations.json');
      
      if (fs.existsSync(registrationsFile)) {
        try {
          const fileContent = fs.readFileSync(registrationsFile, 'utf8');
          let registrations = JSON.parse(fileContent);
          
          // Find registration to delete
          const registrationIndex = registrations.findIndex(reg => reg.id === id);
          
          if (registrationIndex !== -1) {
            foundRegistration = registrations[registrationIndex];
            
            // Remove from array
            registrations.splice(registrationIndex, 1);
            
            // Write back to file
            fs.writeFileSync(registrationsFile, JSON.stringify(registrations, null, 2));
            console.log(`✅ Registration ${id} deleted from local storage`);
            success = true;
          }
        } catch (error) {
          console.error('❌ Error deleting from local storage:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to delete from local storage',
            details: error.message
          });
        }
      }
    }
    
    if (success && foundRegistration) {
      // Optionally, also try to delete associated files
      // For now, we'll just delete the database record
      
      res.json({
        success: true,
        message: `Registration for "${foundRegistration.studentName || 'Unknown'}" deleted successfully`,
        deletedRegistration: {
          id: foundRegistration.id,
          studentName: foundRegistration.studentName,
          program: foundRegistration.program,
          course: foundRegistration.course
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Registration not found'
      });
    }
    
  } catch (error) {
    console.error('❌ Error deleting registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete registration',
      details: error.message
    });
  }
});

// Health check endpoints for Render monitoring
app.get('/health', (req, res) => {
  // Always return healthy - Firebase is optional for basic functionality
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'GMCP Admission Backend',
    firebase: firebaseInitialized ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Alternative health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin/login`);
  console.log(`📋 Admin credentials: admin / password`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
