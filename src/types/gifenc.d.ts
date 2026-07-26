declare module "gifenc" {
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;

  export function GIFEncoder(options?: {
    initialCapacity?: number;
    auto?: boolean;
  }): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        first?: boolean;
        /** LZW minimum code size; also the logical-screen color depth. */
        colorDepth?: number;
        /** GIF disposal method. 1 = leave the frame in place. -1 = unspecified. */
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
