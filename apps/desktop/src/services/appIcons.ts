import { useEffect, useState } from "react";
import { getAppIcon } from "./ipc";

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function fetchIcon(path: string, window?: number): Promise<string | null> {
  const key = path.toLowerCase();
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  let request = pending.get(key);
  if (!request) {
    request = getAppIcon(path, window)
      .catch(() => null)
      .then((icon) => {
        cache.set(key, icon);
        pending.delete(key);
        return icon;
      });
    pending.set(key, request);
  }
  return request;
}

/** The app's icon as a data URL, or null while loading or when it has none. */
export function useAppIcon(path: string | null, window?: number): string | null {
  const key = path?.toLowerCase() ?? "";
  const [icon, setIcon] = useState<{ key: string; url: string | null }>(() => ({
    key,
    url: path ? (cache.get(key) ?? null) : null,
  }));

  useEffect(() => {
    if (!path) return;
    let live = true;
    void fetchIcon(path, window).then((url) => live && setIcon({ key, url }));
    return () => {
      live = false;
    };
  }, [path, key, window]);

  return icon.key === key ? icon.url : (cache.get(key) ?? null);
}
