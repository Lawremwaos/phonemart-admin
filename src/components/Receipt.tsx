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
            {(sale as any).serviceType && (
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Service:</span>
                <span className="font-semibold text-blue-700">{(sale as any).serviceType}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Phone Fixed - Only for repair sales */}
      {(sale as any).phoneModel && (
        <div className="border-t border-b border-gray-300 py-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Phone Fixed:</span>
            <span className="text-sm font-semibold">{(sale as any).phoneModel}</span>
          </div>
        </div>
      )}

      {/* Parts Used */}
      {sale.items && sale.items.length > 0 && (
        <div className="border-t border-b border-gray-300 py-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Parts Used:</h3>
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
      )}

      {/* Total and Payment Status */}
      <div className="border-t-2 border-gray-800 pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xl font-bold text-gray-900">TOTAL:</span>
          <span className="text-2xl font-bold text-gray-900">
            KES {((sale as any).totalAgreedAmount || sale.total).toLocaleString()}
          </span>
        </div>
        
        {/* Deposit and Balance */}
        {(sale as any).depositAmount && Number((sale as any).depositAmount) > 0 && (
          <>
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <span className="text-sm text-gray-600">Paid a deposit of:</span>
              <span className="text-sm font-semibold text-green-600">
                KES {Number((sale as any).depositAmount).toLocaleString()}
              </span>
            </div>
            {sale.balance !== undefined && sale.balance > 0 && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-gray-600">Remaining Balance:</span>
                <span className="text-sm font-semibold text-red-600">
                  KES {sale.balance.toLocaleString()} (NOT PAID)
                </span>
              </div>
            )}
          </>
        )}
        
        {/* Payment Status - Only show if no deposit */}
        {(!(sale as any).depositAmount || Number((sale as any).depositAmount) === 0) && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-300">
            <span className="text-sm text-gray-600">Payment Status:</span>
            <span className={`text-sm font-semibold ${
              (sale as any).paymentStatus === 'paid' || sale.paymentStatus === 'fully_paid' 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {(sale as any).paymentStatus === 'paid' || sale.paymentStatus === 'fully_paid' ? 'PAID' : 'NOT PAID'}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-500 border-t border-gray-300 pt-4 space-y-2">
        <p>Thank you for your business!</p>
        <p>This is a digital receipt</p>
        <p className="text-[10px] text-gray-500 leading-tight">
          Warranty for repairs: 30 days from repair date. Warranty excludes customer-caused damage (e.g. cracked screens, liquid or physical damage after repair). Present this receipt for warranty claims. Terms apply.
        </p>
      </div>
    </div>
  );
}
