import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { type Loan } from '../types';

export const LoanService = {
    getAll: async (): Promise<Loan[]> => {
        const querySnapshot = await getDocs(collection(db, "loans"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
    },

    getByCustomerId: async (customerId: string): Promise<Loan[]> => {
        const q = query(collection(db, "loans"), where("customerId", "==", customerId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
    },

    getByAgentId: async (agentId: string): Promise<Loan[]> => {
        const q = query(collection(db, "loans"), where("agentId", "==", agentId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
    },

    create: async (loan: Omit<Loan, 'id'>) => {
        const docRef = await addDoc(collection(db, "loans"), loan);
        await LoanService.updateCustomerAggregates(loan.customerId);
        return docRef.id;
    },

    update: async (id: string, data: Partial<Loan>) => {
        const loanRef = doc(db, "loans", id);
        await updateDoc(loanRef, data);

        // We need customerId to update aggregates. 
        // If it's not in data, we might need to fetch the loan first.
        // For efficiency, let's assume the caller might want to trigger aggregation ensuring they pass customerId or we fetch.
        // But for now, let's fetch the loan to get customerId if not present.
        if (data.customerId) {
            await LoanService.updateCustomerAggregates(data.customerId);
        } else {
            const snap = await import('firebase/firestore').then(mod => mod.getDoc(loanRef));
            if (snap.exists()) {
                const loanData = snap.data() as Loan;
                await LoanService.updateCustomerAggregates(loanData.customerId);
            }
        }
    },

    delete: async (id: string) => {
        const loanRef = doc(db, "loans", id);
        // Get customerId before delete
        const snap = await import('firebase/firestore').then(mod => mod.getDoc(loanRef));
        const customerId = snap.exists() ? snap.data().customerId : null;

        await deleteDoc(loanRef);

        if (customerId) {
            await LoanService.updateCustomerAggregates(customerId);
        }
    },

    updateCustomerAggregates: async (customerId: string) => {
        const loans = await LoanService.getByCustomerId(customerId);
        const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'DEFAULTED');

        const totalLoanAmount = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
        const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0);
        const totalDisbursed = activeLoans.reduce((sum, l) => sum + (l.disbursedAmount || 0), 0);
        const totalPaid = loans.reduce((sum, l) => sum + (l.paidAmount || 0), 0);

        const customerRef = doc(db, "customers", customerId);
        await updateDoc(customerRef, {
            totalLoanAmount,
            currentDueAmount: totalOutstanding,
            totalDisbursedAmount: totalDisbursed,
            totalPaidAmount: totalPaid,
            activeLoansCount: activeLoans.length
        });
    }
};
