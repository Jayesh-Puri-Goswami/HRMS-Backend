const helmet = require('helmet');

// Enhanced security configuration
const securityConfig = {
  // Helmet configuration
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true
  }),

  // Additional security headers middleware
  additionalHeaders: (req, res, next) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Cache control for sensitive routes
    if (req.path.includes('/api/') || req.path.includes('/auth/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  },

  // Request validation middleware
  validateRequest: (req, res, next) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./, // Directory traversal
      /<script\b[^>]*>/i, // XSS attempts
      /\bjavascript:/i, // JS injection
      /\bon\w+\s*=/i, // Inline event handlers
      /\bunion\s+select\b/i, // SQLi
      /\bdrop\s+table\b/i, // SQLi
      /\bdelete\s+from\b/i, // SQLi
      /\binsert\s+into\b/i, // SQLi
      /\bupdate\s+\w+\s+set\b/i, // SQLi (make sure it's real SQL)
      /\bexec\s*\(/i, // Code injection
      /\beval\s*\(/i, // Code injection
      /\bsystem\s*\(/i, // Command injection
    ];

    const userInput = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userInput)) {
        req.securityEvent = 'suspicious_activity';
        return res.status(400).json({
          error: 'Invalid request detected',
          message: 'Request contains potentially malicious content'
        });
      }
    }

    next();
  },

  // IP whitelist middleware (optional)
  ipWhitelist: (allowedIPs = []) => {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next(); // No restrictions if no IPs specified
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (!allowedIPs.includes(clientIP)) {
        req.securityEvent = 'unauthorized_ip_access';
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is not authorized to access this resource'
        });
      }

      next();
    };
  },

  // Request size limiter
  requestSizeLimiter: (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (contentLength > maxSize) {
      req.securityEvent = 'request_size_exceeded';
      return res.status(413).json({
        error: 'Request too large',
        message: 'Request body exceeds maximum allowed size'
      });
    }

    next();
  },

  // API key validation middleware (if needed)
  validateApiKey: (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (!apiKey) {
      req.securityEvent = 'missing_api_key';
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required'
      });
    }

    // Add your API key validation logic here
    // For now, we'll just check if it exists
    if (apiKey === 'valid-api-key') {
      next();
    } else {
      req.securityEvent = 'invalid_api_key';
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }
  }
};

module.exports = securityConfig; 