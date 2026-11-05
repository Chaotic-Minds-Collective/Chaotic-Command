/**
 * Content Security Policy shared by the app server and the edge wrapper.
 * Pass `{ fonts: true }` to allow the Google Fonts stylesheet and font files.
 */
export function contentSecurityPolicy({ fonts = false } = {}) {
  const styleSrc = fonts ? "style-src 'self' https://fonts.googleapis.com" : "style-src 'self'";
  const fontSrc = fonts ? " font-src 'self' https://fonts.gstatic.com;" : '';
  return `default-src 'self'; script-src 'self'; ${styleSrc};${fontSrc} connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`;
}
