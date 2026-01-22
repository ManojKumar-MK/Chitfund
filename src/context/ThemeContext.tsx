import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { UserService } from '../services/userService';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to dark mode as per original app design
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as Theme) || 'dark';
    });

    // We can now safely use useAuth because ThemeProvider is nested inside AuthProvider
    const { user } = useAuth();

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove old class
        root.classList.remove('light', 'dark');

        // Add new class
        root.classList.add(theme);

        // Save preference
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Sync from User Profile (Remote wins over Local if logged in)
    useEffect(() => {
        if (user?.themePreference && user.themePreference !== theme) {
            console.log("Syncing theme from user profile:", user.themePreference);
            setTheme(user.themePreference);
        }
    }, [user?.themePreference, user?.uid]); // Depend on preference and UID

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);

        // If logged in, save to Firestore
        if (user?.uid) {
            UserService.updateTheme(user.uid, newTheme).catch(err => {
                console.error("Failed to save theme preference:", err);
            });
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
