// Default lists (editable on the phone). Family names are neutral placeholders.
export const SEED_CATEGORIES = ['Self', 'Home', 'Office', 'Savings', 'Travel']
export const SEED_ACCOUNTS = ['HDFC', 'CUB', 'Self', 'HDFC CC', 'AMEX CC', 'Pluxee']
export const DEFAULT_META = {
  lastExport: null, // local ISO of the last export
  exportedIds: [], // ids that were in an export file
  last: { type: 'Expense', category: 'Self', mode: 'UPI', from_account: 'HDFC', to_account: 'HDFC' },
  persistAsked: false,
  persisted: null,
  installHintDismissed: false,
  entriesHintDismissed: false,
}

// Spend names per category. Editable on the phone.
export const SEED_NAMES = {
  Self: ['Others', 'Flower', 'Food', 'Swiggy', 'Uber', 'Snacks', 'Metro', 'Family 2', 'CC personal', 'RD', 'Netflix', 'Amazon', 'Wifi', 'Restaurant', 'Fuel', 'Movie', 'Recharge', 'Groceries', 'Family 3', 'Insurance', 'Medicine', 'Spotify', 'Swimming', 'Haircut'],
  Home: ['Others', 'Family 2', 'Groceries', 'Swiggy', 'Amazon', 'CC personal', 'EMI', 'Wifi', 'Income tax', 'Salary', 'Family 3', 'Milk', 'Maavu', 'Flower', 'EPF', 'Insurance', 'Fuel', 'Family 1', 'Travel fund', 'Self transfer', 'Restaurant', 'RD', 'Food', 'Medicine', 'Prof Tax', 'Gold', 'Uber', 'Snacks'],
  Travel: ['Others', 'Fuel', 'Restaurant', 'Food', 'Snacks', 'Uber', 'Hotel stay', 'Family 3'],
  Savings: ['Gold', 'Mutual fund', 'RD', 'PPF', 'Self transfer', 'Travel fund', 'Silver'],
  Office: ['Reimbursement', 'Swiggy', 'Food', 'Uber', 'Snacks', 'Restaurant', 'Others', 'Hotel stay', 'Metro'],
}
