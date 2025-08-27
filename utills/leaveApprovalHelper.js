const LeaveRequest = require('../model/leave_model');
const User = require('../model/admin.model');

class LeaveApprovalHelper {
  
  /**
   * Get approval hierarchy for an employee
   */
  static async getApprovalHierarchy(employeeId) {
    try {
      const employee = await User.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const hierarchy = {
        teamLead: null,
        manager: null,
        hr: null,
        admin: null
      };

      // Find team lead (same department, role: teamLead)
      if (employee.department) {
        hierarchy.teamLead = await User.findOne({
          department: employee.department,
          role: 'teamLead',
          _id: { $ne: employeeId }
        });
      }

      // Find manager (same department, role: manager)
      if (employee.department) {
        hierarchy.manager = await User.findOne({
          department: employee.department,
          role: 'manager',
          _id: { $ne: employeeId }
        });
      }

      // Find HR (role: hr)
      hierarchy.hr = await User.findOne({
        role: 'hr',
        _id: { $ne: employeeId }
      });

      // Find Admin (role: admin)
      hierarchy.admin = await User.findOne({
        role: 'admin',
        _id: { $ne: employeeId }
      });

      return hierarchy;
    } catch (error) {
      console.error('Error getting approval hierarchy:', error);
      throw error;
    }
  }

  /**
   * Create leave request with proper approval hierarchy
   */
  static async createLeaveRequest(leaveData) {
    try {
      const { employeeId, ...otherData } = leaveData;
      
      // Get employee details
      const employee = await User.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get approval hierarchy
      const hierarchy = await this.getApprovalHierarchy(employeeId);

      // Create leave request
      const leaveRequest = new LeaveRequest({
        employeeId,
        employeeName: employee.name,
        ...otherData,
        approvals: {
          teamLead: {
            id: hierarchy.teamLead?._id || null,
            name: hierarchy.teamLead?.name || null,
            status: hierarchy.teamLead ? 'pending' : 'not_required',
          },
          manager: {
            id: hierarchy.manager?._id || null,
            name: hierarchy.manager?.name || null,
            status: hierarchy.manager ? 'pending' : 'not_required',
          },
          hr: {
            id: hierarchy.hr?._id || null,
            name: hierarchy.hr?.name || null,
            status: hierarchy.hr ? 'pending' : 'not_required',
          },
          admin: {
            id: hierarchy.admin?._id || null,
            name: hierarchy.admin?.name || null,
            status: 'not_required', // Admin doesn't need to approve by default
            isOverride: false,
          },
        },
        createdBy: {
          id: employeeId,
          name: employee.name,
        },
      });

      return await leaveRequest.save();
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * Process approval/rejection
   */
  static async processApproval(leaveId, approverId, action, comment = '') {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      const approver = await User.findById(approverId);
      if (!approver) {
        throw new Error('Approver not found');
      }

      // Determine approver role
      let approverRole = null;
      if (leaveRequest.approvals.teamLead.id?.equals(approverId)) {
        approverRole = 'teamLead';
      } else if (leaveRequest.approvals.manager.id?.equals(approverId)) {
        approverRole = 'manager';
      } else if (leaveRequest.approvals.hr.id?.equals(approverId)) {
        approverRole = 'hr';
      } else if (approver.role === 'admin') {
        approverRole = 'admin';
      }

      if (!approverRole) {
        throw new Error('You are not authorized to approve this leave request');
      }

      // Process action
      if (action === 'approve') {
        await leaveRequest.approve(approverId, approver.name, approverRole, comment);
        
        // Auto-advance to next approver if current is approved (except admin)
        if (approverRole !== 'admin') {
          await this.advanceToNextApprover(leaveRequest);
        }
        
      } else if (action === 'reject') {
        await leaveRequest.reject(approverId, approver.name, approverRole, comment);
      }

      return leaveRequest;
    } catch (error) {
      console.error('Error processing approval:', error);
      throw error;
    }
  }

  /**
   * Admin override - Admin can approve/reject any leave directly
   */
  static async adminOverride(leaveId, adminId, action, comment = '') {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Only admin can perform override actions');
      }

      await leaveRequest.adminOverride(adminId, admin.name, action, comment);
      return leaveRequest;
    } catch (error) {
      console.error('Error processing admin override:', error);
      throw error;
    }
  }

  /**
   * Advance to next approver in hierarchy
   */
  static async advanceToNextApprover(leaveRequest) {
    try {
      // Check if team lead approved, move to manager
      if (leaveRequest.approvals.teamLead.status === 'approved' && 
          leaveRequest.approvals.manager.status === 'pending') {
        leaveRequest.approvals.manager.status = 'pending';
      }
      
      // Check if manager approved, move to HR
      else if (leaveRequest.approvals.manager.status === 'approved' && 
               leaveRequest.approvals.hr.status === 'pending') {
        leaveRequest.approvals.hr.status = 'pending';
      }
      
      // If HR approved, mark as fully approved
      else if (leaveRequest.approvals.hr.status === 'approved') {
        leaveRequest.status = 'approved';
      }

      await leaveRequest.save();
    } catch (error) {
      console.error('Error advancing to next approver:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for an approver
   */
  static async getPendingApprovals(approverId) {
    try {
      const approver = await User.findById(approverId);
      if (!approver) {
        throw new Error('Approver not found');
      }

      let role = null;
      if (approver.role === 'teamLead') role = 'teamLead';
      else if (approver.role === 'manager') role = 'manager';
      else if (approver.role === 'hr') role = 'hr';
      else if (approver.role === 'admin') role = 'admin';

      if (!role) {
        throw new Error('Invalid approver role');
      }

      return await LeaveRequest.findPendingApprovals(approverId, role);
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get all leaves for admin (admin can see everything)
   */
  static async getAllLeavesForAdmin(adminId, filters = {}) {
    try {
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Only admin can access all leaves');
      }

      const query = {};
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.department) query['employee.department'] = filters.department;
      if (filters.fromDate && filters.toDate) {
        query.fromDate = { $gte: new Date(filters.fromDate) };
        query.toDate = { $lte: new Date(filters.toDate) };
      }

      return await LeaveRequest.find(query).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting all leaves for admin:', error);
      throw error;
    }
  }

  /**
   * Cancel leave request
   */
  static async cancelLeaveRequest(leaveId, employeeId) {
    try {
      const leaveRequest = await LeaveRequest.findById(leaveId);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Check if employee owns this request
      if (!leaveRequest.employeeId.equals(employeeId)) {
        throw new Error('You can only cancel your own leave requests');
      }

      // Check if already approved
      if (leaveRequest.status === 'approved') {
        throw new Error('Cannot cancel approved leave request');
      }

      leaveRequest.status = 'cancelled';
      await leaveRequest.save();

      return leaveRequest;
    } catch (error) {
      console.error('Error cancelling leave request:', error);
      throw error;
    }
  }

  /**
   * Get leave statistics for an employee
   */
  static async getLeaveStatistics(employeeId) {
    try {
      const leaves = await LeaveRequest.findByEmployee(employeeId);
      
      const stats = {
        total: leaves.length,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        totalDays: 0,
        approvedDays: 0,
      };

      leaves.forEach(leave => {
        stats[leave.status]++;
        stats.totalDays += leave.totalDays || 0;
        if (leave.status === 'approved') {
          stats.approvedDays += leave.actualDays || 0;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting leave statistics:', error);
      throw error;
    }
  }

  /**
   * Get admin dashboard statistics
   */
  static async getAdminDashboardStats(adminId) {
    try {
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin') {
        throw new Error('Only admin can access dashboard stats');
      }

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const [
        totalLeaves,
        pendingLeaves,
        approvedLeaves,
        rejectedLeaves,
        thisMonthLeaves,
        adminOverrides,
      ] = await Promise.all([
        LeaveRequest.countDocuments(),
        LeaveRequest.countDocuments({ status: 'pending' }),
        LeaveRequest.countDocuments({ status: 'approved' }),
        LeaveRequest.countDocuments({ status: 'rejected' }),
        LeaveRequest.countDocuments({
          fromDate: { $gte: startOfMonth },
          toDate: { $lte: endOfMonth },
        }),
        LeaveRequest.countDocuments({ 'approvals.admin.isOverride': true }),
      ]);

      const stats = {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves,
        rejected: rejectedLeaves,
        thisMonth: thisMonthLeaves,
        adminOverrides,
      };

      return stats;
    } catch (error) {
      console.error('Error getting admin dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Validate leave request dates
   */
  static validateLeaveDates(fromDate, toDate, employeeId) {
    const errors = [];

    // Check if dates are valid
    if (!fromDate || !toDate) {
      errors.push('From date and to date are required');
    }

    // Check if from date is before to date
    if (fromDate && toDate && fromDate > toDate) {
      errors.push('From date cannot be later than to date');
    }

    // Check if dates are in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (fromDate && fromDate < today) {
      errors.push('Cannot apply for leave in the past');
    }

    // Check if leave is for more than 30 days
    if (fromDate && toDate) {
      const diffTime = Math.abs(toDate - fromDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays > 30) {
        errors.push('Cannot apply for leave more than 30 days at once');
      }
    }

    return errors;
  }

  /**
   * Check if user can perform admin override
   */
  static async canPerformAdminOverride(userId) {
    try {
      const user = await User.findById(userId);
      return user && user.role === 'admin';
    } catch (error) {
      console.error('Error checking admin override permission:', error);
      return false;
    }
  }
}

module.exports = LeaveApprovalHelper; 