// Solmar Heat — tiny runtime self-check, exposed for automated verification.
// It only reads state; it never changes the game.
export function runSelfTest(game) {
  const problems = [];
  if (!game.city || game.city.buildings.length < 50) problems.push("city has too few buildings");
  if (!game.traffic || game.traffic.cars.length < 5) problems.push("traffic did not spawn");
  if (!game.traffic || game.traffic.peds.length < 5) problems.push("pedestrians did not spawn");
  if (!game.missions || game.missions.defs.length !== 4) problems.push("missions missing");
  if (!game.player || !game.player.alive) problems.push("player not alive");
  if (!game.police) problems.push("police system missing");
  const canvas = game.canvas;
  if (!canvas || canvas.width < 100 || canvas.height < 100) problems.push("canvas too small");
  return { ok: problems.length === 0, problems, buildings: game.city.buildings.length, traffic: game.traffic.cars.length, peds: game.traffic.peds.length };
}
