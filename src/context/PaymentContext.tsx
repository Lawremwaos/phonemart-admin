import React, { createContext, useContext, useState, useCallback } from "react";

export type PaymentType = 'cash' | 'mpesa' | 'bank_deposit';
export type PaymentState = 'pending' | 'partial' | 'fully_paid' | 'pending_deposit';

export type Bank = 'KCB' | 'Equity' | 'Cooperative' | 'Absa' | 'Standard Chartered' | 'Other';

export type Payment = {
  id: string;
  date: Date;
  type: PaymentType;
  amount: number;
  state: PaymentState;
  bank?: Bank;
  depositReference?: string;
  deposited: boolean; // For cash payments
  depositDate?: Date;
  shopId?: string;
  relatedTo: 'sale' | 'repair';
  relatedId: string; // Sale ID or Repair ID
};

type PaymentContextType = {
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id' | 'date'>) => void;
  markCashDeposited: (paymentId: string, depositDate?: Date) => void;
  getPaymentsByType: (type: PaymentType) => Payment[];
  getPaymentsByShop: (shopId: string) => Payment[];
  getTotalCashCollected: () => number;
  getTotalMpesaCollected: () => number;
  getTotalBankDeposits: () => number;
  getPendingCashDeposits: () => Payment[];
  getDailyPayments: () => Payment[];
};

const PaymentContext = createContext<PaymentContextType | null>(null);

export const PaymentProvider = ({ children }: { children: React.ReactNode }) => {
  const [payments, setPayments] = useState<Payment[]>([]);

  const addPayment = useCallback((paymentData: Omit<Payment, 'id' | 'date'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: Date.now().toString(),
      date: new Date(),
      deposited: paymentData.type === 'cash' ? false : true, // Cash needs deposit, others are already digital
    };
    
    setPayments((prev) => [...prev, newPayment]);
  }, []);

  const markCashDeposited = useCallback((paymentId: string, depositDate?: Date) => {
    setPayments((prev) =>
      prev.map((payment) =>
        payment.id === paymentId
          ? { ...payment, deposited: true, depositDate: depositDate || new Date() }
          : payment
      )
    );
  }, []);

  const getPaymentsByType = useCallback((type: PaymentType) => {
    return payments.filter(payment => payment.type === type);
  }, [payments]);

  const getPaymentsByShop = useCallback((shopId: string) => {
    return payments.filter(payment => payment.shopId === shopId);
  }, [payments]);

  const getTotalCashCollected = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payments
      .filter(payment => {
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);
        return payment.type === 'cash' && paymentDate.getTime() === today.getTime();
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const getTotalMpesaCollected = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payments
      .filter(payment => {
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);
        return payment.type === 'mpesa' && paymentDate.getTime() === today.getTime();
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const getTotalBankDeposits = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payments
      .filter(payment => {
        const paymentDate = new Date(payment.date);
        paymentDate.setHours(0, 0, 0, 0);
        return payment.type === 'bank_deposit' && paymentDate.getTime() === today.getTime();
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const getPendingCashDeposits = useCallback(() => {
    return payments.filter(payment => payment.type === 'cash' && !payment.deposited);
  }, [payments]);

  const getDailyPayments = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      paymentDate.setHours(0, 0, 0, 0);
      return paymentDate.getTime() === today.getTime();
    });
  }, [payments]);

  return (
    <PaymentContext.Provider
      value={{
        payments,
        addPayment,
        markCashDeposited,
        getPaymentsByType,
        getPaymentsByShop,
        getTotalCashCollected,
        getTotalMpesaCollected,
        getTotalBankDeposits,
        getPendingCashDeposits,
        getDailyPayments,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = () => {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("PaymentContext not found");
  return ctx;
};
