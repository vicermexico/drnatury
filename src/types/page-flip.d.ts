// La libreria "page-flip" (https://github.com/Nodlik/StPageFlip) no
// trae sus propios tipos de TypeScript -- esto es nada mas lo minimo
// que usamos de ella (ver RevistaPanel.tsx), no la API completa.
declare module "page-flip" {
  export interface PageFlipSetting {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    usePortrait?: boolean;
    showCover?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    mobileScrollSupport?: boolean;
  }

  export class PageFlip {
    constructor(el: HTMLElement, settings: PageFlipSetting);
    loadFromHTML(pages: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(event: "flip", cb: (e: { data: number }) => void): void;
    destroy(): void;
  }
}
