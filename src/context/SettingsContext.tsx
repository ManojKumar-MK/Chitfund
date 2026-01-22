import React, { createContext, useContext, useState } from 'react';
import type { GlobalSettings, FieldDefinition } from '../types';

interface SettingsContextType {
    settings: GlobalSettings;
    updateInterestRates: (weekly: number) => void;
    addField: (target: 'customer' | 'agent', field: FieldDefinition) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<GlobalSettings>({
        interestRates: { weekly: 5 },
        customFields: { customer: [], agent: [] }
    });

    const updateInterestRates = (weekly: number) => {
        setSettings(prev => ({
            ...prev,
            interestRates: { weekly }
        }));
    };

    const addField = (target: 'customer' | 'agent', field: FieldDefinition) => {
        setSettings(prev => ({
            ...prev,
            customFields: {
                ...prev.customFields,
                [target]: [...prev.customFields[target], field]
            }
        }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateInterestRates, addField }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
