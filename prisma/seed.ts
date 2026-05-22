import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.upsert({
    where: { key: "founder_os" },
    update: {},
    create: {
      key: "founder_os",
      name: "Founder OS",
      owner: "founder",
      runtime: "nextjs",
      repositories: {
        create: {
          provider: "github",
          url: "https://github.com/olegp306/Founder_OS",
          defaultBranch: "main"
        }
      },
      environments: {
        create: {
          kind: "PRODUCTION",
          isolation: "founder-shared"
        }
      }
    }
  });

  await prisma.assistant.upsert({
    where: {
      projectId_key: {
        projectId: project.id,
        key: "founder_os_admin"
      }
    },
    update: {},
    create: {
      projectId: project.id,
      key: "founder_os_admin",
      name: "Founder OS Admin Assistant"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
