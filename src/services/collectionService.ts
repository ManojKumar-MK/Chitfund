import { db } from '../lib/firebase';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { type Collection } from '../types';

export const CollectionService = {
    // Fetch all collections
    getAll: async (): Promise<Collection[]> => {
        const querySnapshot = await getDocs(collection(db, "collections"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
    },

    // Fetch collections for a specific agent
    getByAgentId: async (agentId: string): Promise<Collection[]> => {
        const q = query(collection(db, "collections"), where("agentId", "==", agentId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
    },

    // Fetch collections for a customer
    getByCustomerId: async (customerId: string): Promise<Collection[]> => {
        const q = query(collection(db, "collections"), where("customerId", "==", customerId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
    },

    create: async (data: Omit<Collection, 'id'>) => {
        const docRef = await addDoc(collection(db, "collections"), data);
        return docRef.id;
    },

    updateOutstanding: async (collectionId: string, newAmount: number) => {
        const { doc, updateDoc } = await import('firebase/firestore');
        const docRef = doc(db, "collections", collectionId);
        await updateDoc(docRef, { outstanding: newAmount });
    },

    // Helper to find or create a collection record for a customer if it doesn't exist
    // This is crucial because we might not have a collection record for every customer yet
    ensureCollectionRecord: async (agentId: string, customerId: string, loanId: string, initialAmount: number) => {
        const q = query(
            collection(db, "collections"),
            where("customerId", "==", customerId),
            where("loanId", "==", loanId),
            where("agentId", "==", agentId)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as Collection;
        }

        // Create new
        const newDoc = await addDoc(collection(db, "collections"), {
            agentId,
            customerId,
            loanId,
            totalDue: initialAmount,
            paid: 0,
            outstanding: initialAmount,
            status: 'PENDING',
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000
        });

        return { id: newDoc.id, agentId, customerId, loanId, outstanding: initialAmount } as Collection;
    }
};
