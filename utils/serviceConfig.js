/**
 * CENTRALIZED SERVICE CONFIGURATION
 * Single source of truth for service types, labels, times, and colors.
 * Import this wherever service data is needed.
 */

const SERVICE_TYPES = [
    'aadhaar_update',
    'caste_certificate_verification',
    'income_certificate_verification',
    'birth_certificate_verification',
    'municipal_enquiry',
    'other'
];

const SERVICE_LABELS = {
    aadhaar_update: 'Aadhaar Update / Correction',
    caste_certificate_verification: 'Caste Certificate Verification',
    income_certificate_verification: 'Income Certificate Verification',
    birth_certificate_verification: 'Birth Certificate Verification',
    municipal_enquiry: 'Municipal Enquiry',
    other: 'Other Services'
};

// Average service time in minutes per service type
const SERVICE_TIME = {
    aadhaar_update: 7,
    caste_certificate_verification: 5,
    income_certificate_verification: 5,
    birth_certificate_verification: 4,
    municipal_enquiry: 3,
    other: 6
};

// UI colors for each service (charts, badges, cards)
const SERVICE_COLORS = {
    aadhaar_update: '#3B82F6',
    caste_certificate_verification: '#10b981',
    income_certificate_verification: '#f59e0b',
    birth_certificate_verification: '#8b5cf6',
    municipal_enquiry: '#ef4444',
    other: '#6b7280'
};

// Icons for each service (FontAwesome class names)
const SERVICE_ICONS = {
    aadhaar_update: 'fa-id-card',
    caste_certificate_verification: 'fa-file-alt',
    income_certificate_verification: 'fa-money-bill',
    birth_certificate_verification: 'fa-baby',
    municipal_enquiry: 'fa-building',
    other: 'fa-ellipsis-h'
};

// Required documents checklist per service
const SERVICE_DOCUMENTS = {
    aadhaar_update: [
        'Valid Proof of Identity (Aadhaar Card / Voter ID)',
        'Proof of Address (Utility bill / Bank Statement)',
        'Mobile Number linked to Aadhaar',
        'Recent Passport Size Photos'
    ],
    caste_certificate_verification: [
        'Residence Certificate',
        'Parental Caste Certificate',
        'School / TC Certificate (if applicable)',
        'Aadhaar Card / Voter ID (Any valid photo ID)',
        'Affidavit / Self-Declaration form'
    ],
    income_certificate_verification: [
        'Aadhaar Card',
        'IT Returns (Form 16 / Salary Slip)',
        'Bank Passbook or Statement',
        'Employer Letter or Business Proof'
    ],
    birth_certificate_verification: [
        'Hospital Birth Record or Discharge Summary',
        'Parents\' Aadhaar Cards',
        'Marriage Certificate (if applicable)',
        '2 Passport Size Photographs of parents',
        'Affidavit from Notary (if delayed registration)'
    ],
    municipal_enquiry: [
        'Property Tax Receipts',
        'Property documents / NOC',
        'Aadhaar Card / Voter ID of owner',
        'Previous correspondence with municipal office (if any)'
    ],
    other: [
        'Valid Proof of Identity (Aadhaar Card / Passport)',
        'Relevant documents for requested service',
        'Application form (if applicable)',
        'Recent Passport Size Photos'
    ]
};

/**
 * Calculate estimated wait time for a new token based on pending tokens.
 * Each pending token contributes its service-specific average time.
 * @param {Array} pendingTokens - Array of { serviceType } objects currently pending
 * @param {String} newServiceType - The service type of the new token being created
 * @returns {Number} Estimated wait in minutes
 */
function calculateEstimatedWaitTime(pendingTokens, newServiceType) {
    let totalWait = 0;
    for (const token of pendingTokens) {
        totalWait += SERVICE_TIME[token.serviceType] || SERVICE_TIME.other;
    }
    // Add at least the new token's own service time as base
    return totalWait;
}

module.exports = {
    SERVICE_TYPES,
    SERVICE_LABELS,
    SERVICE_TIME,
    SERVICE_COLORS,
    SERVICE_ICONS,
    SERVICE_DOCUMENTS,
    calculateEstimatedWaitTime
};
