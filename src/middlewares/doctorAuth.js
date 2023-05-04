const User = require('../models/user');

const doctorAuth = (patientId) => (req, res, next) => {
  const doctorId = req.user.username;

  User.findOne({ username: patientId, doctorAccess: doctorId }, (err, patient) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal server error');
    }

    if (!patient) {
      return res.status(401).send('Unauthorized');
    }

    return next();
  });
};

module.exports = doctorAuth;
