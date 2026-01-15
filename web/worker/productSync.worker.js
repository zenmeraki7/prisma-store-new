import { Worker } from "bullmq";
import IORedis from "ioredis";
import { syncProducts } from "../services/productSync.service.js";

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

const worker = new Worker(
  "productSyncQueue",
  async job => {
    console.log(`🔄 Processing job ${job.id} for shop ${job.data.shop}`);
    const session = {
      shop: job.data.shop,
      accessToken: job.data.accessToken,
    };

    await syncProducts(session);
    console.log(`✅ Products synced for shop ${job.data.shop}`);
  },
  { connection }
);

worker.on("completed", job => {
  console.log(`🎉 Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

console.log("📥 Product sync worker running...");
