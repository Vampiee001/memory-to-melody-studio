import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/studio/new")({
  head: () => ({ meta: [{ title: "New song — MemoryMelody" }, { name: "description", content: "Start a new memory song." }] }),
  component: NewSong,
});

function NewSong() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const create = async () => {
    setError(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase.from("projects").insert({ user_id: u.user.id }).select("id").single();
    if (error || !data) return setError("Couldn't start a new song. Please try again.");
    navigate({ to: "/project/$id", params: { id: data.id }, replace: true });
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create();
  }, []);
  return (
    <div className="surface mx-auto mt-10 max-w-md p-8 text-center" aria-live="polite">
      {error ? (<><p className="text-destructive">{error}</p><Button className="mt-4" onClick={create}>Retry</Button></>) : <p>Opening your studio…</p>}
    </div>
  );
}
