/**
 * Public application configuration endpoint.
 * Keeps the deployed product name observable without exposing private settings.
 */
export function getPublicAppConfig() {
  return {
    title: process.env.VITE_APP_TITLE || "ARICIMAP",
  } as const;
}

export function appConfigHandler(_req: unknown, res: { json: (body: ReturnType<typeof getPublicAppConfig>) => unknown }) {
  return res.json(getPublicAppConfig());
}
