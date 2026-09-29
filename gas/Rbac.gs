function hasPermission(permission){return getCurrentUser_().permissions.includes(String(permission));}
function getMyPermissions(){const u=getCurrentUser_();return {authenticated:u.authenticated,role:u.role,permissions:u.permissions};}
function requireAdmin_(){return requirePermission_('admin.config');}
