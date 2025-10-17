import sharp from 'sharp';
import { readFileSync } from 'fs';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create SVG for the pill icon
const createPillSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>

  <!-- Pill shape -->
  <rect x="${size * 0.25}" y="${size * 0.15}"
        width="${size * 0.5}" height="${size * 0.7}"
        fill="white" rx="${size * 0.25}"/>

  <!-- Dividing line -->
  <line x1="${size * 0.25}" y1="${size * 0.5}"
        x2="${size * 0.75}" y2="${size * 0.5}"
        stroke="#8b5cf6" stroke-width="${size * 0.05}"/>

  <!-- Small dot -->
  <circle cx="${size * 0.5}" cy="${size * 0.325}"
          r="${size * 0.04}" fill="#8b5cf6"/>
</svg>
`;

// Create maskable icon with safe zone
const createMaskableSVG = () => `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background (full bleed) -->
  <rect width="512" height="512" fill="url(#grad)"/>

  <!-- Pill shape (in safe zone - 80% of canvas) -->
  <rect x="128" y="77"
        width="256" height="358"
        fill="white" rx="128"/>

  <!-- Dividing line -->
  <line x1="128" y1="256"
        x2="384" y2="256"
        stroke="#8b5cf6" stroke-width="25"/>

  <!-- Small dot -->
  <circle cx="256" cy="166"
          r="20" fill="#8b5cf6"/>
</svg>
`;

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Generate standard icons
  for (const size of sizes) {
    const svg = createPillSVG(size);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(`public/icons/icon-${size}x${size}.png`);
    console.log(`✓ Generated icon-${size}x${size}.png`);
  }

  // Generate maskable icon
  const maskableSVG = createMaskableSVG();
  await sharp(Buffer.from(maskableSVG))
    .png()
    .toFile('public/icons/icon-512x512-maskable.png');
  console.log('✓ Generated icon-512x512-maskable.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
