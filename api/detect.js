export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the raw body stream into a buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Get token from headers, fallback to default
    const userToken = req.headers['x-hf-token'];
    const hfToken = userToken || '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';

    // Try multiple API endpoints in order (router resolves better from Vercel's edge)
    const API_URLS = [
      "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector",
      "https://api-inference.huggingface.co/models/umm-maybe/AI-image-detector",
    ];

    let lastError = null;

    for (const API_URL of API_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: buffer,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.text();
          lastError = `${response.status}: ${err}`;
          if (response.status === 503) {
            return res.status(503).json({ error: 'Model is loading. Please try again in 20 seconds.' });
          }
          continue; // Try next URL
        }

        const data = await response.json();
        return res.status(200).json(data);

      } catch (fetchErr) {
        lastError = fetchErr.message || String(fetchErr);
        continue; // Try next URL
      }
    }

    // All URLs failed
    return res.status(502).json({
      error: `All API endpoints failed. Last error: ${lastError}`,
      hint: 'The Hugging Face API may be temporarily unavailable. Please try again in a minute.'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
