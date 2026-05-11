// SPA fallback: render everything client-side. Prerender the shell so /index.html
// works as the fallback for GitHub Pages, while runtime navigation is fully CSR.
export const prerender = true;
export const ssr = false;
