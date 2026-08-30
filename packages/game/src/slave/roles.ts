import type { PlayerId } from '../core/player'
import type { RoleName } from './types'

/**
 * Map a finishing order onto roles.
 *
 * The winner is President and the last player is Slave. With four or more
 * players the runner-up and the second-to-last become the Vice pair; everyone
 * between them is a Citizen and exchanges nothing.
 */
export function assignRoles(finishOrder: readonly PlayerId[]): Record<PlayerId, RoleName> {
  const n = finishOrder.length
  const roles: Record<PlayerId, RoleName> = {}
  finishOrder.forEach((id, index) => {
    if (index === 0) roles[id] = 'president'
    else if (index === n - 1) roles[id] = 'slave'
    else if (n >= 4 && index === 1) roles[id] = 'vicePresident'
    else if (n >= 4 && index === n - 2) roles[id] = 'viceSlave'
    else roles[id] = 'citizen'
  })
  return roles
}

export function findByRole(
  roles: Readonly<Record<PlayerId, RoleName>>,
  role: RoleName,
): PlayerId | null {
  for (const [id, value] of Object.entries(roles)) {
    if (value === role) return id
  }
  return null
}
