import type { ResidentAccount } from './residentAuth';
import type { StaffPermission } from './adminData';
export function canManage(account: ResidentAccount | null | undefined, permission: StaffPermission) {
 return account?.role==='staff' && (account.superadmin===true || account.permissions?.includes(permission)===true);
}
