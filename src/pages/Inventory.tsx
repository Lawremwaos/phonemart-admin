import { Link } from "react-router-dom";
import { useInventory } from "../context/InventoryContext";
import InventoryAlerts from "../components/InventoryAlerts";

export default function Inventory() {
  const { items } = useInventory();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <Link
          to="/inventory/manage"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Manage Inventory
        </Link>
      </div>

      {/* Inventory Alerts */}
      <div className="mb-6">
        <InventoryAlerts />
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Category</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const lowStock = item.stock <= item.reorderLevel;
              return (
                <tr 
                  key={item.id} 
                  className={`border-t ${lowStock ? 'bg-red-50' : ''}`}
                >
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{item.category}</td>
                  <td className={`p-3 font-semibold ${lowStock ? 'text-red-600' : ''}`}>
                    {item.stock}
                  </td>
                  <td className="p-3">KES {item.price}</td>
                  <td className="p-3">
                    {lowStock ? (
                      <span className="text-red-600 font-bold">LOW STOCK</span>
                    ) : (
                      <span className="text-green-600 font-bold">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
