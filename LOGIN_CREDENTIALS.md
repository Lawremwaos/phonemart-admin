# 🔐 Login Credentials - PHONEMART Admin System

## Default User Accounts

### 👑 Admin Account (Full Access)
- **Email:** `admin@phonemart.com`
- **Password:** `admin123`
- **Role:** Admin
- **Access:** Can see all shops, all features
- **Shop:** Main Branch (but sees all)

---

### 🏪 Shop 1 - Main Branch

#### Technician
- **Email:** `tech1@phonemart.com`
- **Password:** `tech123`
- **Role:** Technician
- **Access:** Sales, Inventory, Purchases, Exchange
- **Shop:** Main Branch only

---

### 🏪 Shop 2 - Westlands

#### Manager
- **Email:** `manager@phonemart.com`
- **Password:** `manager123`
- **Role:** Manager
- **Access:** All features (Sales, Inventory, Reports, etc.)
- **Shop:** Westlands only

#### Technician
- **Email:** `tech2@phonemart.com`
- **Password:** `tech123`
- **Role:** Technician
- **Access:** Sales, Inventory, Purchases, Exchange
- **Shop:** Westlands only

---

### 🏪 Shop 3 - Karen

#### Technician
- **Email:** `tech3@phonemart.com`
- **Password:** `tech123`
- **Role:** Technician
- **Access:** Sales, Inventory, Purchases, Exchange
- **Shop:** Karen only

---

### 🏪 Shop 4 - Parklands

#### Technician
- **Email:** `tech4@phonemart.com`
- **Password:** `tech123`
- **Role:** Technician
- **Access:** Sales, Inventory, Purchases, Exchange
- **Shop:** Parklands only

---

## 📊 Role Permissions

### Admin
- ✅ All features
- ✅ See all shops
- ✅ Access to all reports
- ✅ Full system access

### Manager
- ✅ All features
- ✅ See only their shop
- ✅ Access to reports
- ✅ Manage inventory

### Technician
- ✅ Sales
- ✅ Inventory (view)
- ✅ Purchases
- ✅ Exchange
- ❌ Reports (restricted)
- ❌ Full inventory management (restricted)

---

## 🔒 Security Note

**⚠️ IMPORTANT:** These are default demo credentials. 

For production use:
1. Change all passwords
2. Use strong passwords
3. Consider implementing proper authentication
4. Add password reset functionality
5. Use environment variables for sensitive data

---

## 📝 Quick Reference

| Email | Password | Role | Shop |
|-------|----------|------|------|
| admin@phonemart.com | admin123 | Admin | All |
| tech1@phonemart.com | tech123 | Technician | Main Branch |
| manager@phonemart.com | manager123 | Manager | Westlands |
| tech2@phonemart.com | tech123 | Technician | Westlands |
| tech3@phonemart.com | tech123 | Technician | Karen |
| tech4@phonemart.com | tech123 | Technician | Parklands |

---

## 🎯 Testing Different Roles

To test different user experiences:
1. Logout from current account
2. Login with different credentials
3. Notice the different access levels
4. Admin sees all shops, others see only their shop
