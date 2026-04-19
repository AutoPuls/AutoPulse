import "./lib/envBootstrap";
import { prisma } from "./lib/prisma";

async function main() {
  try {
    const subs = await prisma.subscription.findMany();
    console.log("SUBSCRIPTIONS_START");
    console.log(JSON.stringify(subs, null, 2));
    console.log("SUBSCRIPTIONS_END");

    const recentBmw = await prisma.listing.findMany({
      where: {
        OR: [
          { make: { contains: "BMW", mode: "insensitive" } },
          { rawTitle: { contains: "BMW", mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 5
    });
    console.log("RECENT_BMW_START");
    console.log(JSON.stringify(recentBmw, null, 2));
    console.log("RECENT_BMW_END");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
