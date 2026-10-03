export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  const REPO = 'anony-developer/signal-hub';
  const FILE_PATH = 'signals.json';
  const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'signal-hub-vercel'
  };

  // -------- GET: read signals --------
  if (req.method === 'GET') {
    try {
      const response = await fetch(API_URL, { headers });
      if (response.status === 404) {
        return res.status(200).json([]);
      }
      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: err });
      }
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return res.status(200).json(JSON.parse(content || '[]'));
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // -------- PUT: write signals --------
  if (req.method === 'PUT') {
    try {
      const signals = req.body;

      // Get current SHA (required to update existing file)
      let sha;
      const getRes = await fetch(API_URL, { headers });
      if (getRes.status === 200) {
        const getData = await getRes.json();
        sha = getData.sha;
      }

      const content = Buffer.from(JSON.stringify(signals, null, 2)).toString('base64');
      const body = {
        message: `Update signals — ${new Date().toISOString()}`,
        content
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(API_URL, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await putRes.json();
      if (!putRes.ok) {
        return res.status(putRes.status).json({ error: result.message || 'Save failed' });
      }

      return res.status(200).json({
        success: true,
        commit: result.commit?.sha
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
