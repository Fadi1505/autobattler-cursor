import { GameScene } from "./scenes/GameScene";

const game = new GameScene(document.body);

function animate(): void {
  requestAnimationFrame(animate);
  game.update();
  game.render();
}

animate();
