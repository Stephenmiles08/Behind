// middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function authenticate(requiredRole = null) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing token' });

    const match = auth.match(/Bearer (.+)/);
    if (!match) return res.status(401).json({ error: 'Invalid token' });

    try {
      const payload = jwt.verify(match[1], JWT_SECRET);

      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      req.user = payload; // attach user for later use
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = authenticate;
