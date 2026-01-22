import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, deleteDoc } from 'firebase/firestore';
import { type Customer } from '../types';

export const CustomerService = {
    // Fetch all customers
    getAll: async (): Promise<Customer[]> => {
        // In a real app with many users, we wouldn't fetch ALL. 
        // We'd index by agentId or use pagination.
        const querySnapshot = await getDocs(collection(db, "customers"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    },

    // Fetch customers by Agent ID
    getByAgentId: async (agentId: string): Promise<Customer[]> => {
        const q = query(collection(db, "customers"), where("agentId", "==", agentId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    },

    // Create new customer
    create: async (customer: Omit<Customer, 'id'>) => {
        const docRef = await addDoc(collection(db, "customers"), customer);
        return docRef.id;
    },

    // Update customer
    update: async (id: string, data: Partial<Customer>) => {
        const customerRef = doc(db, "customers", id);
        await updateDoc(customerRef, data);
    },

    delete: async (id: string) => {
        const docRef = doc(db, "customers", id);
        await deleteDoc(docRef);
    }
};
