const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  // Bearer <token>
  const tokenString = token.split(' ')[1];

  if (!tokenString) {
    return res.status(403).json({ message: 'Malformed token' });
  }

  jwt.verify(tokenString, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.role === 'GM' || req.role === 'HR') {
    next();
    return;
  }
  res.status(403).json({ message: 'Require Admin Role' });
};

const isHOD = (req, res, next) => {
  if (req.role === 'GM' || req.role === 'HR' || req.role === 'HOD') {
    next();
    return;
  }
  res.status(403).json({ message: 'Require HOD Role' });
};

module.exports = { verifyToken, isAdmin, isHOD };
