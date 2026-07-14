interface DeezerTrackInfo {
  id: number;
  title: string;
  duration: number;
  artist: { id: number; name: string };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    cover_xl: string;
  };
}

interface DeezerCurrentTrackEvent {
  track: DeezerTrackInfo;
  index: number;
}

interface DeezerAuthResponse {
  userID: string;
  accessToken: string;
  status: "connected" | "not_connected";
}

interface DeezerLoginResponse {
  authResponse?: DeezerAuthResponse;
  status: "connected" | "not_connected" | "unknown";
}

interface DZ {
  init(options: {
    appId: string;
    channelUrl: string;
    player?: {
      onload?: (state: unknown) => void;
    };
  }): void;
  login(
    callback: (response: DeezerLoginResponse) => void,
    options?: { perms?: string }
  ): void;
  logout(callback?: () => void): void;
  api(
    path: string,
    callback: (response: unknown) => void
  ): void;
  Event: {
    subscribe(
      event: "current_track" | "player_play" | "player_paused" | "player_position" | "tracklist_changed",
      callback: (data: DeezerCurrentTrackEvent) => void
    ): void;
    unsubscribe(event: string, callback: (data: unknown) => void): void;
  };
  player: {
    play(): void;
    pause(): void;
    next(): void;
    prev(): void;
    playRadio(type: string, id: string | number): void;
    playTracks(ids: number[]): void;
    getCurrentSong(): DeezerCurrentTrackEvent | null;
    isPlaying(): boolean;
    getPosition(): number;
    getDuration(): number;
    setVolume(vol: number): void;
  };
}

declare global {
  interface Window {
    DZ: DZ;
    dzAsyncInit?: () => void;
  }
}
