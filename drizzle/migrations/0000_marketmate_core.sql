
-- Roles
CREATE TYPE public.app_role AS ENUM ('wallet_owner', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.wallet_owner_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'wallet_owner')
$$;

CREATE OR REPLACE FUNCTION public.claim_agent_wallet()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('claim_agent_wallet'));
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'wallet_owner') THEN
    RETURN public.has_role(auth.uid(), 'wallet_owner');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'wallet_owner');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_agent_wallet() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_agent_wallet() TO authenticated;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  business_name text,
  business_type text DEFAULT 'Supermarket',
  country text NOT NULL DEFAULT 'NG',
  state text,
  city text,
  delivery_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'business_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.spending_policies (owner_id) VALUES (NEW.id) ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END $$;

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  business_name text NOT NULL,
  description text,
  country text NOT NULL DEFAULT 'NG',
  state text NOT NULL,
  city text NOT NULL,
  address text,
  phone text,
  email text,
  payout_wallet text,
  cac_number text,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_note text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users browse suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner creates supplier" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates supplier" ON public.suppliers FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes supplier" ON public.suppliers FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_supplier_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status := CASE WHEN NEW.cac_number IS NOT NULL AND length(trim(NEW.cac_number)) > 0 THEN 'pending' ELSE 'unverified' END;
      NEW.verified_at := NULL;
      NEW.verification_note := NULL;
    ELSE
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
         OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
         OR NEW.verification_note IS DISTINCT FROM OLD.verification_note THEN
        NEW.verification_status := OLD.verification_status;
        NEW.verified_at := OLD.verified_at;
        NEW.verification_note := OLD.verification_note;
      END IF;
      IF OLD.verification_status = 'unverified' AND NEW.cac_number IS NOT NULL AND length(trim(NEW.cac_number)) > 0 THEN
        NEW.verification_status := 'pending';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER suppliers_guard BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_verification();
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Grains',
  unit text NOT NULL DEFAULT '50kg bag',
  unit_price_ngn numeric(14,2) NOT NULL CHECK (unit_price_ngn > 0),
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  min_order_qty integer NOT NULL DEFAULT 1 CHECK (min_order_qty >= 1),
  delivery_fee_ngn numeric(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_ngn >= 0),
  delivery_fee_per_unit_ngn numeric(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_per_unit_ngn >= 0),
  delivery_days integer NOT NULL DEFAULT 2 CHECK (delivery_days >= 0),
  delivers_to text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_supplier_idx ON public.products(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_supplier(_supplier_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND owner_id = auth.uid())
$$;

CREATE POLICY "Signed-in users browse products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supplier owner inserts products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.owns_supplier(supplier_id));
CREATE POLICY "Supplier owner updates products" ON public.products FOR UPDATE TO authenticated USING (public.owns_supplier(supplier_id)) WITH CHECK (public.owns_supplier(supplier_id));
CREATE POLICY "Supplier owner deletes products" ON public.products FOR DELETE TO authenticated USING (public.owns_supplier(supplier_id));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Price history
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL,
  product_name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  unit_price_ngn numeric(14,2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_history_product_idx ON public.price_history(product_id, recorded_at);
GRANT SELECT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read price history" ON public.price_history FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_price_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.unit_price_ngn IS DISTINCT FROM OLD.unit_price_ngn THEN
    INSERT INTO public.price_history (product_id, supplier_id, product_name, category, unit, unit_price_ngn)
    VALUES (NEW.id, NEW.supplier_id, NEW.name, NEW.category, NEW.unit, NEW.unit_price_ngn);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_price_history AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.record_price_history();

-- Spending policies
CREATE TABLE public.spending_policies (
  owner_id uuid PRIMARY KEY,
  max_per_tx_usd numeric(14,2) NOT NULL DEFAULT 25 CHECK (max_per_tx_usd >= 0),
  daily_limit_usd numeric(14,2) NOT NULL DEFAULT 50 CHECK (daily_limit_usd >= 0),
  restrict_to_approved_suppliers boolean NOT NULL DEFAULT false,
  approved_supplier_ids uuid[] NOT NULL DEFAULT '{}',
  approved_tokens text[] NOT NULL DEFAULT '{USDC}',
  autonomous_enabled boolean NOT NULL DEFAULT false,
  autonomous_max_usd numeric(14,2) NOT NULL DEFAULT 0 CHECK (autonomous_max_usd >= 0),
  x402_enabled boolean NOT NULL DEFAULT true,
  x402_max_per_call_usd numeric(14,4) NOT NULL DEFAULT 0.01 CHECK (x402_max_per_call_usd >= 0),
  x402_daily_limit_usd numeric(14,4) NOT NULL DEFAULT 0.10 CHECK (x402_daily_limit_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spending_policies TO authenticated;
GRANT ALL ON public.spending_policies TO service_role;
ALTER TABLE public.spending_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own policy select" ON public.spending_policies FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Own policy insert" ON public.spending_policies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Own policy update" ON public.spending_policies FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER policies_touch BEFORE UPDATE ON public.spending_policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Orders
CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('MM-' || nextval('public.order_number_seq')::text),
  buyer_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_ngn numeric(14,2) NOT NULL,
  delivery_fee_ngn numeric(14,2) NOT NULL DEFAULT 0,
  total_ngn numeric(14,2) NOT NULL,
  fx_rate_ngn_per_usd numeric(14,4) NOT NULL,
  fx_source text NOT NULL,
  total_usd numeric(14,6) NOT NULL,
  pay_token text NOT NULL DEFAULT 'USDC',
  status text NOT NULL DEFAULT 'proposed',
  payment_status text NOT NULL DEFAULT 'unpaid',
  approval_mode text NOT NULL DEFAULT 'manual',
  tx_hash text,
  payment_error text,
  delivery_address text,
  buyer_note text,
  supplier_note text,
  savings_ngn numeric(14,2) NOT NULL DEFAULT 0,
  comparison jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_days integer,
  approved_at timestamptz,
  paid_at timestamptz,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON public.orders(buyer_id, created_at DESC);
CREATE INDEX orders_supplier_idx ON public.orders(supplier_id, created_at DESC);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT USAGE ON SEQUENCE public.order_number_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or supplier reads order" ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR public.owns_supplier(supplier_id));
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.can_see_order(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id
    AND (o.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = o.supplier_id AND s.owner_id = auth.uid())))
$$;

CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  actor text NOT NULL DEFAULT 'agent',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events(order_id, created_at);
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read events" ON public.order_events FOR SELECT TO authenticated USING (public.can_see_order(order_id));

-- Wallet transactions (agent wallet ledger)
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL,
  token text NOT NULL,
  amount numeric(20,6) NOT NULL,
  amount_usd numeric(20,6) NOT NULL,
  to_address text,
  tx_hash text,
  status text NOT NULL DEFAULT 'reserved',
  description text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_owner_idx ON public.wallet_transactions(owner_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own wallet txs" ON public.wallet_transactions FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER wallet_tx_touch BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic spend reservation: serialises per owner so daily limits can't be raced.
CREATE OR REPLACE FUNCTION public.reserve_spend(
  _owner uuid, _order uuid, _kind text, _token text, _amount numeric, _amount_usd numeric,
  _to text, _daily_limit_usd numeric, _description text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spent numeric; new_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('spend:' || _owner::text || ':' || _kind));
  SELECT COALESCE(SUM(amount_usd), 0) INTO spent FROM public.wallet_transactions
   WHERE owner_id = _owner AND kind = _kind AND status IN ('reserved','pending','confirmed')
     AND created_at > now() - interval '24 hours';
  IF spent + _amount_usd > _daily_limit_usd THEN
    RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED: % spent in last 24h, limit %', spent, _daily_limit_usd;
  END IF;
  INSERT INTO public.wallet_transactions (owner_id, order_id, kind, token, amount, amount_usd, to_address, status, description)
  VALUES (_owner, _order, _kind, _token, _amount, _amount_usd, _to, 'reserved', _description)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.reserve_spend(uuid, uuid, text, text, numeric, numeric, text, numeric, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.reserve_spend(uuid, uuid, text, text, numeric, numeric, text, numeric, text) TO service_role;

-- Chat
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_owner_idx ON public.chat_messages(owner_id, created_at);
GRANT SELECT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own chat select" ON public.chat_messages FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Own chat delete" ON public.chat_messages FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Agent identity (ERC-8004)
CREATE TABLE public.agent_identity (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  agent_id text,
  agent_address text,
  agent_uri text,
  registry text,
  tx_hash text,
  registered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_identity TO authenticated, anon;
GRANT ALL ON public.agent_identity TO service_role;
ALTER TABLE public.agent_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads agent identity" ON public.agent_identity FOR SELECT TO authenticated, anon USING (true);

-- Realtime for live order tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
