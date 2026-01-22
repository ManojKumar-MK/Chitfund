import { db } from '../lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

export interface Activity {
    id?: string;
    type: 'ASSIGNMENT' | 'UNASSIGNMENT' | 'LOAN_CREATED' | 'PAYMENT' | 'STATUS_CHANGE';
    customerId: string;
    customerName: string;
    agentId?: string;
    agentName?: string;
    description: string;
    timestamp: number;
    metadata?: any;
}

export const ActivityService = {
    log: async (activity: Omit<Activity, 'id'>) => {
        try {
            const docRef = await addDoc(collection(db, 'activities'), {
                ...activity,
                timestamp: Date.now(),
                createdAt: Timestamp.now()
            });
            return docRef.id;
        } catch (error) {
            console.error('Failed to log activity:', error);
            return null;
        }
    },

    getCustomerActivities: async (customerId: string): Promise<Activity[]> => {
        const q = query(
            collection(db, 'activities'),
            where('customerId', '==', customerId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    },

    getAgentActivities: async (agentId: string): Promise<Activity[]> => {
        const q = query(
            collection(db, 'activities'),
            where('agentId', '==', agentId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    },

    getAll: async (): Promise<Activity[]> => {
        const snapshot = await getDocs(collection(db, 'activities'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    }
};
