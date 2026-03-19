module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, negative_prompt, style } = req.body;
    const hf_token = process.env.HF_TOKEN;

    const styleMap = {
      cinematic: 'cinematic, film grain, dramatic lighting, 4K',
      realistic: 'hyperrealistic, photographic, 8K',
      anime: 'anime style, vibrant colors',
      '3d': '3D CGI render, ultra detail',
      noir: 'black and white, film noir',
      documentary: 'documentary, natural lighting'
    };
    const fullPrompt = `${prompt}. ${styleMap[style] || ''}. High quality, smooth motion.`;

    // Utilise l'API Gradio de LTX-Video Space directement
    const joinRes = await fetch('https://lightricks-ltx-video.hf.space/queue/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hf_token}`
      },
      body: JSON.stringify({
        data: [
          fullPrompt,
          negative_prompt || 'blur, low quality, watermark, deformed',
          30,
          7.5,
          480,
          832,
          41,
          25,
          Math.floor(Math.random() * 1000000)
        ],
        fn_index: 0,
        session_hash: Math.random().toString(36).substring(2)
      })
    });

    if (!joinRes.ok) throw new Error(`Erreur join: ${joinRes.status}`);
    const joinData = await joinRes.json();
    const eventId = joinData.event_id;

    // Poll le résultat
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://lightricks-ltx-video.hf.space/queue/status?event_id=${eventId}`, {
        headers: { 'Authorization': `Bearer ${hf_token}` }
      });
      const statusData = await statusRes.json();
      if (statusData.status === 'COMPLETE') {
        const videoUrl = statusData.output?.data?.[0]?.url || statusData.output?.data?.[0];
        if (videoUrl) return res.status(200).json({ video: videoUrl });
        throw new Error('URL vidéo introuvable');
      }
      if (statusData.status === 'FAILED') throw new Error('Génération échouée sur le Space');
    }
    throw new Error('Timeout — réessaie dans quelques minutes');

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
