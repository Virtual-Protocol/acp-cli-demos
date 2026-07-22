import "dotenv/config";

async function run() {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    console.error("HEYGEN_API_KEY is not set.");
    process.exit(1);
  }

  console.log(`Testing HeyGen API key: ${apiKey.slice(0, 8)}...`);

  const response = await fetch("https://api.heygen.com/v3/assets", {
    method: "POST",
    headers: {
      "x-api-key": apiKey
    }
  });

  const text = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${text}`);
}

run().catch(console.error);
