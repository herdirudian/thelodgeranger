const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

exports.signup = async (req, res) => {
  try {
    const { email, password, name, role, department } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'STAFF',
        department,
      },
    });

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.me = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                leaveQuota: true
            }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        console.error("Me Error:", error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await prisma.user.update({
            where: { email },
            data: { resetToken, resetTokenExpiry }
        });

        const { sendEmail } = require('../services/emailService');
        await sendEmail(
            email, 
            'Password Reset Verification Code', 
            `<p>Your verification code is: <strong>${resetToken}</strong></p><p>This code expires in 15 minutes.</p>`
        );

        res.json({ message: 'Verification code sent to your email' });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: 'Error processing request', error: error.message });
    }
};

exports.verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user || user.resetToken !== code || new Date() > user.resetTokenExpiry) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }
        
        res.json({ message: 'Code verified' });
    } catch (error) {
        console.error("Verify Code Error:", error);
        res.status(500).json({ message: 'Error verifying code', error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || user.resetToken !== code || new Date() > user.resetTokenExpiry) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { email },
            data: { 
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Attempting login for:", email);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log("User not found:", email);
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordIsValid = await bcrypt.compare(password, user.password);

    if (!passwordIsValid) {
      console.log("Invalid password for:", email);
      return res.status(401).json({ token: null, message: 'Invalid Password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: 86400, // 24 hours
    });
    
    console.log("Login successful:", email);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      leaveQuota: user.leaveQuota,
      accessToken: token,
    });
  } catch (error) {
    console.error("Signin Error:", error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
