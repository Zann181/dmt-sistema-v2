const url = 'http://localhost:3000/api/events/qr-preview';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    qrPrefix: 'EVT',
    qrFillColor: '#000000',
    qrBackgroundColor: '#ffffff',
    qrLogoBackgroundColor: '#000000',
    qrLogoScale: 4,
    qrLogoUrl: '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
  })
}).then(async r => {
  const text = await r.text();
  console.log('Status:', r.status);
  console.log('Response:', text.substring(0, 100));
}).catch(console.error);
