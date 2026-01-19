import React from "react";
import { useShop } from "../context/ShopContext";

export default function ShopSelector() {
  const { currentShop, shops, setCurrentShop, currentUser } = useShop();

  // If user is not admin, they can only see their shop
  const availableShops = React.useMemo(() => {
    if (!currentUser) return shops;
    return currentUser.roles.includes('admin') ? shops : shops.filter(s => s.id === currentUser.shopId);
  }, [currentUser, shops]);

  if (!availableShops || availableShops.length <= 1) {
    return (
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Current Shop</p>
            <p className="font-semibold">{currentShop?.name || 'No shop selected'}</p>
          </div>
          {currentUser && (
            <div className="text-right">
              <p className="text-sm text-gray-600">Logged in as</p>
              <p className="font-semibold">{currentUser.name}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser.roles.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Shop
      </label>
      <select
        value={currentShop?.id || ''}
        onChange={(e) => {
          const shop = shops.find(s => s.id === e.target.value);
          if (shop) setCurrentShop(shop);
        }}
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {availableShops.map((shop) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
      {currentUser && (
        <div className="mt-2 text-sm text-gray-600">
          Logged in as: <span className="font-semibold">{currentUser.name}</span> ({currentUser.roles.join(', ')})
        </div>
      )}
    </div>
  );
}
