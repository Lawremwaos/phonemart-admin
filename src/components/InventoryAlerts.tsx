import { useInventory } from "../context/InventoryContext";
import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

export default function InventoryAlerts() {
  const { items } = useInventory();
  const { currentShop } = useShop();

  const lowStockItems = items.filter(item => item.stock <= item.reorderLevel);

  if (lowStockItems.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-800 font-semibold">All items are well stocked!</p>
        </div>
      </div>
    );
  }

  const generateAlertText = () => {
    let text = `*INVENTORY ALERT - ${currentShop?.name || 'PHONEMART'}*\n\n`;
    text += `*Low Stock Items:*\n\n`;
    lowStockItems.forEach((item, index) => {
      text += `${index + 1}. ${item.name}\n`;
      text += `   Current Stock: ${item.stock}\n`;
      text += `   Reorder Level: ${item.reorderLevel}\n`;
      text += `   Category: ${item.category}\n\n`;
    });
    text += `Please restock these items as soon as possible.`;
    return text;
  };

  const handleNotifyAdmin = () => {
    const text = generateAlertText();
    shareViaWhatsApp(text);
  };

  const handleNotifyEmail = () => {
    const subject = `Inventory Alert - Low Stock Items`;
    const body = generateAlertText();
    shareViaEmail(subject, body, currentShop?.email);
  };

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <svg className="w-8 h-8 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-xl font-bold text-red-800">Low Stock Alert</h3>
            <p className="text-red-600 text-sm">{lowStockItems.length} item(s) need restocking</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleNotifyAdmin}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
          >
            Notify via WhatsApp
          </button>
          <button
            onClick={handleNotifyEmail}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Notify via Email
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {lowStockItems.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-red-200 rounded p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-semibold text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-600">
                Category: {item.category} | Reorder Level: {item.reorderLevel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-red-600">{item.stock}</p>
              <p className="text-xs text-red-600">units remaining</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
