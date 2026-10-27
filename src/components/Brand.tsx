import { Link } from "@tanstack/react-router";
import { Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function Wave({ bars = 5, className = "" }: { bars?: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-5 items-center gap-[3px] ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="animate-wave h-full w-[3px] rounded-full bg-gold" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

export function AppHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="MemoryMelody home">
          <Wave />
          <span className="font-display text-xl font-semibold">
            Memory<span className="text-gradient-gold">Melody</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/spotify" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">
            Release on Spotify
          </Link>
          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" aria-label="Settings">
                <Link to="/settings"><Settings /></Link>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => supabase.auth.signOut()}>
                <LogOut />
              </Button>
            </>
          ) : (
            <Button asChild variant="gold" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Disclaimer() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Rights in AI-generated lyrics and audio depend on each AI provider's terms. You are responsible for verifying
      ownership of the result and permission for every photo, video and likeness before any commercial distribution.
    </p>
  );
}
