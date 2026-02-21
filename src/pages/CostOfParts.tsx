import { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";

export default function CostOfParts() {
  const { repairs } = useRepair();
  const { currentUser } = useShop();
  const { debts, updateDebtCost } = useSupplierDebt();
  const [searchTerm, setSearchTerm] = useState("");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});

  // Get repairs with outsourced parts that need cost input
  const repairsNeedingCosts = useMemo(() => {
    let filtered = repairs;

    // Filter by shop if not admin
    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(repair =>
        repair.customerName.toLowerCase().includes(term) ||
        repair.phoneNumber.includes(term) ||
        repair.phoneModel.toLowerCase().includes(term) ||
        repair.ticketNumber?.toLowerCase().includes(term)
      );
    }

    // Only show repairs that have outsourced parts
    return filtered.filter(repair => {
      const hasOutsourcedParts = repair.partsUsed.some(p => {
        // Check if part has a supplier debt entry
        const debt = debts.find(d => d.repairId === repair.id && d.itemName === p.itemName);
        return debt && debt.costPerUnit === 0; // Cost not yet filled
      });
      const hasOutsourcedAdditional = repair.additionalItems?.some(item => {
        if (item.source !== 'outsourced') return false;
        const debt = debts.find(d => d.repairId === repair.id && d.itemName === item.itemName);
        return debt && debt.costPerUnit === 0;
      });
      return hasOutsourcedParts || hasOutsourcedAdditional;
    });
  }, [repairs, debts, currentUser, searchTerm]);

  // Get debts for a specific repair
  const getRepairDebts = (repairId: string) => {
    return debts.filter(d => d.repairId === repairId && d.costPerUnit === 0);
  };

  const handleUpdateCost = (debtId: string, costValue: string) => {
    const costPerUnit = Number(costValue);
    if (!costValue || costPerUnit <= 0) {
      alert("Please enter a valid cost");
      return;
    }
    updateDebtCost(debtId, costPerUnit);
    setCostInputs(prev => {
      const updated = { ...prev };
      delete updated[debtId];
      return updated;
    });
    alert("Cost updated successfully!");
  };

  const handleCostInputChange = (debtId: string, value: string) => {
    setCostInputs(prev => ({
      ...prev,
      [debtId]: value,
    }));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Cost of Parts</h1>
      <p className="text-gray-600 mb-4">
        Input the actual cost of outsourced spare parts used in repairs. This aligns with repair sales for accurate profit tracking.
      </p>

      {/* Search */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Repairs
        </label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 w-full"
          placeholder="Search by customer name, phone, model, or ticket number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Repairs Needing Cost Input */}
      <div className="bg-white rounded shadow overflow-hidden">
        {repairsNeedingCosts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No repairs found with outsourced parts needing cost input.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Model
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outsourced Parts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Input Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repairsNeedingCosts.map((repair) => {
                  const repairDebts = getRepairDebts(repair.id);
                  return (
                    <tr key={repair.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(repair.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{repair.customerName}</div>
                        <div className="text-sm text-gray-500">{repair.phoneNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {repair.phoneModel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        {repair.ticketNumber || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="space-y-2">
                          {repairDebts.map((debt) => (
                            <div key={debt.id} className="bg-blue-50 border border-blue-200 rounded p-2">
                              <div className="font-medium text-blue-900">{debt.itemName}</div>
                              <div className="text-xs text-blue-700">
                                Supplier: {debt.supplierName} | Qty: {debt.quantity}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="space-y-3">
                          {repairDebts.map((debt) => (
                            <div key={debt.id} className="flex gap-2 items-center">
                              <input
                                type="number"
                                placeholder="Cost per unit"
                                value={costInputs[debt.id] || ''}
                                onChange={(e) => handleCostInputChange(debt.id, e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 w-32 text-sm"
                                min="0"
                                step="0.01"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateCost(debt.id, costInputs[debt.id] || '');
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleUpdateCost(debt.id, costInputs[debt.id] || '')}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                              >
                                Save
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>After completing a repair sale with outsourced parts, find the repair in this list</li>
          <li>Enter the actual cost per unit for each outsourced part</li>
          <li>Click "Save" to update the cost</li>
          <li>This cost will be used for profit calculations and supplier payment tracking</li>
        </ol>
      </div>
    </div>
  );
}
