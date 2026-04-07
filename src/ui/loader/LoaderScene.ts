export interface LoaderScene {
  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    timeSeconds: number,
  ): void;
}
