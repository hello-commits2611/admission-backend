// Performance monitoring utility
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.startTimes = {};
  }

  startTimer(operation) {
    this.startTimes[operation] = performance.now();
    console.log(`⏱️ Started: ${operation}`);
  }

  endTimer(operation) {
    if (this.startTimes[operation]) {
      const duration = performance.now() - this.startTimes[operation];
      this.metrics[operation] = duration;
      console.log(`✅ Completed: ${operation} in ${duration.toFixed(2)}ms`);
      delete this.startTimes[operation];
      return duration;
    }
    return null;
  }

  getMetrics() {
    return this.metrics;
  }

  logSummary() {
    console.log('📊 Performance Summary:');
    Object.entries(this.metrics).forEach(([operation, duration]) => {
      console.log(`  ${operation}: ${duration.toFixed(2)}ms`);
    });
  }
}

// Global performance monitor
window.performanceMonitor = new PerformanceMonitor();

// Network quality detector
function detectNetworkQuality() {
  if ('connection' in navigator) {
    const connection = navigator.connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  return null;
}

// Estimate upload time based on file size and network
function estimateUploadTime(fileSizeMB, networkInfo) {
  if (!networkInfo) return null;
  
  const downloadSpeedMbps = networkInfo.downlink || 1;
  const uploadSpeedMbps = downloadSpeedMbps * 0.3; // Assume upload is 30% of download
  const fileSizeMb = fileSizeMB * 8; // Convert MB to Mb
  const estimatedSeconds = fileSizeMb / uploadSpeedMbps;
  
  return estimatedSeconds;
}

// Log system information
function logSystemInfo() {
  console.log('🖥️ System Information:');
  console.log('  User Agent:', navigator.userAgent);
  console.log('  Platform:', navigator.platform);
  console.log('  Language:', navigator.language);
  console.log('  Online:', navigator.onLine);
  
  const networkInfo = detectNetworkQuality();
  if (networkInfo) {
    console.log('📡 Network Information:');
    console.log('  Effective Type:', networkInfo.effectiveType);
    console.log('  Downlink:', networkInfo.downlink, 'Mbps');
    console.log('  RTT:', networkInfo.rtt, 'ms');
    console.log('  Save Data:', networkInfo.saveData);
  }
}

// Export for use in main form script
window.PerformanceMonitor = PerformanceMonitor;
window.detectNetworkQuality = detectNetworkQuality;
window.estimateUploadTime = estimateUploadTime;
window.logSystemInfo = logSystemInfo;
