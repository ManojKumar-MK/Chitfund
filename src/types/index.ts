export type UserRole = 'ADMIN' | 'AGENT';

export interface FieldDefinition {
    id: string;
    label: string;
    type: 'text' | 'number' | 'date';
    required: boolean;
}

export interface GlobalSettings {
    interestRates: {
        weekly: number; // Percent
    };
    customFields: {
        customer: FieldDefinition[];
        agent: FieldDefinition[];
    };
}

export interface User {
    uid: string;
    email: string;
    role: UserRole;
    displayName?: string;
    phone?: string;
    address?: string;
    createdAt: number;
    photo?: string; // Encrypted Base64 (Profile Photo)
    status?: 'ACTIVE' | 'INACTIVE';
    initialPassword?: string;
    customFields?: Record<string, any>;
    themePreference?: 'light' | 'dark';
    commissionPercentage?: number; // Weekly commission percentage
}

export interface ChitGroup {
    id: string;
    name: string;
    value: number;
    weeklyInstallment: number;
    durationWeeks: number;
    membersCount: number;
    foremanCommissionPercent: number;
    startDate: string; // ISO date
    endDate: string; // ISO date
    status: 'ACTIVE' | 'COMPLETED' | 'UPCOMING';
    members: string[]; // Customer IDs
}

export interface Customer {
    id: string;
    agentId: string; // Assigned agent
    name: string;
    phone: string;
    email?: string;
    address?: string;

    // Aggregates (Maintained by triggers/services)
    totalLoanAmount?: number; // Sum of all loans
    totalDisbursedAmount?: number;
    totalPaidAmount?: number;
    currentDueAmount?: number; // Total arrears/due across all loans
    activeLoansCount?: number;

    // Legacy / Single Loan (Optional/Deprecated)
    loanAmount?: number;
    disbursedAmount?: number;
    repaymentType: 'WEEKLY'; // Only weekly supported now

    tenure?: number;
    documents?: string[];
    aadhaarImage?: string;
    panImage?: string;
    photo?: string;
    kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
    customFields?: Record<string, any>;

    lastPaidDate?: number;
    createdAt: number;
}

export interface Auction {
    id: string;
    chitGroupId: string;
    date: string; // ISO Date
    winnerId: string; // Customer ID
    bidAmount: number;
    netPayout: number;
    status: 'COMPLETED' | 'PENDING';
}

export interface Collection {
    id: string;
    agentId: string;
    customerId: string;
    loanId?: string; // Specific loan this collection is for
    amount: number;
    date: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';

    // Snapshot values for history
    loanAmount?: number;
    outstanding: number;
    installment: number;
    collected: number; // Daily/Weekly collection amount
}

export interface Transaction {
    id: string;
    customerId: string;
    loanId?: string;
    amount: number;
    date: number;
    type: 'CREDIT' | 'DEBIT';
    collectedBy: string;
    description: string;
}


export interface Investor {
    id: string;
    name: string;
    amount: number;
    monthlyInterestPercent: number;
    expectedReturn: number;
    joinedAt: number;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface Loan {
    id: string;
    customerId: string;
    agentId: string;

    amount: number; // Principal
    disbursedAmount: number;
    interestRate?: number; // %

    repaymentType: 'WEEKLY';
    tenure: number; // In weeks or months

    paidAmount: number; // Amount paid so far
    outstandingAmount: number; // Remaining principal + interest? or just principal? Usually Principal + Interest in fixed model, or just keeping track of principal. Let's assume Total Due.

    status: 'ACTIVE' | 'CLOSED' | 'DEFAULTED' | 'SETTLED';
    startDate: number;
    endDate?: number;
    nextDueDate?: number;

    documents?: string[];
}
