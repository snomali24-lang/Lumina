const { Client } = require("@gradio/client");

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, negative_prompt, style } = req.body;

    const styleMap = {
      cinematic: 'cinematic, film grain, dramatic lighting, 4K',
      realistic: 'hyperrealistic, photographic, sharp details, 8K',
      anime: 'anime style, vibrant colors, smooth animation',
      '3d': '3D CGI render, ultra detail',
      noir: 'black and white, film noir, high contrast',
      documentary: 'documentary, handheld camera, natural lighting'
    };
    const fullPrompt = `${prompt}. ${styleMap[style] || ''}. High quality, smooth motion.`;

    const client = await Client.connect("Lightricks/LTX-Video", {
      hf_token: process.env.HF_TOKEN
    });

    const result = await client.predict("/generate", {
      prompt: fullPrompt,
      negative_prompt: negative_prompt || 'blur, low quality, watermark, deformed',
      num_inference_steps: 30,
      guidance_scale: 7.5,
      height: 480,
      width: 832,
      num_frames: 41,
      frame_rate: 25,
      seed: Math.floor(Math.random() * 1000000),
    });

    if (!result || !result.data || !result.data[0]) {
      throw new Error('Aucune vidéo reçue du modèle');
    }

    const videoUrl = result.data[0].url || result.data[0];
    return res.status(200).json({ video: videoUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
