import { db } from '../lib/firebase';
import { collection, getDocs, query, where, addDoc, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { type Transaction } from '../types';

export const PaymentService = {
    // Fetch payments by customer
    getByCustomerId: async (customerId: string): Promise<Transaction[]> => {
        const q = query(collection(db, "payments"), where("customerId", "==", customerId));
        // Note: Client-side sorting might be needed if composite index is missing for customerId + date
        const querySnapshot = await getDocs(q);
        const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        return payments.sort((a, b) => b.date - a.date);
    },

    getByAgentId: async (agentId: string): Promise<Transaction[]> => {
        const q = query(collection(db, "payments"), where("collectedBy", "==", agentId));
        const querySnapshot = await getDocs(q);
        const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        return payments.sort((a, b) => b.date - a.date);
    },

    // Fetch all payments (careful with large datasets)
    getAll: async (): Promise<Transaction[]> => {
        const q = query(collection(db, "payments"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    },

    // Fetch recent payments
    getRecent: async (limitCount: number): Promise<Transaction[]> => {
        const q = query(collection(db, "payments"), orderBy("date", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    },

    create: async (payment: Omit<Transaction, 'id'>) => {
        const docRef = await addDoc(collection(db, "payments"), payment);
        return docRef.id;
    },

    delete: async (id: string) => {
        const docRef = doc(db, "payments", id);
        await deleteDoc(docRef);
    }
};
