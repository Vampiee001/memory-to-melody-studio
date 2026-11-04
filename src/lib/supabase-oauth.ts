import { supabase } from "@/integrations/supabase/client";

// The installed @supabase/supabase-js version has no types for the beta
// auth.oauth namespace, so keep a tiny typed wrapper around its three methods.
export type AuthorizationDetails = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { id?: string; name?: string; redirect_uris?: string[] } | null;
  scope?: string;
  scopes?: string[];
  [key: string]: unknown;
};

type OAuthResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

type OAuthNamespace = {
  getAuthorizationDetails: (authorizationId: string) => OAuthResult<AuthorizationDetails>;
  approveAuthorization: (authorizationId: string) => OAuthResult<{ redirect_url?: string; redirect_to?: string }>;
  denyAuthorization: (authorizationId: string) => OAuthResult<{ redirect_url?: string; redirect_to?: string }>;
};

const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export const supabaseOAuth = {
  getAuthorizationDetails: (authorizationId: string) => oauth.getAuthorizationDetails(authorizationId),
  approveAuthorization: (authorizationId: string) => oauth.approveAuthorization(authorizationId),
  denyAuthorization: (authorizationId: string) => oauth.denyAuthorization(authorizationId),
};
