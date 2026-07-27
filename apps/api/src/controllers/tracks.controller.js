import * as tracksService from '../services/tracks.service.js';

export async function getTracks(req, res) {
  const tracks = await tracksService.listTracks();
  res.json({ tracks });
}
