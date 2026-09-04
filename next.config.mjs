// Exportación 100% estática (sin servidor) para poder alojarlo en GitHub Pages.
// NEXT_PUBLIC_BASE_PATH se define automáticamente en el workflow de deploy
// como "/nombre-del-repo" (ver .github/workflows/deploy.yml). Si corres
// `npm run build` en local para probar, déjalo vacío.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    // La API de Optimización de Imágenes de Next necesita un servidor;
    // en un sitio estático no está disponible, así que se desactiva.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
      },
      {
        protocol: "https",
        hostname: "limitlesstcg.nyc3.cdn.digitaloceanspaces.com",
      },
    ],
  },
};

export default nextConfig;
