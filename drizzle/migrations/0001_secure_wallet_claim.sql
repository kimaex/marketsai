CREATE OR REPLACE FUNCTION public.claim_agent_wallet()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 RETURN public.has_role(auth.uid(), 'wallet_owner');
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_agent_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_agent_wallet() TO authenticated;