const sharp = require('sharp');
async function test() {
  const scale = 5;
  const logoSize = scale * 20;
  const logoRadius = logoSize / 2;
  const bgColor = '#000000';
  const circleSize = Math.round((scale + 1.5) * 20);
  const circleRadius = circleSize / 2;

  const maskSvg = Buffer.from(`
      <svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${logoRadius}" cy="${logoRadius}" r="${logoRadius}" fill="white" />
      </svg>
    `);
    
  const circleSvg = Buffer.from(`
      <svg width="${circleSize}" height="${circleSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${circleRadius}" cy="${circleRadius}" r="${circleRadius}" fill="${bgColor}" />
      </svg>
    `);

  console.log('Testing maskSvg parsing...');
  await sharp(maskSvg).png().toBuffer();
  console.log('Testing circleSvg parsing...');
  await sharp(circleSvg).png().toBuffer();
  console.log('Success!');
}
test().catch(console.error);
