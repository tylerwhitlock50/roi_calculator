import type { IdeaStatus } from '@prisma/client'

import { badRequest } from '@/lib/http'

const statusMap: Record<string, IdeaStatus> = {
  draft: 'DRAFT',
  in_review: 'IN_REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  archived: 'ARCHIVED',
}

export function parseIdeaStatus(value: unknown): IdeaStatus {
  if (typeof value !== 'string' || !(value in statusMap)) {
    throw badRequest('Invalid idea status')
  }

  return statusMap[value]
}
