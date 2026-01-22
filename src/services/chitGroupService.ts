import { db } from '../lib/firebase';
import { collection, getDocs, doc, query, where, addDoc, updateDoc } from 'firebase/firestore';
import { type ChitGroup } from '../types';

export const ChitGroupService = {
    // Fetch all chit groups (or filter by status)
    getAll: async (status?: string): Promise<ChitGroup[]> => {
        let q = query(collection(db, "chitGroups"));
        if (status) {
            q = query(collection(db, "chitGroups"), where("status", "==", status));
        }
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChitGroup));
    },

    create: async (group: Omit<ChitGroup, 'id'>) => {
        const docRef = await addDoc(collection(db, "chitGroups"), group);
        return docRef.id;
    },

    update: async (id: string, group: Partial<ChitGroup>) => {
        const ref = doc(db, "chitGroups", id);
        await updateDoc(ref, group);
    }
};
