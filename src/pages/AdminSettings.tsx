import { useState } from "react";
import { useShop, type Shop, type User } from "../context/ShopContext";

export default function AdminSettings() {
  const { shops, users, addShop, updateShop, deleteShop, addUser, updateUser, deleteUser, currentUser } = useShop();
  const [activeTab, setActiveTab] = useState<'shops' | 'staff'>('shops');
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
  });

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

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser(editingUser.id, staffForm);
    } else {
      addUser(staffForm);
    }
    setShowStaffForm(false);
    setEditingUser(null);
    setStaffForm({ name: '', email: '', password: '', shopId: '', roles: ['technician'] });
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Settings</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('shops')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'shops'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Shops
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'staff'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
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
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Add New Shop
            </button>
          </div>

          {showShopForm && (
            <div className="bg-white p-6 rounded shadow mb-6">
              <h3 className="text-xl font-semibold mb-4">
                {editingShop ? 'Edit Shop' : 'Add New Shop'}
              </h3>
              <form onSubmit={handleShopSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={shopForm.name}
                    onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address/Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={shopForm.address}
                    onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={shopForm.email}
                    onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp Group Link
                  </label>
                  <input
                    type="url"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={shopForm.whatsappGroup}
                    onChange={(e) => setShopForm({ ...shopForm, whatsappGroup: e.target.value })}
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    {editingShop ? 'Update Shop' : 'Add Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShopForm(false);
                      setEditingShop(null);
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shop Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shop.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shop.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shop.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                setStaffForm({ name: '', email: '', password: '', shopId: '', roles: ['technician'] });
                setShowStaffForm(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Add New Staff
            </button>
          </div>

          {showStaffForm && (
            <div className="bg-white p-6 rounded shadow mb-6">
              <h3 className="text-xl font-semibold mb-4">
                {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder={editingUser ? "Leave empty to keep current password" : ""}
                  />
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">Leave empty to keep current password</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="border border-gray-300 rounded-md px-3 py-2 w-full"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    {editingUser ? 'Update Staff' : 'Add Staff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffForm(false);
                      setEditingUser(null);
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
    </div>
  );
}
