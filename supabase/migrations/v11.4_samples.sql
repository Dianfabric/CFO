-- v1.1 Sample Tracking Migration (#2c)
-- Apply via Supabase SQL Editor.

-- Sample requests (one per delivery)
CREATE TABLE IF NOT EXISTS sample_requests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  request_date DATE DEFAULT CURRENT_DATE,
  request_method TEXT,
  purpose TEXT,
  status TEXT DEFAULT 'pending',
  ship_date DATE,
  return_due_date DATE,
  total_items INTEGER DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sample_requests_client ON sample_requests(client_id, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status ON sample_requests(status);
CREATE INDEX IF NOT EXISTS idx_sample_requests_date ON sample_requests(request_date DESC);

-- Sample items (each request has multiple)
CREATE TABLE IF NOT EXISTS sample_items (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES sample_requests(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name TEXT NOT NULL,
  spec TEXT,
  quantity INTEGER DEFAULT 1,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  returned_date DATE,
  converted_to_transaction_id INTEGER REFERENCES transactions(id),
  conversion_value NUMERIC(12,2),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sample_items_request ON sample_items(request_id);
CREATE INDEX IF NOT EXISTS idx_sample_items_product ON sample_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sample_items_status ON sample_items(status);

-- Sample books (seasonal collections)
CREATE TABLE IF NOT EXISTS sample_books (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  season TEXT,
  year INTEGER,
  description TEXT,
  cover_url TEXT,
  status TEXT DEFAULT 'active',
  product_count INTEGER DEFAULT 0,
  send_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sample_books_status ON sample_books(status);
CREATE INDEX IF NOT EXISTS idx_sample_books_season ON sample_books(season, year);

-- Many-to-many: sample_books -> products
CREATE TABLE IF NOT EXISTS sample_book_items (
  sample_book_id INTEGER NOT NULL REFERENCES sample_books(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  PRIMARY KEY (sample_book_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sample_book_items_book ON sample_book_items(sample_book_id);

-- Auto-update sample_requests aggregates when items change
CREATE OR REPLACE FUNCTION update_sample_request_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  rid INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    rid := OLD.request_id;
  ELSE
    rid := NEW.request_id;
  END IF;

  UPDATE sample_requests SET
    total_items = COALESCE((SELECT SUM(quantity) FROM sample_items WHERE request_id = rid), 0),
    total_cost = COALESCE((SELECT SUM(unit_cost * quantity) FROM sample_items WHERE request_id = rid), 0),
    conversion_value = COALESCE((SELECT SUM(conversion_value) FROM sample_items WHERE request_id = rid), 0),
    updated_at = now()
  WHERE id = rid;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$func$;

DROP TRIGGER IF EXISTS trg_update_sample_request_totals ON sample_items;
CREATE TRIGGER trg_update_sample_request_totals
  AFTER INSERT OR UPDATE OR DELETE ON sample_items
  FOR EACH ROW EXECUTE FUNCTION update_sample_request_totals();

-- Auto-update sample_books.product_count
CREATE OR REPLACE FUNCTION update_sample_book_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  bid INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    bid := OLD.sample_book_id;
  ELSE
    bid := NEW.sample_book_id;
  END IF;

  UPDATE sample_books SET
    product_count = (SELECT COUNT(*) FROM sample_book_items WHERE sample_book_id = bid),
    updated_at = now()
  WHERE id = bid;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$func$;

DROP TRIGGER IF EXISTS trg_update_sample_book_count ON sample_book_items;
CREATE TRIGGER trg_update_sample_book_count
  AFTER INSERT OR DELETE ON sample_book_items
  FOR EACH ROW EXECUTE FUNCTION update_sample_book_count();

-- Client sample analytics view
CREATE OR REPLACE VIEW client_sample_analytics AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  c.current_stage,
  c.tier,
  COUNT(DISTINCT sr.id) AS total_requests,
  COUNT(si.id) AS total_items,
  COUNT(si.id) FILTER (WHERE si.status = 'returned') AS returned_count,
  COUNT(si.id) FILTER (WHERE si.status = 'lost') AS lost_count,
  COUNT(si.id) FILTER (WHERE si.status = 'converted') AS converted_count,
  COALESCE(SUM(si.conversion_value), 0) AS total_conversion_value,
  COALESCE(SUM(si.unit_cost * si.quantity), 0) AS total_sample_cost,
  CASE
    WHEN COUNT(si.id) > 0
      THEN ROUND((COUNT(si.id) FILTER (WHERE si.status = 'converted')::numeric / COUNT(si.id) * 100), 2)
    ELSE 0
  END AS conversion_rate,
  MAX(sr.request_date) AS most_recent_request
FROM clients c
LEFT JOIN sample_requests sr ON sr.client_id = c.id
LEFT JOIN sample_items si ON si.request_id = sr.id
GROUP BY c.id, c.name, c.current_stage, c.tier;

-- RLS
ALTER TABLE sample_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_book_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sample_requests_all ON sample_requests;
CREATE POLICY sample_requests_all ON sample_requests FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS sample_items_all ON sample_items;
CREATE POLICY sample_items_all ON sample_items FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS sample_books_all ON sample_books;
CREATE POLICY sample_books_all ON sample_books FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

DROP POLICY IF EXISTS sample_book_items_all ON sample_book_items;
CREATE POLICY sample_book_items_all ON sample_book_items FOR ALL USING (
  current_user_role() IN ('ceo', 'executive', 'employee', 'ai_agent')
);

GRANT UPDATE ON sample_requests TO supabase_auth_admin;
GRANT UPDATE ON sample_books TO supabase_auth_admin;
