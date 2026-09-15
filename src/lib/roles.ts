import { UserRole } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  vendedor: 'Vendedor',
  coordinador: 'Coordinador',
  regional: 'Regional',
  administrador: 'Administrador',
};

// Puede modificar objetivos/configuración de la sede (no solo cargar ventas)
export const canEditTargets = (role: UserRole): boolean =>
  role === 'coordinador' || role === 'regional' || role === 'administrador';

// Puede crear/editar/eliminar usuarios
export const canManageUsers = (role: UserRole): boolean => role === 'administrador';

// Puede crear sedes nuevas y ver todas (no solo las asignadas)
export const canManageAllSedes = (role: UserRole): boolean => role === 'administrador';
