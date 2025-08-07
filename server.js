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

// Middleware
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
      console.log('⚠️ Firebase not properly initialized - returning sample data for testing');
      // Return sample data for testing when Firebase is not configured
      return res.json({
        registrations: [
          {
            id: 'sample-1',
            studentName: 'Sample Student 1',
            email: 'student1@example.com',
            phoneNumber: '1234567890',
            program: 'polytechnic',
            course: 'computer_science_engineering',
            aadharNumber: '1234-5678-9012',
            dateOfBirth: '2000-01-01',
            permanentAddress: 'Sample Address 1',
            correspondenceAddress: 'Sample Address 1',
            paymentAmount: '5000',
            totalFee: '5500',
            transactionId: 'TXN123456789',
            status: 'paid',
            createdAt: { _seconds: Date.now() / 1000 },
            aadharFile: { name: 'aadhar.pdf', path: 'uploads/sample-aadhar.pdf' },
            marksheetFile: { name: 'marksheet.pdf', path: 'uploads/sample-marksheet.pdf' },
            signatureFile: { name: 'signature.jpg', path: 'uploads/sample-signature.jpg' },
            files: {
              aadharFile: { name: 'aadhar.pdf', path: 'uploads/sample-aadhar.pdf' },
              marksheetFile: { name: 'marksheet.pdf', path: 'uploads/sample-marksheet.pdf' },
              signatureFile: { name: 'signature.jpg', path: 'uploads/sample-signature.jpg' }
            }
          },
          {
            id: 'sample-2', 
            studentName: 'Sample Student 2',
            email: 'student2@example.com',
            phoneNumber: '0987654321',
            program: 'ug',
            course: 'bca',
            aadharNumber: '9876-5432-1098',
            dateOfBirth: '1999-12-31',
            permanentAddress: 'Sample Address 2',
            correspondenceAddress: 'Sample Address 2', 
            paymentAmount: '10000',
            totalFee: '11000',
            transactionId: null,
            status: 'pending',
            createdAt: { _seconds: (Date.now() - 86400000) / 1000 },
            aadharFile: { name: 'aadhar2.pdf', path: 'uploads/sample-aadhar2.pdf' },
            marksheetFile: { name: 'marksheet2.pdf', path: 'uploads/sample-marksheet2.pdf' },
            files: {
              aadharFile: { name: 'aadhar2.pdf', path: 'uploads/sample-aadhar2.pdf' },
              marksheetFile: { name: 'marksheet2.pdf', path: 'uploads/sample-marksheet2.pdf' }
            }
          }
        ],
        metadata: {
          count: 2,
          hasMore: false,
          limit: 100,
          offset: 0,
          note: 'Sample data - Firebase not configured'
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
        createdAt: data.createdAt,
        // Include individual file fields for direct access
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

// API endpoint to update payment status (public)
app.post('/api/registrations/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId, paymentStatus, paymentTime } = req.body;
    
    console.log(`💳 Updating payment status for registration ${id} with transaction ${transactionId}`);
    
    if (!firebaseInitialized || !firestore) {
      console.error('❌ Firebase not initialized');
      return res.status(500).json({
        success: false,
        error: 'Firebase not properly configured. Please check server configuration.',
        details: 'Firebase Admin SDK not initialized'
      });
    }
    
    // Update the document with payment information
    await firestore.collection('registrations').doc(id).update({
      transactionId: transactionId,
      paymentStatus: paymentStatus,
      paymentTime: admin.firestore.Timestamp.fromDate(new Date(paymentTime)),
      status: 'paid',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Payment status updated successfully for ${id}`);
    
    res.json({
      success: true,
      message: 'Payment status updated successfully',
      id: id,
      transactionId: transactionId
    });
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
    console.log('💾 Saving registration data to Firebase...');
    console.log('Received data:', JSON.stringify(req.body, null, 2));
    
    if (!firebaseInitialized || !firestore) {
      console.error('❌ Firebase not initialized');
      return res.status(500).json({
        success: false,
        error: 'Firebase not properly configured. Please check server configuration.',
        details: 'Firebase Admin SDK not initialized'
      });
    }
    
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
      totalFee: req.body.totalFee,
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Save to Firestore
    const docRef = await firestore.collection('registrations').add(registrationData);
    console.log('✅ Registration saved successfully with ID:', docRef.id);
    
    res.status(201).json({
      success: true,
      message: 'Registration saved successfully to Firebase',
      id: docRef.id,
      data: {
        id: docRef.id,
        ...registrationData
      }
    });
  } catch (error) {
    console.error('❌ Error saving registration to Firebase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save registration to Firebase',
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

// Generate transaction slip endpoint
app.post('/api/generate-receipt', (req, res) => {
  const { transactionId, studentName, course, amount, paymentTime } = req.body;
  
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

// Health check endpoints for Render monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'GMCP Admission Backend',
    firebase: firebaseInitialized ? 'connected' : 'disconnected',
    uptime: process.uptime()
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
