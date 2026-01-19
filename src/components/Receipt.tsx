import { type Sale } from "../context/SalesContext";

type ReceiptProps = {
  sale: Sale;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
};

export default function Receipt({ sale, shopName = "PHONEMART", shopAddress = "", shopPhone = "" }: ReceiptProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white p-8 max-w-md mx-auto shadow-lg" id="receipt">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <h1 className="text-3xl font-bold text-gray-900">{shopName}</h1>
        {shopAddress && <p className="text-sm text-gray-600 mt-1">{shopAddress}</p>}
        {shopPhone && <p className="text-sm text-gray-600">{shopPhone}</p>}
      </div>

      {/* Receipt Info */}
      <div className="mb-4 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Receipt #:</span>
          <span className="font-semibold">{sale.id}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Date & Time:</span>
          <span className="font-semibold">{formatDate(sale.date)}</span>
        </div>
        {sale.saleType && (
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Sale Type:</span>
            <span className="font-semibold capitalize">
              {sale.saleType === 'in-shop' ? 'In-Shop Sale' : sale.saleType === 'wholesale' ? 'Wholesale' : 'Repair Sale'}
            </span>
          </div>
        )}
        {/* Repair-specific customer info */}
        {(sale as any).customerName && (
          <>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Customer:</span>
              <span className="font-semibold">{(sale as any).customerName}</span>
            </div>
            {(sale as any).customerPhone && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{(sale as any).customerPhone}</span>
              </div>
            )}
            {(sale as any).phoneModel && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Phone Model:</span>
                <span className="font-semibold">{(sale as any).phoneModel}</span>
              </div>
            )}
            {(sale as any).issue && (
              <div className="mb-2">
                <span className="text-gray-600">Issue:</span>
                <p className="font-semibold">{(sale as any).issue}</p>
              </div>
            )}
            {(sale as any).technician && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Technician:</span>
                <span className="font-semibold">{(sale as any).technician}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Items - Simplified, no prices shown */}
      <div className="border-t border-b border-gray-300 py-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Items Used:</h3>
        <div className="space-y-2">
          {sale.items.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm font-medium">{item.name}</span>
              {item.qty > 1 && (
                <span className="text-sm text-gray-600">Qty: {item.qty}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Total - Show agreed amount if available, otherwise show calculated total */}
      <div className="border-t-2 border-gray-800 pt-4">
        
        {/* Payment Information */}
        {(sale.paymentType || (sale as any).paymentMethod) && (
          <>
            <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-300">
              <span className="text-sm text-gray-600">Payment Method:</span>
              <span className="text-sm font-semibold capitalize">
                {((sale as any).paymentMethod || sale.paymentType || '').replace(/_/g, ' ')}
              </span>
            </div>
            {sale.amountPaid !== undefined && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Amount Paid:</span>
                <span className="text-sm font-semibold text-green-600">KES {(sale.amountPaid || 0).toLocaleString()}</span>
              </div>
            )}
            {sale.balance !== undefined && sale.balance > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Balance:</span>
                <span className="text-sm font-semibold text-red-600">KES {sale.balance.toLocaleString()}</span>
              </div>
            )}
            
            {/* Transaction Codes Table */}
            {(sale as any).transactionCodes && Array.isArray((sale as any).transactionCodes) && (sale as any).transactionCodes.length > 0 && (
              <div className="mt-4 mb-2">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Transaction Codes:</h4>
                <table className="w-full border border-gray-300 text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left border-b border-gray-300">Method</th>
                      <th className="p-2 text-left border-b border-gray-300">Code</th>
                      {(sale as any).transactionCodes.some((tc: any) => tc.bank) && (
                        <th className="p-2 text-left border-b border-gray-300">Bank</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(sale as any).transactionCodes.map((tc: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="p-2 capitalize">{tc.method.replace(/_/g, ' ')}</td>
                        <td className="p-2 font-mono font-semibold">{tc.code}</td>
                        {tc.bank && <td className="p-2">{tc.bank}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Legacy deposit reference for backward compatibility */}
            {sale.depositReference && !(sale as any).transactionCodes && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Transaction Code:</span>
                <span className="text-sm font-semibold font-mono">{sale.depositReference}</span>
              </div>
            )}
            {sale.bank && !(sale as any).transactionCodes && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Bank:</span>
                <span className="text-sm font-semibold">{sale.bank}</span>
              </div>
            )}
          </>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
          <span className="text-xl font-bold text-gray-900">TOTAL:</span>
          <span className="text-2xl font-bold text-gray-900">
            KES {((sale as any).totalAgreedAmount || sale.total).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
        <p>Thank you for your business!</p>
        <p className="mt-2">This is a digital receipt</p>
      </div>
    </div>
  );
}
