import { expect, test } from 'vitest';

test('ChartCanvas - Browser test with real canvas rendering', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  expect(ctx).toBeDefined();
  expect(ctx).not.toBeNull();

  if (!ctx) return;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 800, 600);

  ctx.fillStyle = '#00ff00';
  ctx.fillRect(100, 100, 50, 200);

  ctx.fillStyle = '#ff0000';
  ctx.fillRect(200, 200, 50, 100);

  const imageData = ctx.getImageData(125, 150, 1, 1);
  const pixelData = imageData.data;

  expect(pixelData[0]).toBe(0);
  expect(pixelData[1]).toBe(255);
  expect(pixelData[2]).toBe(0);
  expect(pixelData[3]).toBe(255);

  document.body.removeChild(canvas);
});

test('Canvas context methods work in real browser', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  ctx.beginPath();
  ctx.arc(200, 200, 100, 0, Math.PI * 2);
  ctx.fillStyle = '#0088ff';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  const centerPixel = ctx.getImageData(200, 200, 1, 1).data;
  expect(centerPixel[0]).toBe(0);
  expect(centerPixel[1]).toBe(136);
  expect(centerPixel[2]).toBe(255);
  expect(centerPixel[3]).toBe(255);

  const edgePixel = ctx.getImageData(199, 100, 1, 1).data;
  expect(edgePixel[3]).toBeGreaterThan(0);

  document.body.removeChild(canvas);
});

test('Canvas text rendering works correctly', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 100;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No context');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 300, 100);

  ctx.font = '24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Test Canvas', 150, 50);

  const textMetrics = ctx.measureText('Test Canvas');
  expect(textMetrics.width).toBeGreaterThan(0);
  expect(textMetrics.width).toBeLessThan(300);

  const pixelAtText = ctx.getImageData(150, 50, 1, 1).data;
  expect(pixelAtText[3]).toBeGreaterThan(0);

  document.body.removeChild(canvas);
});
