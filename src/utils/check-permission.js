const StaffInfo = require("../models/staff-info");

const checkPermission = async (action, userId) => {
  try {
    const staffInfo = await StaffInfo.findOne({ staff: userId });

    if (!staffInfo) {
      throw new Error("Staff Information not found");
    }
    
    const permissions = staffInfo.permissions;
    const isPermitted = permissions[action];
    return isPermitted;
  } catch (e) {
    throw new Error(e.messaage);
  }
};

module.exports = checkPermission;
