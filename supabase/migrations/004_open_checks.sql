-- Catálogo de productos de tienda (agua, snacks, etc.)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT 'general',
  price numeric NOT NULL,
  emoji text DEFAULT '🛒',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_products" ON products USING (tenant_id = (SELECT id FROM tenants WHERE admin_email = auth.email() LIMIT 1));

-- Cuentas abiertas (una por visita)
CREATE TABLE IF NOT EXISTS open_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id),
  member_name text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  status text DEFAULT 'open',
  time_minutes int,
  time_cost numeric DEFAULT 0,
  products_cost numeric DEFAULT 0,
  total numeric DEFAULT 0,
  visit_type text DEFAULT 'entrada'
);

ALTER TABLE open_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_open_checks" ON open_checks USING (tenant_id = (SELECT id FROM tenants WHERE admin_email = auth.email() LIMIT 1));

-- Líneas de productos en una cuenta abierta
CREATE TABLE IF NOT EXISTS open_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid REFERENCES open_checks(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  name text NOT NULL,
  quantity int DEFAULT 1,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE open_check_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_check_items" ON open_check_items USING (
  check_id IN (SELECT id FROM open_checks WHERE tenant_id = (SELECT id FROM tenants WHERE admin_email = auth.email() LIMIT 1))
);

-- Vincular reservas con miembros (booking_id en visits)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id);

-- Vincular reservas con miembros más explícitamente
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS executed_at timestamptz;
