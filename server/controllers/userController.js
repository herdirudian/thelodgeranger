const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getAllUsers = async (req, res) => {
  try {
    const requesterId = req.userId;
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    
    let whereClause = {};

    if (requester.role === 'HOD') {
        whereClause.department = requester.department;
    }
    
    // Optional: Filter by department query param if provided (and allowed)
    if (req.query.department) {
        if (requester.role === 'HOD') {
             // HOD restricted to own department
             whereClause.department = requester.department;
        } else {
             // GM/HR/Admin can filter
             whereClause.department = req.query.department;
        }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        leaveQuota: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.getColleagues = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                department: true
            },
            orderBy: { name: 'asc' }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching colleagues', error: error.message });
    }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, name, role, department, leaveQuota } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        department,
        leaveQuota: leaveQuota ? parseInt(leaveQuota) : 12
      }
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, password, leaveQuota } = req.body;
    
    let dataToUpdate = { name, email, role, department };

    if (leaveQuota !== undefined) {
        dataToUpdate.leaveQuota = parseInt(leaveQuota);
    }
    
    if (password && password.trim() !== "") {
        dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

exports.getPublicUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                department: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching public user profile', error: error.message });
    }
};
