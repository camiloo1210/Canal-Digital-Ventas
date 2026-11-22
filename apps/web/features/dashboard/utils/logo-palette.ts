type Rgb = readonly [number, number, number];
type DashboardPalette = {
  background: string;
  primary: string;
  'primary-foreground': string;
  accent: string;
  'accent-foreground': string;
  sidebar: string;
  'sidebar-accent': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
};

interface LogoTheme {
  logoBackground: string;
  palette: { light: DashboardPalette; dark: DashboardPalette } | null;
}

const HUE_BINS = 24;
const WHITE = '#ffffff';
const INK = '#111827';

function linearize(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// sRGB and Oklab transforms use the D65 matrices from CSS Color 4.
function chromaticCoordinates([r, g, b]: Rgb): readonly [number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function toLinearRgb(lightness: number, chroma: number, hue: number): Rgb {
  const a = Math.cos(hue) * chroma;
  const b = Math.sin(hue) * chroma;
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function swatch(lightness: number, chroma: number, hue: number): string {
  let rgb = toLinearRgb(lightness, chroma, hue);
  // Preserve lightness and hue when the requested chroma exceeds sRGB.
  while (rgb.some((value): boolean => value < 0 || value > 1)) {
    chroma *= 0.9;
    rgb = toLinearRgb(lightness, chroma, hue);
  }
  return (
    '#' +
    rgb
      .map((linear): string => {
        const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

function hexLuminance(hex: string): number {
  return luminance([
    linearize(parseInt(hex.slice(1, 3), 16)),
    linearize(parseInt(hex.slice(3, 5), 16)),
    linearize(parseInt(hex.slice(5, 7), 16)),
  ]);
}

function contrast(first: number, second: number): number {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function accessibleInk(
  lightness: number,
  chroma: number,
  hue: number,
  lightOnDark: boolean,
  surfaces: readonly string[],
): string {
  const backgrounds = surfaces.map(hexLuminance);
  let ink = swatch(lightness, chroma, hue);
  // Build margin above AA for tinted surfaces and button hover states.
  while (backgrounds.some((background): boolean => contrast(hexLuminance(ink), background) < 5.5)) {
    lightness += lightOnDark ? 0.015 : -0.015;
    if (lightness >= 1 || lightness <= 0) return lightOnDark ? WHITE : '#000000';
    ink = swatch(lightness, chroma, hue);
  }
  return ink;
}

function paletteFor(dark: boolean, hue: number, chroma: number): DashboardPalette {
  const background = swatch(dark ? 0.17 : 0.97, 0.012, hue);
  const accent = swatch(dark ? 0.3 : 0.955, Math.min(chroma, dark ? 0.06 : 0.025), hue);
  const primaryForeground = dark ? INK : WHITE;
  const sidebarPrimary = swatch(dark ? 0.78 : 0.9, Math.min(chroma, 0.075), hue);
  return {
    background,
    primary: accessibleInk(dark ? 0.75 : 0.45, chroma, hue, dark, [
      background,
      accent,
      primaryForeground,
    ]),
    'primary-foreground': primaryForeground,
    accent,
    'accent-foreground': accessibleInk(dark ? 0.9 : 0.35, chroma * 0.55, hue, dark, [
      background,
      accent,
    ]),
    sidebar: swatch(dark ? 0.195 : 0.235, Math.min(chroma, 0.048), hue),
    'sidebar-accent': swatch(dark ? 0.31 : 0.38, Math.min(chroma, 0.085), hue),
    'sidebar-primary': sidebarPrimary,
    'sidebar-primary-foreground': accessibleInk(0.27, chroma * 0.5, hue, false, [sidebarPrimary]),
  };
}

export function deriveLogoTheme(pixels: Uint8ClampedArray): LogoTheme | null {
  const bins = Array.from({ length: HUE_BINS }, (): { weight: number; a: number; b: number } => ({
    weight: 0,
    a: 0,
    b: 0,
  }));
  let opacity = 0;
  let totalLuminance = 0;

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (alpha < 0.5) continue;
    const rgb: Rgb = [
      linearize(pixels[index]),
      linearize(pixels[index + 1]),
      linearize(pixels[index + 2]),
    ];
    opacity += alpha;
    totalLuminance += alpha * luminance(rgb);
    const [a, b] = chromaticCoordinates(rgb);
    const chroma = Math.hypot(a, b);
    if (chroma < 0.045) continue;
    const hue = (Math.atan2(b, a) + 2 * Math.PI) % (2 * Math.PI);
    const bin = bins[Math.floor((hue / (2 * Math.PI)) * HUE_BINS)];
    const weight = alpha * chroma;
    bin.weight += weight;
    bin.a += a * weight;
    bin.b += b * weight;
  }

  if (opacity === 0) return null;
  const meanLuminance = totalLuminance / opacity;
  const logoBackground =
    contrast(meanLuminance, 1) >= contrast(meanLuminance, hexLuminance(INK)) ? WHITE : INK;
  let strongest = { weight: 0, a: 0, b: 0 };
  for (let index = 0; index < bins.length; index++) {
    const before = bins[(index + HUE_BINS - 1) % HUE_BINS];
    const current = bins[index];
    const after = bins[(index + 1) % HUE_BINS];
    const weight = before.weight + current.weight + after.weight;
    if (weight > strongest.weight) {
      strongest = { weight, a: before.a + current.a + after.a, b: before.b + current.b + after.b };
    }
  }
  if (strongest.weight / opacity < 0.002) return { logoBackground, palette: null };

  const hue = Math.atan2(strongest.b, strongest.a);
  const chroma = Math.min(0.17, Math.hypot(strongest.a, strongest.b) / strongest.weight);
  return {
    logoBackground,
    palette: { light: paletteFor(false, hue, chroma), dark: paletteFor(true, hue, chroma) },
  };
}
