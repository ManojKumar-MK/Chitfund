
export const isOverdue = (lastPaidDate: number | undefined): boolean => {
    if (!lastPaidDate) return true; // Never paid is overdue? Or maybe strictly check start date. Assuming logic: if loan active and not paid recently.

    const now = Date.now();
    const diffTime = Math.abs(now - lastPaidDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Exceeds > 8 days (7 + 1 grace)
    return diffDays > 8;
};

export const getDaysOverdue = (lastPaidDate: number | undefined): number => {
    if (!lastPaidDate) return 0;
    const now = Date.now();
    const diffTime = Math.abs(now - lastPaidDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
