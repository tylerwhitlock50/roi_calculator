import { prisma } from '@/lib/prisma'

export const ideaSummaryInclude = {
  createdBy: true,
  roiSummary: true,
} as const

export const ideaDetailInclude = {
  createdBy: true,
  roiSummary: true,
  salesForecasts: {
    include: {
      contributor: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  costEstimates: {
    include: {
      createdBy: true,
      bomParts: true,
      laborEntries: {
        include: {
          activity: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const

export async function findIdeaForDetail(id: string) {
  return prisma.idea.findUnique({
    where: { id },
    include: ideaDetailInclude,
  })
}
