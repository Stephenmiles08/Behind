// middlewares/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/**
 * @param allowedRoles {string[]} - Array of roles that can access this route
 * If empty or undefined, any authenticated user can access
 */
function authenticate(allowedRoles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing token' });

    const match = auth.match(/Bearer (.+)/);
    if (!match) return res.status(401).json({ error: 'Invalid token' });

    try {
      const payload = jwt.verify(match[1], JWT_SECRET);
      req.user = payload;

      // No roles required, just authentication
      if (allowedRoles.length === 0) return next();

      // Check if the user's role is allowed
      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = authenticate;
