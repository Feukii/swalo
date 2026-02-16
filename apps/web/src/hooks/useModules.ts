import { useAuthStore } from '../store/authStore';
import { MODULE_DEFINITIONS } from '@swalo/core/modules/registry';

export function useModules() {
  const { enabledModules, licenseTier, role } = useAuthStore();

  const isModuleEnabled = (moduleCode: string): boolean => {
    // SUPERADMIN sees everything
    if (role === 'SUPERADMIN') return true;
    // Empty array = all allowed (backwards compat)
    if (enabledModules.length === 0) return true;
    return enabledModules.includes(moduleCode);
  };

  return { isModuleEnabled, enabledModules, licenseTier };
}

export function getModuleDisplayName(code: string): string {
  const def = MODULE_DEFINITIONS.find(m => m.code === code);
  return def?.name ?? code;
}
