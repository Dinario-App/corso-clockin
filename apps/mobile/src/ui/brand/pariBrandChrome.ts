/** 175×44 px nav crop at @2x, shown at its 22pt design height. */
export const PARI_NAV_HEIGHT = 22;
export const PARI_NAV_WIDTH = 87.5;

export function brandPariEnabled(raw: string | undefined): boolean {
  return raw === '1';
}

export function readBrandPariFlag(): boolean {
  return brandPariEnabled(process.env.EXPO_PUBLIC_BRAND_PARI);
}

export function pariNavLockupSource() {
  return require('@/assets/brand/pari/2-pari-nav-22h.png');
}
