module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { prompt, negative_prompt, style, num_frames, guidance_scale, num_inference_steps, image } = req.body;
    const hf_token = process.env.HF_TOKEN;
    if (!hf_token) return res.status(401).json({ error: 'Token HF manquant sur Vercel' });
    const styleMap = {
      cinematic: 'cinematic, film grain, anamorphic lens, dramatic lighting, 4K',
      realistic: 'hyperrealistic, photographic, sharp details, 8K',
      anime: 'anime style, vibrant colors, smooth animation',
      '3d': '3D CGI render, octane, ultra detail',
      noir: 'black and white, film noir, high contrast',
      documentary: 'documentary, handheld camera, natural lighting'
    };
    const fullPrompt = `${prompt}. ${styleMap[style] || ''}. High quality, smooth motion, no watermark.`;
    const modelId = image ? 'Wan-AI/Wan2.1-I2V-14B-720P' : 'Wan-AI/Wan2.1-T2V-14B';
    const payload = {
      inputs: fullPrompt,
      parameters: {
        negative_prompt: negative_prompt || 'blur, low quality, watermark, deformed',
        num_frames: num_frames || 40,
        guidance_scale: guidance_scale || 7,
        num_inference_steps: num_inference_steps || 30,
      }
    };
    if (image) payload.parameters.image = image;
    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hf_token}`,
        'Content-Type': 'application/json',
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify(payload)
    });
    if (!hfRes.ok) {
      let errMsg = `Erreur Hugging Face (${hfRes.status})`;
      try {
        const errData = await hfRes.json();
        if (errData.error) errMsg = errData.error;
        if (hfRes.status === 401) errMsg = 'Token invalide ou expiré';
        if (hfRes.status === 503) errMsg = 'Modèle en cours de chargement — réessaie dans 30 secondes';
        if (hfRes.status === 429) errMsg = 'Trop de requêtes — attends 1 minute';
      } catch {}
      return res.status(hfRes.status).json({ error: errMsg });
    }
    const contentType = hfRes.headers.get('content-type') || '';
    if (contentType.includes('video') || contentType.includes('octet-stream')) {
      const buffer = await hfRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ video: `data:video/mp4;base64,${base64}` });
    }
    const data = await hfRes.json();
    if (data.video) return res.status(200).json({ video: data.video });
    if (data[0]?.blob) return res.status(200).json({ video: `data:video/mp4;base64,${data[0].blob}` });
    return res.status(500).json({ error: 'Format de réponse inattendu' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
