import { Client } from "pg";
import "dotenv/config";

async function test() {
  const directUrl = process.env.DATABASE_DIRECT_URL;
  const pooledUrl = process.env.DATABASE_URL;

  let cleanDirectUrl = "";
  let cleanPooledUrl = "";

  if (directUrl) {
    const tempUrl = new URL(directUrl.replace("postgresql:", "http:"));
    tempUrl.searchParams.delete("sslmode");
    cleanDirectUrl = tempUrl.toString().replace("http:", "postgresql:");
  }

  if (pooledUrl) {
    const tempUrl = new URL(pooledUrl.replace("postgresql:", "http:"));
    tempUrl.searchParams.delete("sslmode");
    cleanPooledUrl = tempUrl.toString().replace("http:", "postgresql:");
  }

  console.log("Clean Direct URL:", cleanDirectUrl);
  console.log("Clean Pooled URL:", cleanPooledUrl);

  if (cleanDirectUrl) {
    console.log("Testing Clean Direct URL...");
    const client = new Client({ 
      connectionString: cleanDirectUrl,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log("✅ Direct connection successful!");
      const res = await client.query("SELECT NOW()");
      console.log("Time from DB:", res.rows[0]);
      await client.end();
    } catch (e) {
      console.error("❌ Direct connection failed:", e);
    }
  }

  if (cleanPooledUrl) {
    console.log("Testing Clean Pooled URL...");
    const client = new Client({ 
      connectionString: cleanPooledUrl,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log("✅ Pooled connection successful!");
      const res = await client.query("SELECT NOW()");
      console.log("Time from DB:", res.rows[0]);
      await client.end();
    } catch (e) {
      console.error("❌ Pooled connection failed:", e);
    }
  }
}

test();
