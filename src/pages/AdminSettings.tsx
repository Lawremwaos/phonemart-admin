import { useState } from "react";
import { useShop, type Shop, type User } from "../context/ShopContext";
import { supabase } from "../lib/supabaseClient";

export default function AdminSettings() {
  const { shops, users, staffAuditLogs, addShop, updateShop, deleteShop, addUser, updateUser, deleteUser, currentUser } = useShop();
  const [activeTab, setActiveTab] = useState<'shops' | 'staff'>('shops');
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const [showShopForm, setShowShopForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Shop form state
  const [shopForm, setShopForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    whatsappGroup: '',
  });

  // Staff form state
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    shopId: '',
    roles: ['technician'] as ('admin' | 'technician' | 'manager')[],
    managerScope: 'both' as 'accessories' | 'repair' | 'both',
  });
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Only admin can access this page
  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  const handleShopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShop) {
      updateShop(editingShop.id, shopForm);
    } else {
      addShop(shopForm);
    }
    setShowShopForm(false);
    setEditingShop(null);
    setShopForm({ name: '', address: '', phone: '', email: '', whatsappGroup: '' });
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffForm.roles.length === 0) {
      alert("Select at least one role (e.g. Admin, Technician, or Manager).");
      return;
    }
    if (editingUser) {
      const { password, ...rest } = staffForm;
      const payload = password.trim() ? staffForm : { ...rest };
      const result = await updateUser(editingUser.id, payload);
      if (!result.ok) {
        alert(
          result.error
            ? `Could not update staff: ${result.error}\n\nIf you use Supabase Row Level Security on the users table, run supabase/fix_users_anon_writes.sql so the app can save role changes.`
            : "Could not update staff. Check the browser console."
        );
        return;
      }
    } else {
      if (!staffForm.password.trim()) {
        alert("Password is required when adding a new staff member.");
        return;
      }
      const result = await addUser(staffForm);
      if (!result.ok) {
        alert(
          result.error
            ? `Could not add staff: ${result.error}\n\nIf you use Supabase Row Level Security on the users table, run supabase/fix_users_anon_writes.sql so the app can insert users.`
            : "Could not add staff. Check the browser console."
        );
        return;
      }
    }
    setShowStaffForm(false);
    setEditingUser(null);
    setStaffForm({ name: '', email: '', password: '', shopId: '', roles: ['technician'], managerScope: 'both' });
  };

  const handleEditShop = (shop: Shop) => {
    setEditingShop(shop);
    setShopForm({
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      email: shop.email || '',
      whatsappGroup: shop.whatsappGroup || '',
    });
    setShowShopForm(true);
  };

  const handleEditStaff = (user: User) => {
    setEditingUser(user);
    setStaffForm({
      name: user.name,
      email: user.email,
      password: '', // Don't show password
      shopId: user.shopId,
      roles: [...user.roles], // Copy roles array
      managerScope: user.managerScope || 'both',
    });
    setShowStaffForm(true);
  };

  const handleDeleteShop = (shopId: string) => {
    if (window.confirm('Are you sure you want to delete this shop? This will also delete all associated staff members.')) {
      deleteShop(shopId);
    }
  };

  const handleDeleteStaff = (userId: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      deleteUser(userId);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('⚠️ DELETE ALL DATA?\n\nThis will permanently remove:\n• All repairs, sales, inventory, purchases, suppliers\n• All stock allocations\n• All payments & staff procurements\n• All staff/user accounts\n\nShops will be kept. You will need to log in again after refresh.\n\nThis cannot be undone. Continue?')) return;
    if (!window.confirm('⚠️ Final confirmation: Erase EVERYTHING including all staff accounts. Proceed?')) return;

    setClearing(true);
    try {
      const uuidDummy = '00000000-0000-0000-0000-000000000000';
      const run = async (table: string, isUuid: boolean) => {
        const builder = supabase.from(table).delete();
        const { error } = isUuid
          ? await builder.neq('id', uuidDummy)
          : await builder.gte('id', 0);
        if (error) console.error(`Clear ${table}:`, error.message);
      };

      await run('procurement_payments', true);
      await run('staff_procurements', true);
      await run('repair_parts', false);
      await run('additional_repair_items', false);
      await run('stock_allocation_lines', false);
      await run('sale_items', false);
      await run('purchase_items', false);
      await run('payments', true);
      await run('repairs', true);
      await run('sales', true);
      await run('purchases', true);
      await run('stock_allocations', true);
      await run('inventory_items', false);
      await run('suppliers', true);
      await run('users', true);

      setClearDone(true);
      alert('All data has been cleared. Refreshing the app…');
      window.location.reload();
    } catch (err) {
      console.error('Clear all error:', err);
      alert('Something went wrong. Check the console.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pm-page-head">
        <div>
          <p className="pm-eyebrow">Admin</p>
          <h1 className="pm-page-title">Admin Settings</h1>
          <p className="pm-page-desc">Manage shops, staff accounts, and system-level controls.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-[var(--pm-border)]">
        <button
          onClick={() => setActiveTab('shops')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'shops'
              ? 'border-b-2 border-[var(--pm-accent)] text-[var(--pm-accent-strong)]'
              : 'text-[var(--pm-ink-soft)] hover:text-[var(--pm-ink)]'
          }`}
        >
          Shops
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'staff'
              ? 'border-b-2 border-[var(--pm-accent)] text-[var(--pm-accent-strong)]'
              : 'text-[var(--pm-ink-soft)] hover:text-[var(--pm-ink)]'
          }`}
        >
          Staff Management
        </button>
      </div>

      {/* Shops Tab */}
      {activeTab === 'shops' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Manage Shops</h2>
            <button
              onClick={() => {
                setEditingShop(null);
                setShopForm({ name: '', address: '', phone: '', email: '', whatsappGroup: '' });
                setShowShopForm(true);
              }}
              className="pm-btn pm-btn-primary"
            >
              + Add New Shop
            </button>
          </div>

          {showShopForm && (
            <div className="pm-card pm-pad-lg mb-6">
              <h3 className="text-xl font-semibold mb-4">
                {editingShop ? 'Edit Shop' : 'Add New Shop'}
              </h3>
              <form onSubmit={handleShopSubmit} className="space-y-4">
                <div>
                  <label className="pm-label">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="pm-input"
                    value={shopForm.name}
                    onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    Address/Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="pm-input"
                    value={shopForm.address}
                    onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="pm-input"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    Email
                  </label>
                  <input
                    type="email"
                    className="pm-input"
                    value={shopForm.email}
                    onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    WhatsApp Group Link
                  </label>
                  <input
                    type="url"
                    className="pm-input"
                    value={shopForm.whatsappGroup}
                    onChange={(e) => setShopForm({ ...shopForm, whatsappGroup: e.target.value })}
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="pm-btn pm-btn-primary"
                  >
                    {editingShop ? 'Update Shop' : 'Add Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShopForm(false);
                      setEditingShop(null);
                    }}
                    className="pm-btn pm-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="pm-table-shell">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Shop Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id} className="border-t border-[var(--pm-border)]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {shop.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {shop.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {shop.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {shop.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditShop(shop)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteShop(shop.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pm-card pm-pad mt-6">
            <h3 className="text-lg font-semibold mb-3">Staff Account History</h3>
            {staffAuditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No staff account changes logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--pm-surface-soft)]">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Action</th>
                      <th className="p-2 text-left">Target</th>
                      <th className="p-2 text-left">By</th>
                      <th className="p-2 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAuditLogs.map((log) => (
                      <tr key={log.id} className="border-t border-[var(--pm-border)]">
                        <td className="p-2">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="p-2">{log.action.replace("staff_", "").toUpperCase()}</td>
                        <td className="p-2">{log.targetName || "-"}</td>
                        <td className="p-2">{log.actor || "-"}</td>
                        <td className="p-2">{log.details || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Manage Staff</h2>
            <button
              onClick={() => {
                setEditingUser(null);
                setStaffForm({ name: '', email: '', password: '', shopId: '', roles: ['technician'], managerScope: 'both' });
                setShowStaffForm(true);
              }}
              className="pm-btn pm-btn-primary"
            >
              + Add New Staff
            </button>
          </div>

          {showStaffForm && (
            <div className="pm-card pm-pad-lg mb-6">
              <h3 className="text-xl font-semibold mb-4">
                {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div>
                  <label className="pm-label">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="pm-input"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="pm-input"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="pm-label">
                    Password {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required={!editingUser}
                      className="pm-input pr-10"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      placeholder={editingUser ? "Leave empty to keep current password" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-2 p-1 rounded text-gray-500 hover:bg-gray-100"
                      title={showStaffPassword ? 'Hide password' : 'Show password'}
                    >
                      {showStaffPassword ? (
                        <span className="text-sm font-medium">Hide</span>
                      ) : (
                        <span className="text-sm font-medium">Show</span>
                      )}
                    </button>
                  </div>
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">Leave empty to keep current password</p>
                  )}
                </div>
                <div>
                  <label className="pm-label">
                    Shop <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="pm-input"
                    value={staffForm.shopId}
                    onChange={(e) => setStaffForm({ ...staffForm, shopId: e.target.value })}
                  >
                    <option value="">Select a shop</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="pm-label">
                    Roles <span className="text-red-500">*</span> (Select multiple)
                  </label>
                  <div className="space-y-2">
                    {(['technician', 'manager', 'admin'] as const).map((role) => (
                      <label key={role} className="flex items-center">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={staffForm.roles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStaffForm({
                                ...staffForm,
                                roles: [...staffForm.roles, role],
                              });
                            } else {
                              setStaffForm({
                                ...staffForm,
                                roles: staffForm.roles.filter(r => r !== role),
                              });
                            }
                          }}
                        />
                        <span className="capitalize">{role}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Technician:</strong> Sales, Inventory, Purchases, Exchange<br />
                    <strong>Manager:</strong> All features for their shop<br />
                    <strong>Admin:</strong> Full system access, all shops
                  </p>
                </div>
                {staffForm.roles.includes('manager') && (
                  <div>
                    <label className="pm-label">
                      Manager Assignment
                    </label>
                    <select
                      className="pm-input"
                      value={staffForm.managerScope}
                      onChange={(e) =>
                        setStaffForm({
                          ...staffForm,
                          managerScope: e.target.value as 'accessories' | 'repair' | 'both',
                        })
                      }
                    >
                      <option value="accessories">Accessories Manager</option>
                      <option value="repair">Repair Manager</option>
                      <option value="both">Both (Accessories + Repair)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Use this to define what this manager oversees.
                    </p>
                  </div>
                )}
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="pm-btn pm-btn-primary"
                  >
                    {editingUser ? 'Update Staff' : 'Add Staff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffForm(false);
                      setEditingUser(null);
                    }}
                    className="pm-btn pm-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="pm-table-shell">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Manager Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--pm-border)]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {shops.find(s => s.id === user.shopId)?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              role === 'manager' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--pm-ink-soft)]">
                      {user.roles.includes('manager')
                        ? user.managerScope === 'accessories'
                          ? 'Accessories'
                          : user.managerScope === 'repair'
                          ? 'Repair'
                          : 'Both'
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditStaff(user)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteStaff(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger Zone: Clear All Data */}
      <div className="mt-10 border-t border-[var(--pm-border)] pt-8">
        <h2 className="text-xl font-bold text-red-700 mb-2">Danger Zone</h2>
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-red-800">Clear All Data</p>
            <p className="text-sm text-red-700 mt-1">
              Permanently delete all repairs, sales, inventory, purchases, suppliers, stock allocations, payments, staff procurements, and all staff/user accounts. Shops are kept. You will be logged out and must sign in again after refresh.
            </p>
          </div>
          <button
            onClick={handleClearAllData}
            disabled={clearing}
            className="pm-btn pm-btn-danger whitespace-nowrap disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Delete All Data'}
          </button>
        </div>
        {clearDone && (
          <p className="text-sm text-green-700 mt-2">Data cleared. Page will refresh.</p>
        )}
      </div>
    </div>
  );
}
