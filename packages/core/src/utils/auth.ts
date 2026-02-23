import { UserRole } from '../types';

/**
 * Utilitaires pour la gestion des rôles et redirections
 *
 * Ce module fournit des fonctions utilitaires pour :
 * - Déterminer le chemin du dashboard selon le rôle
 * - Vérifier si un utilisateur peut accéder à une route
 * - Obtenir le nom affiché du rôle
 * - Obtenir la description du rôle
 */

/**
 * Retourne le chemin du dashboard selon le rôle
 *
 * @param role - Le rôle de l'utilisateur
 * @returns Le chemin du dashboard
 *
 * @example
 * ```ts
 * getDefaultDashboardPath('school_admin') // '/admin'
 * getDefaultDashboardPath('student') // '/student'
 * ```
 */
export function getDefaultDashboardPath(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'school_admin':
      return '/admin';
    case 'accountant':
      return '/accountant';
    case 'teacher':
      return '/teacher';
    case 'student':
      return '/student';
    case 'parent':
      return '/parent';
    case 'supervisor':
      return '/supervisor';
    default:
      return '/login';
  }
}

/**
 * Vérifie si l'utilisateur peut accéder à une route selon son rôle
 *
 * @param userRole - Le rôle de l'utilisateur
 * @param requiredRoles - Les rôles autorisés pour la route
 * @returns true si l'utilisateur a accès, false sinon
 *
 * @example
 * ```ts
 * canAccessRoute('school_admin', ['school_admin', 'super_admin']) // true
 * canAccessRoute('student', ['teacher', 'school_admin']) // false
 * ```
 */
export function canAccessRoute(
  userRole: UserRole,
  requiredRoles: UserRole[]
): boolean {
  // Le super_admin a accès à tout
  if (userRole === 'super_admin') {
    return true;
  }

  // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
  return requiredRoles.includes(userRole);
}

/**
 * Retourne le nom affiché du rôle en français
 *
 * @param role - Le rôle
 * @returns Le nom affiché du rôle
 *
 * @example
 * ```ts
 * getRoleDisplayName('school_admin') // 'Administrateur d'école'
 * getRoleDisplayName('student') // 'Élève'
 * ```
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    school_admin: 'Administrateur d\'école',
    accountant: 'Comptable',
    teacher: 'Enseignant',
    student: 'Élève',
    parent: 'Parent',
    supervisor: 'Surveillant',
  };

  return roleNames[role] || role;
}

/**
 * Retourne la description du rôle
 *
 * @param role - Le rôle
 * @returns La description du rôle
 *
 * @example
 * ```ts
 * getRoleDescription('school_admin') // 'Gérer l'école, les utilisateurs et les paramètres'
 * getRoleDescription('student') // 'Accéder à l'EDT, aux notes et aux devoirs'
 * ```
 */
export function getRoleDescription(role: UserRole): string {
  const roleDescriptions: Record<UserRole, string> = {
    super_admin: 'Administrateur global de NovaConnectSchool',
    school_admin: 'Gérer l\'école, les utilisateurs et les paramètres',
    accountant: 'Gérer les finances, les paiements et les salaires',
    teacher: 'Gérer les classes, les notes et les présences',
    student: 'Accéder à l\'EDT, aux notes et aux devoirs',
    parent: 'Suivre les enfants, les notes et les présences',
    supervisor: 'Surveiller les élèves et gérer les absences',
  };

  return roleDescriptions[role] || '';
}

/**
 * Retourne les permissions par défaut pour un rôle
 *
 * @param role - Le rôle
 * @returns La liste des permissions
 *
 * @example
 * ```ts
 * getRolePermissions('school_admin')
 * // ['schools:read', 'schools:write', 'users:read', 'users:write', ...]
 * ```
 */
export function getRolePermissions(role: UserRole): string[] {
  // Ces permissions sont des exemples et doivent être adaptées à votre application
  const rolePermissions: Record<UserRole, string[]> = {
    super_admin: [
      'schools:read',
      'schools:write',
      'schools:delete',
      'users:read',
      'users:write',
      'users:delete',
      'audit:read',
      'settings:read',
      'settings:write',
    ],
    school_admin: [
      'school:read',
      'school:write',
      'students:read',
      'students:write',
      'teachers:read',
      'teachers:write',
      'classes:read',
      'classes:write',
      'schedule:read',
      'schedule:write',
      'grades:read',
      'grades:write',
      'finances:read',
    ],
    accountant: [
      'school:read',
      'payments:read',
      'payments:write',
      'salaries:read',
      'salaries:write',
      'reports:read',
    ],
    teacher: [
      'classes:read',
      'schedule:read',
      'attendance:write',
      'grades:write',
      'homework:write',
    ],
    student: [
      'schedule:read',
      'grades:read',
      'homework:read',
      'attendance:read',
      'payments:read',
    ],
    parent: [
      'children:read',
      'grades:read',
      'attendance:read',
      'payments:read',
    ],
    supervisor: [
      'students:read',
      'attendance:read',
      'attendance:write',
      'discipline:read',
      'discipline:write',
    ],
  };

  return rolePermissions[role] || [];
}

/**
 * Vérifie si un rôle a une permission spécifique
 *
 * @param role - Le rôle
 * @param permission - La permission à vérifier
 * @returns true si le rôle a la permission, false sinon
 *
 * @example
 * ```ts
 * hasPermission('school_admin', 'students:write') // true
 * hasPermission('student', 'students:write') // false
 * ```
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Retourne la couleur associée au rôle (pour l'affichage UI)
 *
 * @param role - Le rôle
 * @returns La couleur CSS (tailwind class ou hex)
 *
 * @example
 * ```ts
 * getRoleColor('school_admin') // 'blue'
 * getRoleColor('student') // 'green'
 * ```
 */
export function getRoleColor(role: UserRole): string {
  const roleColors: Record<UserRole, string> = {
    super_admin: 'purple',
    school_admin: 'blue',
    accountant: 'yellow',
    teacher: 'green',
    student: 'indigo',
    parent: 'pink',
    supervisor: 'orange',
  };

  return roleColors[role] || 'gray';
}

/**
 * Retourne l'icône associée au rôle
 *
 * @param role - Le rôle
 * @returns Le nom de l'icône (pour Heroicons, FontAwesome, etc.)
 *
 * @example
 * ```ts
 * getRoleIcon('school_admin') // 'building'
 * getRoleIcon('student') // 'user'
 * ```
 */
export function getRoleIcon(role: UserRole): string {
  const roleIcons: Record<UserRole, string> = {
    super_admin: 'shield',
    school_admin: 'building',
    accountant: 'currency',
    teacher: 'academic-cap',
    student: 'user',
    parent: 'users',
    supervisor: 'eye',
  };

  return roleIcons[role] || 'user';
}

/**
 * Compare deux rôles et retourne lequel a plus de permissions
 * Utile pour les hiérarchies de rôles
 *
 * @param role1 - Premier rôle
 * @param role2 - Deuxième rôle
 * @returns 1 si role1 > role2, -1 si role1 < role2, 0 si égaux
 *
 * @example
 * ```ts
 * compareRoles('super_admin', 'school_admin') // 1 (super_admin > school_admin)
 * compareRoles('student', 'teacher') // -1 (student < teacher)
 * ```
 */
export function compareRoles(role1: UserRole, role2: UserRole): number {
  const hierarchy: Record<UserRole, number> = {
    super_admin: 7,
    school_admin: 6,
    accountant: 5,
    teacher: 4,
    supervisor: 3,
    parent: 2,
    student: 1,
  };

  const level1 = hierarchy[role1] || 0;
  const level2 = hierarchy[role2] || 0;

  if (level1 > level2) return 1;
  if (level1 < level2) return -1;
  return 0;
}
