const { put } = require('@vercel/blob');
const { loadState, saveState, verifyToken } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    const { token, cardId, side, imageBase64 } = req.body || {};
      if (!verifyToken(token)) { res.status(401).json({ error: 'Unauthorized' }); return; }
        if (!cardId || (side !== 'front' && side !== 'back')) {
            res.status(400).json({ error: 'Invalid cardId/side' });
                return;
                  }

                    const state = await loadState();
                      if (!state.photos[cardId]) state.photos[cardId] = {};

                        if (!imageBase64) {
                            delete state.photos[cardId][side];
                                if (!state.photos[cardId].front && !state.photos[cardId].back) delete state.photos[cardId];
                                    await saveState(state);
                                        res.setHeader('Cache-Control', 'no-store');
                                            res.status(200).json({ ok: true, state });
                                                return;
                                                  }

                                                    const m = /^data:(image\/\w+);base64,(.+)$/.exec(imageBase64);
                                                      const contentType = m ? m[1] : 'image/jpeg';
                                                        const base64Data = m ? m[2] : imageBase64;
                                                          let buffer;
                                                            try {
                                                                buffer = Buffer.from(base64Data, 'base64');
                                                                  } catch (e) {
                                                                      res.status(400).json({ error: 'Invalid image data' });
                                                                          return;
                                                                            }
                                                                              if (buffer.length > 6 * 1024 * 1024) {
                                                                                  res.status(413).json({ error: 'Image too large' });
                                                                                      return;
                                                                                        }

                                                                                          const ext = contentType === 'image/png' ? 'png' : 'jpg';
                                                                                            const pathname = `photos/${cardId}-${side}-${Date.now()}.${ext}`;

                                                                                              let blob;
                                                                                                try {
                                                                                                    blob = await put(pathname, buffer, { access: 'public', contentType, addRandomSuffix: false });
                                                                                                      } catch (e) {
                                                                                                          console.error('blob upload failed', e);
                                                                                                              res.status(500).json({ error: 'Upload failed' });
                                                                                                                  return;
                                                                                                                    }
                                                                                                                    
                                                                                                                      state.photos[cardId][side] = blob.url;
                                                                                                                        await saveState(state);
                                                                                                                          res.setHeader('Cache-Control', 'no-store');
                                                                                                                            res.status(200).json({ ok: true, state, url: blob.url });
                                                                                                                            };
                                                                                                                            
