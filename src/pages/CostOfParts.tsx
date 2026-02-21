import { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { useSupplierDebt } from "../context/SupplierDebtContext";

export default function CostOfParts() {
  const { repairs } = useRepair();
  const { currentUser } = useShop();
  const { debts, addDebt, updateDebtCost } = useSupplierDebt();
  const [searchTerm, setSearchTerm] = useState("");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [savedCosts, setSavedCosts] = useState<Record<string, number>>({});

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
      const hasOutsourcedAdditional = repair.additionalItems?.some(
        item => item.source === 'outsourced'
      );

      const hasZeroCostParts = repair.partsUsed.some(p => p.cost === 0);

      if (!hasOutsourcedAdditional && !hasZeroCostParts) return false;

      const allCostsFilled = getOutsourcedItemsForRepair(repair).every(item => {
        const key = `${repair.id}-${item.itemName}`;
        if (savedCosts[key] && savedCosts[key] > 0) return true;
        const debt = debts.find(d => d.repairId === repair.id && d.itemName === item.itemName);
        if (debt && debt.costPerUnit > 0) return true;
        return false;
      });

      return !allCostsFilled;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repairs, debts, currentUser, searchTerm, savedCosts]);

  function getOutsourcedItemsForRepair(repair: typeof repairs[0]) {
    const outsourcedItems: Array<{
      itemName: string;
      supplierName?: string;
      qty: number;
      source: string;
    }> = [];

    if (repair.additionalItems) {
      repair.additionalItems
        .filter(item => item.source === 'outsourced')
        .forEach(item => {
          outsourcedItems.push({
            itemName: item.itemName,
            supplierName: (item as any).supplierName || 'Unknown Supplier',
            qty: 1,
            source: 'outsourced_additional',
          });
        });
    }

    repair.partsUsed
      .filter(p => p.cost === 0)
      .forEach(part => {
        const alreadyAdded = outsourcedItems.some(o => o.itemName === part.itemName);
        if (!alreadyAdded) {
          outsourcedItems.push({
            itemName: part.itemName,
            qty: part.qty,
            source: 'outsourced_part',
          });
        }
      });

    return outsourcedItems;
  }

  const handleSaveCost = (repairId: string, itemName: string, qty: number, supplierName: string) => {
    const key = `${repairId}-${itemName}`;
    const costValue = costInputs[key];
    const costPerUnit = Number(costValue);
    if (!costValue || costPerUnit <= 0) {
      alert("Please enter a valid cost");
      return;
    }

    const existingDebt = debts.find(d => d.repairId === repairId && d.itemName === itemName);
    if (existingDebt) {
      updateDebtCost(existingDebt.id, costPerUnit);
    } else {
      addDebt({
        supplierId: 'outsourced',
        supplierName: supplierName || 'Unknown Supplier',
        itemName,
        quantity: qty,
        costPerUnit,
        repairId,
        type: 'repair',
      });
    }

    setSavedCosts(prev => ({ ...prev, [key]: costPerUnit }));
    setCostInputs(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    alert("Cost saved successfully!");
  };

  const handleCostInputChange = (key: string, value: string) => {
    setCostInputs(prev => ({
      ...prev,
      [key]: value,
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
        Input the actual cost of outsourced spare parts used in repairs. This aligns with repair sales for accurate profit tracking.
      </p>

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

      <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
        <p className="text-sm text-blue-800">
          Showing <span className="font-semibold">{repairsNeedingCosts.length}</span> repair(s) with outsourced parts needing cost input
        </p>
      </div>

      <div className="space-y-4">
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
                      const existingDebt = debts.find(
                        d => d.repairId === repair.id && d.itemName === item.itemName
                      );
                      const alreadySaved = savedCosts[key] || (existingDebt && existingDebt.costPerUnit > 0);

                      return (
                        <div
                          key={key}
                          className={`flex flex-wrap items-center gap-3 p-3 rounded border ${
                            alreadySaved ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                          }`}
                        >
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-600">
                              {item.supplierName && <>Supplier: {item.supplierName} | </>}
                              Qty: {item.qty}
                            </p>
                          </div>

                          {alreadySaved ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-700 font-semibold">
                                KES {(savedCosts[key] || existingDebt?.costPerUnit || 0).toLocaleString()} per unit
                              </span>
                              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">Saved</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Cost per unit"
                                value={costInputs[key] || ''}
                                onChange={(e) => handleCostInputChange(key, e.target.value)}
                                className="border-2 border-orange-300 rounded-md px-3 py-2 w-36 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                                min="0"
                                step="1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveCost(repair.id, item.itemName, item.qty, item.supplierName || '');
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleSaveCost(repair.id, item.itemName, item.qty, item.supplierName || '')}
                                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-green-700"
                              >
                                Save
                              </button>
                            </div>
                          )}
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

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>After completing a repair sale with outsourced parts, the repair appears here</li>
          <li>Enter the actual cost per unit for each outsourced part</li>
          <li>Click "Save" to record the cost</li>
          <li>This cost is used for profit calculations and supplier payment tracking</li>
        </ol>
      </div>
    </div>
  );
}
