import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  
  await prisma.leadAssignment.deleteMany();
  await prisma.allocationState.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();
  await prisma.webhookEvent.deleteMany();

  const services = await Promise.all([
    prisma.service.create({ data: { id: 1, name: "Service 1" } }),
    prisma.service.create({ data: { id: 2, name: "Service 2" } }),
    prisma.service.create({ data: { id: 3, name: "Service 3" } }),
  ]);

  console.log(`✅ Created ${services.length} services`);

  const providers = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      prisma.provider.create({
        data: {
          id: i + 1,
          name: `Provider ${i + 1}`,
          monthlyQuota: 10,
          usedQuota: 0,
        },
      })
    )
  );

  console.log(`✅ Created ${providers.length} providers`);

  await Promise.all(
    services.map((service) =>
      prisma.allocationState.create({
        data: { serviceId: service.id, lastIndex: 0 },
      })
    )
  );

  console.log("✅ Initialized allocation state for all services");
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
