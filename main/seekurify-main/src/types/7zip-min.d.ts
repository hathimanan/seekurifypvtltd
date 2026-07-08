declare module "7zip-min" {
  export function extract(
    src: string,
    dest: string,
    callback: (err?: Error) => void
  ): void;

  export function list(
    src: string,
    callback: (err: Error | null, files: string[]) => void
  ): void;
}
