import { db } from '../lib/firebase';
import { collection, getDocs, doc, query, where, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { type User } from '../types';

export const UserService = {
    // Fetch all agents
    getAgents: async (): Promise<User[]> => {
        const q = query(collection(db, "users"), where("role", "==", "AGENT"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    },

    // Create or Update agent (Warning: Creating here doesn't create auth user, just firestore doc)
    // In a real app, you'd use Admin SDK or Cloud Functions to create Auth user.
    saveAgent: async (agent: User) => {
        // We use setDoc to specify the ID (uid) if it exists, or create new if we generate one.
        // If we want to generate a new ID, we can use doc(collection(db, "users")).
        const normalizedEmail = agent.email.toLowerCase().trim();
        const ref = doc(db, "users", agent.uid);
        await setDoc(ref, {
            ...agent,
            email: normalizedEmail,
            // Ensure initialPassword matches logic if passed (though User type doesn't stricly have it, the spread covers it if passed as 'any')
        }, { merge: true });
    },

    // Fetch all users (Admins + Agents)
    getAll: async (): Promise<User[]> => {
        const querySnapshot = await getDocs(collection(db, "users"));
        return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
    },

    // Invite/Pre-create a user. 
    // We store an 'initialPassword' to verify the user during their first "Sign Up" (which looks like a login).
    inviteUser: async (email: string, role: 'ADMIN' | 'AGENT', name: string, initialPassword?: string) => {
        const normalizedEmail = email.toLowerCase().trim();
        // Check if exists
        const q = query(collection(db, "users"), where("email", "==", normalizedEmail));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error("User already exists");

        // Create temp doc.
        const newRef = doc(collection(db, "users"));
        const userData: any = {
            uid: newRef.id, // Temporary ID
            email: normalizedEmail,
            displayName: name,
            role,
            status: 'ACTIVE',
            createdAt: Date.now()
        };

        if (initialPassword) {
            userData.initialPassword = initialPassword;
        }

        await setDoc(newRef, userData);
    },

    updateStatus: async (uid: string, status: 'ACTIVE' | 'INACTIVE') => {
        const ref = doc(db, "users", uid);
        await updateDoc(ref, { status });
    },

    updateTheme: async (uid: string, theme: 'light' | 'dark') => {
        const ref = doc(db, "users", uid);
        await updateDoc(ref, { themePreference: theme });
    },

    delete: async (uid: string) => {
        const ref = doc(db, "users", uid);
        await deleteDoc(ref);
    }
};
