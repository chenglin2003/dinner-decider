export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { name, maxWidth = 600 } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) return res.status(404).end();

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const buffer = await response.arrayBuffer();
  res.send(Buffer.from(buffer));
}