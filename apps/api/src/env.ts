export type EnvBindings = Record<string, string | undefined>;

declare global {
  // Bun is only present when running the API outside Cloudflare Workers.
  // eslint-disable-next-line no-var
  var Bun: { env?: EnvBindings } | undefined;
}

let workerEnv: EnvBindings = {};

export const setEnv = (env: EnvBindings) => {
  workerEnv = env;
};

export const getEnv = (name: string) => workerEnv[name] ?? globalThis.Bun?.env?.[name];

export const requiredEnv = (name: string) => {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`${name} is required to start the API server.`);
  }

  return value;
};
