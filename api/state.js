const { loadState, saveState, verifyToken } = require('./_lib');

function applyAction(state, action, cardId, payload) {
  switch (action) {
      case 'setEdit':
            state.edits[cardId] = payload.fields;
                  break;
                      case 'clearEdit':
                            delete state.edits[cardId];
                                  break;
                                      case 'setLink':
                                            if (payload.url) state.links[cardId] = payload.url;
                                                  else delete state.links[cardId];
                                                        break;
                                                            case 'setDeleted':
                                                                  if (payload.value) state.deleted[cardId] = true;
                                                                        else delete state.deleted[cardId];
                                                                              break;
                                                                                  case 'setImportedCards':
                                                                                        state.importedCards = payload.cards;
                                                                                              break;
                                                                                                  default:
                                                                                                        throw new Error('Unknown action: ' + action);
                                                                                                          }
                                                                                                          }
                                                                                                          
                                                                                                          module.exports = async function handler(req, res) {
                                                                                                            if (req.method === 'GET') {
                                                                                                                const state = await loadState();
                                                                                                                    res.setHeader('Cache-Control', 'no-store');
                                                                                                                        res.status(200).json(state);
                                                                                                                            return;
                                                                                                                              }
                                                                                                                                if (req.method === 'POST') {
                                                                                                                                    const { token, action, cardId, payload } = req.body || {};
                                                                                                                                        if (!verifyToken(token)) { res.status(401).json({ error: 'Unauthorized' }); return; }
                                                                                                                                            const state = await loadState();
                                                                                                                                                try {
                                                                                                                                                      applyAction(state, action, cardId, payload || {});
                                                                                                                                                          } catch (e) {
                                                                                                                                                                res.status(400).json({ error: e.message });
                                                                                                                                                                      return;
                                                                                                                                                                          }
                                                                                                                                                                              await saveState(state);
                                                                                                                                                                                  res.setHeader('Cache-Control', 'no-store');
                                                                                                                                                                                      res.status(200).json({ ok: true, state });
                                                                                                                                                                                          return;
                                                                                                                                                                                            }
                                                                                                                                                                                              res.status(405).json({ error: 'Method not allowed' });
                                                                                                                                                                                              };
                                                                                                                                                                                              
