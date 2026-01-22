import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { type Investor } from '../types';

export const InvestorService = {
    getAll: async (): Promise<Investor[]> => {
        const querySnapshot = await getDocs(collection(db, "investors"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investor));
    },

    create: async (investor: Omit<Investor, 'id'>) => {
        const docRef = await addDoc(collection(db, "investors"), investor);
        return docRef.id;
    },

    update: async (id: string, data: Partial<Investor>) => {
        const investorRef = doc(db, "investors", id);
        await updateDoc(investorRef, data);
    },

    delete: async (id: string) => {
        const investorRef = doc(db, "investors", id);
        await deleteDoc(investorRef);
    }
};
