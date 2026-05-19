import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";


interface ServiceConfig {
  mandatoryProviderIds: number[];
  rotatingPool: number[];
  totalAssignments: number; // always 3
}

const SERVICE_CONFIG: Record<number, ServiceConfig> = {
  1: {
    mandatoryProviderIds: [1],
    rotatingPool: [2, 3, 4],
    totalAssignments: 3,
  },
  2: {
    mandatoryProviderIds: [5],
    rotatingPool: [6, 7, 8],
    totalAssignments: 3,
  },
  3: {
    mandatoryProviderIds: [1, 4],
    rotatingPool: [2, 3, 5, 6, 7, 8],
    totalAssignments: 3,
  },
};


export async function assignProvidersToLead(leadId: number, serviceId: number) {
  const config = SERVICE_CONFIG[serviceId];
  if (!config) throw new Error(`Unknown serviceId: ${serviceId}`);

  const rotatingNeeded =
    config.totalAssignments - config.mandatoryProviderIds.length;

  return await prisma.$transaction(
    async (tx) => {
      const [allocationState] = await tx.$queryRaw<
        Array<{ id: number; lastIndex: number }>
      >`
        SELECT id, "lastIndex"
        FROM "AllocationState"
        WHERE "serviceId" = ${serviceId}
        FOR UPDATE
      `;

      if (!allocationState) {
        throw new Error(
          `AllocationState not found for serviceId ${serviceId}`
        );
      }

      const mandatoryProviders = await tx.provider.findMany({
        where: { id: { in: config.mandatoryProviderIds } },
      });

      const rotatingProviders = await selectRotatingProviders(
        tx,
        config.rotatingPool,
        rotatingNeeded,
        config.mandatoryProviderIds,
        allocationState.lastIndex
      );

      const allSelected = [
        ...mandatoryProviders,
        ...rotatingProviders.selected,
      ];

      if (allSelected.length < config.totalAssignments) {
        throw new Error(
          `Not enough eligible providers (quota available) to assign lead ${leadId}. ` +
            `Need ${config.totalAssignments}, got ${allSelected.length}.`
        );
      }

      await tx.leadAssignment.createMany({
        data: allSelected.map((p) => ({
          leadId,
          providerId: p.id,
        })),
        skipDuplicates: true,
      });

      await tx.provider.updateMany({
        where: { id: { in: allSelected.map((p) => p.id) } },
        data: { usedQuota: { increment: 1 } },
      });

      await tx.allocationState.update({
        where: { id: allocationState.id },
        data: { lastIndex: rotatingProviders.nextIndex },
      });

      return allSelected;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    }
  );
}

interface RotatingResult {
  selected: Array<{ id: number; name: string; monthlyQuota: number; usedQuota: number }>;
  nextIndex: number;
}

async function selectRotatingProviders(
  tx: Prisma.TransactionClient,
  pool: number[],
  needed: number,
  exclude: number[],
  startIndex: number
): Promise<RotatingResult> {
  if (needed === 0) {
    return { selected: [], nextIndex: startIndex };
  }

  const poolProviders = await tx.provider.findMany({
    where: { id: { in: pool } },
  });

  const quotaMap = new Map(poolProviders.map((p) => [p.id, p]));

  const selected: typeof poolProviders = [];
  let index = startIndex % pool.length;
  let attempts = 0;
  const maxAttempts = pool.length * 2;

  while (selected.length < needed && attempts < maxAttempts) {
    const candidateId = pool[index % pool.length];
    const candidate = quotaMap.get(candidateId);

    const isExcluded = exclude.includes(candidateId);
    const hasQuota =
      candidate && candidate.usedQuota < candidate.monthlyQuota;
    const alreadySelected = selected.some((s) => s.id === candidateId);

    if (!isExcluded && hasQuota && !alreadySelected && candidate) {
      selected.push(candidate);
    }

    index = (index + 1) % pool.length;
    attempts++;
  }

  const nextIndex = index % pool.length;

  return { selected, nextIndex };
}


export { SERVICE_CONFIG };
