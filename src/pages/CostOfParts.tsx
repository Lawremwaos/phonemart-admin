import { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";

export default function CostOfParts() {
  const { repairs, updatePartCost } = useRepair();
  const { currentUser } = useShop();
  const [searchTerm, setSearchTerm] = useState("");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Get outsourced items for a repair that still need cost input
  function getOutsourcedItemsForRepair(repair: typeof repairs[0]) {
    const items: Array<{
      itemName: string;
      qty: number;
      source: 'part' | 'additional';
      currentCost: number;
      supplierName?: string;
    }> = [];

    // Parts with zero cost (outsourced, cost not yet entered)
    repair.partsUsed
      .filter(p => p.cost === 0)
      .forEach(part => {
        items.push({
          itemName: part.itemName,
          qty: part.qty,
          source: 'part',
          currentCost: 0,
          supplierName: part.supplierName,
        });
      });

    // Additional outsourced items not already covered in partsUsed
    if (repair.additionalItems) {
      repair.additionalItems
        .filter(item => item.source === 'outsourced')
        .forEach(item => {
          const alreadyInParts = items.some(i => i.itemName === item.itemName);
          const hasPartWithCost = repair.partsUsed.some(
            p => p.itemName === item.itemName && p.cost > 0
          );
          if (!alreadyInParts && !hasPartWithCost) {
            items.push({
              itemName: item.itemName,
              qty: 1,
              source: 'additional',
              currentCost: 0,
              supplierName: item.supplierName,
            });
          }
        });
    }

    return items;
  }

  // Repairs that have outsourced parts needing cost input
  const repairsNeedingCosts = useMemo(() => {
    let filtered = repairs;

    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(repair =>
        repair.customerName.toLowerCase().includes(term) ||
        repair.phoneNumber.includes(term) ||
        repair.phoneModel.toLowerCase().includes(term) ||
        repair.ticketNumber?.toLowerCase().includes(term)
      );
    }

    return filtered.filter(repair => {
      const outsourcedItems = getOutsourcedItemsForRepair(repair);
      return outsourcedItems.length > 0;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repairs, currentUser, searchTerm]);

  // Repairs with costs already entered (for reference)
  const repairsWithCosts = useMemo(() => {
    let filtered = repairs;

    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    return filtered.filter(repair => {
      const hasOutsourcedParts = repair.additionalItems?.some(i => i.source === 'outsourced') ||
        repair.partsUsed.some(p => p.cost > 0);
      const allCostsFilled = getOutsourcedItemsForRepair(repair).length === 0;
      return hasOutsourcedParts && allCostsFilled;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [repairs, currentUser]);

  const handleSaveCost = async (repairId: string, itemName: string, qty: number) => {
    const key = `${repairId}-${itemName}`;
    const costValue = costInputs[key];
    const costPerUnit = Number(costValue);
    if (!costValue || costPerUnit <= 0) {
      alert("Please enter a valid cost");
      return;
    }

    setSavingKeys(prev => new Set(prev).add(key));

    try {
      await updatePartCost(repairId, itemName, costPerUnit, qty);
      setCostInputs(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } catch (err) {
      console.error("Error saving cost:", err);
      alert("Failed to save cost. Please try again.");
    } finally {
      setSavingKeys(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  const handleCostInputChange = (key: string, value: string) => {
    setCostInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const getStatusLabel = (repair: typeof repairs[0]) => {
    if (repair.status === 'COLLECTED') return { text: 'Collected', color: 'bg-green-100 text-green-800' };
    if (repair.paymentStatus === 'fully_paid') return { text: 'Fully Paid', color: 'bg-blue-100 text-blue-800' };
    if (repair.paymentStatus === 'partial') return { text: 'Partial Payment', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Pending', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Cost of Parts</h1>
      <p className="text-gray-600 mb-4">
        Input the actual cost of outsourced spare parts used in repairs. Costs are saved to the database and persist across refreshes.
      </p>

      <div className="bg-white p-4 rounded shadow mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search Repairs</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 w-full"
          placeholder="Search by customer name, phone, model, or ticket number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-sm text-blue-800">
          Showing <span className="font-semibold">{repairsNeedingCosts.length}</span> repair(s) with outsourced parts needing cost input
        </p>
      </div>

      {/* Repairs needing cost input */}
      <div className="space-y-4 mb-8">
        {repairsNeedingCosts.length === 0 ? (
          <div className="bg-white p-8 rounded shadow text-center text-gray-500">
            <p className="text-lg font-medium mb-2">No repairs needing cost input</p>
            <p className="text-sm">All outsourced part costs have been entered, or there are no repairs with outsourced parts.</p>
          </div>
        ) : (
          repairsNeedingCosts.map((repair) => {
            const outsourcedItems = getOutsourcedItemsForRepair(repair);
            const status = getStatusLabel(repair);
            return (
              <div key={repair.id} className="bg-white rounded shadow overflow-hidden border border-gray-200">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {repair.customerName} - {repair.phoneModel}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {repair.phoneNumber} | {formatDate(repair.date)}
                        {repair.ticketNumber && <> | Ticket: <span className="font-mono">{repair.ticketNumber}</span></>}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Staff: <span className="font-medium text-indigo-700">{repair.technician || 'Unknown'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                      <span className="text-sm text-gray-500">
                        Total: KES {(repair.totalAgreedAmount || repair.totalCost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Issue: {repair.issue}</p>
                </div>

                <div className="px-6 py-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Outsourced Parts - Enter Cost:</h4>
                  <div className="space-y-3">
                    {outsourcedItems.map((item) => {
                      const key = `${repair.id}-${item.itemName}`;
                      const isSaving = savingKeys.has(key);
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-3 p-3 rounded border bg-orange-50 border-orange-200">
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-600">
                              Qty: {item.qty}
                              {item.supplierName && <> | Supplier: <span className="font-medium text-orange-700">{item.supplierName}</span></>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Cost per unit"
                              value={costInputs[key] || ''}
                              onChange={(e) => handleCostInputChange(key, e.target.value)}
                              className="border-2 border-orange-300 rounded-md px-3 py-2 w-36 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white text-gray-900"
                              min="0"
                              step="1"
                              disabled={isSaving}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCost(repair.id, item.itemName, item.qty);
                              }}
                            />
                            <button
                              onClick={() => handleSaveCost(repair.id, item.itemName, item.qty)}
                              disabled={isSaving}
                              className={`px-4 py-2 rounded text-sm font-semibold ${
                                isSaving ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700'
                              } text-white`}
                            >
                              {isSaving ? 'Saving...' : 'Save Cost'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recently completed costs */}
      {repairsWithCosts.length > 0 && (
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Recently Completed Cost Entries</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Staff</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Parts & Costs</th>
                  <th className="p-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {repairsWithCosts.map(repair => {
                  const partsCost = repair.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
                  return (
                    <tr key={repair.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{new Date(repair.date).toLocaleDateString()}</td>
                      <td className="p-2">
                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded font-medium">
                          {repair.technician || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-2 font-medium">{repair.customerName}</td>
                      <td className="p-2">{repair.phoneModel}</td>
                      <td className="p-2">
                        {repair.partsUsed.filter(p => p.cost > 0).map((p, i) => (
                          <span key={i} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded mr-1 mb-1">
                            {p.itemName}: KES {p.cost.toLocaleString()} x{p.qty}
                            {p.supplierName && ` (${p.supplierName})`}
                          </span>
                        ))}
                      </td>
                      <td className="p-2 text-right font-bold text-red-600">KES {partsCost.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How it Works:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>After completing a repair sale with outsourced parts, the repair appears here</li>
          <li>Enter the actual cost per unit for each outsourced part</li>
          <li>Click "Save Cost" - the cost is saved to the database permanently</li>
          <li>After saving, the repair moves to "Recently Completed" and the cost is used everywhere for profit calculations</li>
          <li>Costs persist even after page refresh or re-login</li>
        </ol>
      </div>
    </div>
  );
}
