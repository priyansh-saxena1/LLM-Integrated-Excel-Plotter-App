module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized cron request' });
  }

  const healthUrl =
    process.env.BACKEND_HEALTH_URL ||
    'https://archcoder-llm-excel-plotter-agent.hf.space/health';

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }

    return res.status(200).json({
      ok: response.ok,
      warmupStatus: response.status,
      backend: body,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: error.message,
      checkedAt: new Date().toISOString(),
    });
  }
};
