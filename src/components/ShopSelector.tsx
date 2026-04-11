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
      <div className="pm-card pm-pad mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Current shop</p>
            <p className="font-semibold text-[var(--pm-ink)]">{currentShop?.name || 'No shop selected'}</p>
          </div>
          {currentUser && (
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pm-ink-soft)]">Session</p>
              <p className="font-semibold text-[var(--pm-ink)]">{currentUser.name}</p>
              <p className="text-xs capitalize text-[var(--pm-ink-soft)]">{currentUser.roles.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pm-card pm-pad mb-4">
      <label className="mb-2 block text-sm font-medium text-[var(--pm-ink-soft)]">
        Select shop
      </label>
      <select
        value={currentShop?.id || ''}
        onChange={(e) => {
          const shop = shops.find(s => s.id === e.target.value);
          if (shop) setCurrentShop(shop);
        }}
        className="pm-select"
      >
        {availableShops.map((shop) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
      {currentUser && (
        <div className="mt-3 text-xs text-[var(--pm-ink-soft)]">
          Signed in as <span className="font-semibold text-[var(--pm-ink)]">{currentUser.name}</span>
          <span className="capitalize"> ({currentUser.roles.join(', ')})</span>
        </div>
      )}
    </div>
  );
}
