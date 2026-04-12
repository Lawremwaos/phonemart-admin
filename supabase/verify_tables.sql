-- Verify all tables were created successfully
-- Run this in Supabase SQL Editor to check if tables exist

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'suppliers',
    'inventory_items',
    'purchases',
    'purchase_items',
    'stock_allocations',
    'stock_allocation_lines',
    'stock_allocation_acceptances',
    'inventory_audit_logs',
    'inventory_manager_approvals',
    'inventory_stock_movements',
    'inventory_stock_lots',
    'staff_audit_logs',
    'returns',
    'repairs',
    'repair_parts',
    'additional_repair_items',
    'sales',
    'sale_items',
    'payments'
  )
ORDER BY table_name;

-- Expected result: 18 rows (one for each table)
-- If you see fewer rows, some tables weren't created
