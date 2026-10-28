import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/upload";

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    signedUrl(bucket, path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [bucket, path]);
  return url;
}
