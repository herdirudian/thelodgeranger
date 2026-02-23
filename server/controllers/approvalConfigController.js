const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

function logDebug(message) {
  try {
    const logPath = path.join(__dirname, '../approval_debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Failed to write to debug log:', err);
  }
}

exports.getConfigs = async (req, res) => {
  try {
    const { module, department } = req.query;

    const where = {};
    if (module) {
      where.module = module;
    }
    if (department) {
      where.department = department;
    }

    const configs = await prisma.approvalConfig.findMany({
      where,
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    logDebug(`[getConfigs] Module: ${module}, Dept: ${department}, Found: ${configs.length}, IDs: ${configs.map(c => c.id).join(', ')}`);

    res.status(200).json(configs);
  } catch (error) {
    logDebug(`[getConfigs] Error: ${error.message}`);
    res.status(500).json({ message: 'Error fetching approval configs', error: error.message });
  }
};

exports.getConfigById = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await prisma.approvalConfig.findUnique({
      where: { id: parseInt(id) },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                department: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!config) {
      return res.status(404).json({ message: 'Approval config not found' });
    }

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approval config', error: error.message });
  }
};

exports.createConfig = async (req, res) => {
  try {
    const { module, department, enabled = true, steps = [], assignments = [] } = req.body;

    // Debug log
    const payloadLog = JSON.stringify({ 
      module,
      department, 
      enabled, 
      stepsCount: steps ? steps.length : 'undefined', 
      stepsPayload: steps,
      assignmentsCount: assignments ? assignments.length : 'undefined' 
    });
    console.log(`[createConfig] Payload:`, payloadLog);
    logDebug(`[createConfig] Payload: ${payloadLog}`);

    const result = await prisma.$transaction(async tx => {
      const config = await tx.approvalConfig.create({
        data: {
          module,
          department: department || null,
          enabled
        }
      });

      if (Array.isArray(steps) && steps.length > 0) {
        await tx.approvalStep.createMany({
          data: steps.map(step => ({
            approvalConfigId: config.id,
            order: parseInt(step.order),
            role: step.role,
            minApprovals: step.minApprovals || null
          }))
        });
      }

      if (Array.isArray(assignments) && assignments.length > 0) {
        await tx.approvalAssignment.createMany({
          data: assignments.map(a => ({
            approvalConfigId: config.id,
            userId: parseInt(a.userId),
            department: a.department || null,
            role: a.role || null
          }))
        });
      }

      return tx.approvalConfig.findUnique({
        where: { id: config.id },
        include: {
          steps: {
            orderBy: { order: 'asc' }
          },
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                  role: true
                }
              }
            }
          }
        }
      });
    });

    logDebug(`[createConfig] Success. ID: ${result.id}`);
    res.status(201).json(result);
  } catch (error) {
    console.error('[createConfig] Error:', error);
    logDebug(`[createConfig] Error: ${error.message} \nStack: ${error.stack}`);
    res.status(500).json({ message: 'Error creating approval config', error: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { department, enabled, steps, assignments } = req.body;
    
    // Debug log
    const payloadLog = JSON.stringify({ 
      department, 
      enabled, 
      stepsCount: steps ? steps.length : 'undefined', 
      stepsPayload: steps,
      assignmentsCount: assignments ? assignments.length : 'undefined' 
    });
    console.log(`[updateConfig] ID: ${id}, Payload:`, payloadLog);
    logDebug(`[updateConfig] ID: ${id}, Payload: ${payloadLog}`);

    const result = await prisma.$transaction(async tx => {
      const data = {};
      if (department !== undefined) {
        data.department = department;
      }
      if (enabled !== undefined) {
        data.enabled = enabled;
      }

      // 1. Update main config
      const config = await tx.approvalConfig.update({
        where: { id: parseInt(id) },
        data
      });

      // 2. Handle Steps
      if (Array.isArray(steps)) {
        // Delete existing steps
        await tx.approvalStep.deleteMany({
          where: { approvalConfigId: config.id }
        });

        // Create new steps
        if (steps.length > 0) {
          await tx.approvalStep.createMany({
            data: steps.map(step => ({
              approvalConfigId: config.id,
              order: parseInt(step.order),
              role: step.role, // Enum validation handled by Prisma
              minApprovals: step.minApprovals || null
            }))
          });
        }
      }

      // 3. Handle Assignments
      if (Array.isArray(assignments)) {
        // Delete existing assignments
        await tx.approvalAssignment.deleteMany({
          where: { approvalConfigId: config.id }
        });

        // Create new assignments
        if (assignments.length > 0) {
          await tx.approvalAssignment.createMany({
            data: assignments.map(a => ({
              approvalConfigId: config.id,
              userId: parseInt(a.userId),
              department: a.department || null,
              role: a.role || null
            }))
          });
        }
      }

      // 4. Return updated structure
      return tx.approvalConfig.findUnique({
        where: { id: config.id },
        include: {
          steps: {
            orderBy: { order: 'asc' }
          },
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  department: true,
                  role: true
                }
              }
            }
          }
        }
      });
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('[updateConfig] Error:', error);
    logDebug(`[updateConfig] Error: ${error.message} \nStack: ${error.stack}`);
    res.status(500).json({ message: 'Error updating approval config', error: error.message });
  }
};

exports.deleteConfig = async (req, res) => {
  try {
    const { id } = req.params;
    
    logDebug(`[deleteConfig] ID: ${id}`);

    await prisma.approvalConfig.delete({
      where: { id: parseInt(id) }
    });

    logDebug(`[deleteConfig] Success. ID: ${id}`);
    res.status(200).json({ message: 'Approval config deleted successfully' });
  } catch (error) {
    logDebug(`[deleteConfig] Error: ${error.message}`);
    res.status(500).json({ message: 'Error deleting approval config', error: error.message });
  }
};
