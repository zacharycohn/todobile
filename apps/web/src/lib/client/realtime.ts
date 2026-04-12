import { createClient } from "@supabase/supabase-js";

type SubscribeToTaskChangesInput = {
  token: string;
  familyId: string;
  onChange: () => void;
};

function isDemoToken(token: string) {
  return token.startsWith("demo-user:") || token.startsWith("test-user:");
}

export function subscribeToTaskChanges({
  token,
  familyId,
  onChange
}: SubscribeToTaskChangesInput) {
  if (!token || !familyId || isDemoToken(token)) {
    return () => undefined;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase Realtime is not configured");
  }

  const supabase = createClient(url, anonKey);
  supabase.realtime.setAuth(token);

  const channel = supabase
    .channel(`family:${familyId}`, {
      config: { private: true }
    })
    .on("broadcast", { event: "INSERT" }, () => {
      onChange();
    })
    .on("broadcast", { event: "UPDATE" }, () => {
      onChange();
    })
    .on("broadcast", { event: "DELETE" }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
