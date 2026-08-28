const { Client } = require('pg');

const urls = [
  {
    name: "Password 1 (L6Ciu...)",
    url: "postgresql://postgres.qoxbpyymyttfqydogvcj:L6Ciu7b4vsIFBLVW@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
  },
  {
    name: "Password 2 (DmtSistem...)",
    url: "postgresql://postgres.qoxbpyymyttfqydogvcj:DmtSistemaSecretoParaTokens2026XXX%21@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
  }
];

async function testAll() {
  for (const { name, url } of urls) {
    console.log(`\nProbando ${name}...`);
    const client = new Client({ connectionString: url });
    
    try {
      await client.connect();
      console.log(`✅ ¡ÉXITO! Esta contraseña es la correcta.`);
      await client.end();
      return; // Detenernos si encontramos la buena
    } catch (err) {
      if (err.code === '28P01') {
        console.error(`❌ Contraseña incorrecta (28P01).`);
      } else {
        console.error(`⚠️ Error de red/conexión: ${err.message}`);
      }
    }
  }
  console.log("\nNinguna de las dos contraseñas funcionó (o hubo error de red en ambas).");
}

testAll();
