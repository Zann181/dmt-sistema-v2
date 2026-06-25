const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: "postgresql://postgres.qoxbpyymyttfqydogvcj:96w4gKf7wxhn1TSX@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  
  try {
    const res = await client.query(`
      UPDATE branches
      SET 
        "primaryColor" = '#39ff14',
        "secondaryColor" = '#e9ffe9',
        "pageBackgroundColor" = '#000000',
        "surfaceColor" = '#0f1113',
        "panelColor" = '#15181c',
        "textColor" = '#ffffff',
        "titleColor" = '#39ff14',
        "logoBgColor" = '#15181c'
    `);
    console.log('Fixed', res.rowCount, 'branches to neon dark theme with text and title color');

    const res2 = await client.query(`
      UPDATE "events"
      SET "qrLogoUrl" = ''
      WHERE "qrLogoUrl" LIKE '<svg%'
    `);
    console.log('Fixed', res2.rowCount, 'events with SVG in qrLogoUrl');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

fix().catch(console.error);
