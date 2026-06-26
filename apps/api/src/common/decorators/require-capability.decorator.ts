import { SetMetadata } from '@nestjs/common';
import type { PermissionModule, Capability } from '@swalo/core/modules/permissions';

export const REQUIRED_CAPABILITY_KEY = 'required_capability';

export interface RequiredCapability {
  module: PermissionModule;
  capability: Capability;
}

/**
 * Exige une capacité fine (module × capacité) sur l'endpoint décoré.
 * Le `CapabilityGuard` résout les permissions effectives du rôle courant
 * (config boutique > défaut entreprise > défauts intégrés) et refuse en 403
 * si la capacité n'est pas accordée. SUPERADMIN contourne toujours.
 */
export const RequireCapability = (module: PermissionModule, capability: Capability) =>
  SetMetadata<string, RequiredCapability>(REQUIRED_CAPABILITY_KEY, { module, capability });
