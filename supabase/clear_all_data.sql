-- ============================================
-- PHONEMART: CLEAR ALL DATA FOR FRESH START
-- ============================================
-- This script deletes ALL business data INCLUDING
-- staff/user accounts. Only shops are kept.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================

-- 1. Delete child tables first (foreign key dependencies)

-- Staff procurement payments (references staff_procurements)
DELETE FROM procurement_payments;

-- Staff procurements
DELETE FROM staff_procurements;

-- Repair-related child tables
DELETE FROM repair_parts;
DELETE FROM additional_repair_items;

-- Sale-related child tables
DELETE FROM sale_items;

-- Purchase-related child tables
DELETE FROM purchase_items;

-- Stock allocation child tables
DELETE FROM stock_allocation_lines;

-- Payment records (references repairs, sales)
DELETE FROM payments;

-- 2. Delete parent tables

-- All repairs (customer repair data)
DELETE FROM repairs;

-- All sales (accessory/phone sales)
DELETE FROM sales;

-- All purchases (supplier purchase orders)
DELETE FROM purchases;

-- All stock allocations
DELETE FROM stock_allocations;

-- All inventory items
DELETE FROM inventory_items;

-- All suppliers
DELETE FROM suppliers;

-- All users/staff accounts (references shops)
DELETE FROM users;

-- ============================================
-- KEPT INTACT (NOT deleted):
--   ✅ shops    - Your shop structure (so you can re-add staff)
-- ============================================

-- Verify everything is cleared
SELECT 'procurement_payments' AS table_name, COUNT(*) AS remaining FROM procurement_payments
UNION ALL SELECT 'staff_procurements', COUNT(*) FROM staff_procurements
UNION ALL SELECT 'repairs', COUNT(*) FROM repairs
UNION ALL SELECT 'repair_parts', COUNT(*) FROM repair_parts
UNION ALL SELECT 'additional_repair_items', COUNT(*) FROM additional_repair_items
UNION ALL SELECT 'sales', COUNT(*) FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'purchase_items', COUNT(*) FROM purchase_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'stock_allocations', COUNT(*) FROM stock_allocations
UNION ALL SELECT 'stock_allocation_lines', COUNT(*) FROM stock_allocation_lines
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'shops (KEPT)', COUNT(*) FROM shops;
