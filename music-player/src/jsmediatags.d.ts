declare module "jsmediatags" {
  interface Picture {
    format: string;
    data: number[];
  }
  interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    picture?: Picture;
  }
  interface TagResult {
    tags: Tags;
  }
  interface ReadOptions {
    onSuccess: (tag: TagResult) => void;
    onError: (error: unknown) => void;
  }
  function read(file: File, options: ReadOptions): void;
}
