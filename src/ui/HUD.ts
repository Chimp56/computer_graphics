export class HUD {
  private coinCountEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private coinCount = 0;

  constructor() {
    const hud = document.createElement("div");
    hud.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 100;
      user-select: none;
    `;

    // Timer row
    const timerRow = document.createElement("div");
    timerRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
    const timerIcon = document.createElement("img");
    timerIcon.src = "/textures/stopwatch.png";
    timerIcon.style.cssText = "width: 40px; height: 40px;";
    this.timerEl = document.createElement("span");
    this.timerEl.style.cssText = "color: white; font-size: 30px; font-weight: bold; text-shadow: 2px 2px 4px black;";
    this.timerEl.textContent = "0:00.00";
    timerRow.appendChild(timerIcon);
    timerRow.appendChild(this.timerEl);

    // Coin row
    const coinRow = document.createElement("div");
    coinRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
    const coinIcon = document.createElement("img");
    coinIcon.src = "/textures/coinicon.png";
    coinIcon.style.cssText = "width: 40px; height: 40px;";
    this.coinCountEl = document.createElement("span");
    this.coinCountEl.style.cssText = "color: white; font-size: 30px; font-weight: bold; text-shadow: 2px 2px 4px black;";
    this.coinCountEl.textContent = "0";
    coinRow.appendChild(coinIcon);
    coinRow.appendChild(this.coinCountEl);

    hud.appendChild(timerRow);
    hud.appendChild(coinRow);
    document.body.appendChild(hud);
  }

  updateTimer(seconds: number): void {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    const ms = Math.floor((seconds % 1) * 100).toString().padStart(2, "0");
    this.timerEl.textContent = `${mins}:${secs}.${ms}`;
  }

  addCoin(): void {
    this.coinCount++;
    this.coinCountEl.textContent = this.coinCount.toString();
  }
}