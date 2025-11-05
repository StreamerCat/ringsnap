// ZIP to Area Code mapping for local phone number provisioning
// Covers top 100 US metros and major cities

export const ZIP_TO_AREA_CODE_MAP: Record<string, string> = {
  // California
  '90': '310', '91': '818', '92': '619', '93': '661', '94': '415', '95': '916',
  // New York
  '10': '212', '11': '718', '12': '518', '13': '315', '14': '585',
  // Texas
  '75': '214', '76': '817', '77': '713', '78': '512', '79': '806',
  // Florida
  '32': '904', '33': '305', '34': '727', '35': '850',
  // Illinois
  '60': '312', '61': '309', '62': '618',
  // Pennsylvania
  '15': '412', '16': '814', '17': '717', '18': '570', '19': '215',
  // Ohio
  '43': '614', '44': '216', '45': '937',
  // Georgia
  '30': '404', '31': '912',
  // North Carolina
  '27': '919', '28': '704',
  // Michigan
  '48': '313', '49': '616',
  // Arizona
  '85': '602', '86': '928',
  // Massachusetts
  '01': '413', '02': '617',
  // Washington
  '98': '206', '99': '509',
  // Colorado
  '80': '303', '81': '970',
  // Nevada
  '89': '702',
  // Oregon
  '97': '503',
  // Tennessee
  '37': '615',
  // Missouri
  '63': '314', '64': '816', '65': '660',
  // Wisconsin
  '53': '414',
  // Minnesota
  '55': '612',
  // Louisiana
  '70': '504',
  // Oklahoma
  '73': '405', '74': '918',
  // Connecticut
  '06': '203',
  // Utah
  '84': '801',
  // Kansas
  '66': '316', '67': '785',
  // Arkansas
  '71': '479', '72': '501',
  // Mississippi
  '39': '228',
  // Nebraska
  '68': '402', '69': '308',
  // New Mexico
  '87': '505', '88': '575',
  // West Virginia
  '25': '304',
  // Idaho
  '83': '208',
  // Hawaii
  '96': '808',
  // Maine
  '04': '207',
  // New Hampshire
  '03': '603',
  // Montana
  '59': '406',
  // South Dakota
  '57': '605',
  // North Dakota
  '58': '701',
  // Alaska
  '99': '907',
  // Vermont
  '05': '802',
  // Wyoming
  '82': '307',
};

/**
 * Get area code from ZIP code
 * Uses first 2 digits of ZIP for lookup
 * Falls back to closest metro if exact match not found
 */
export function getAreaCodeFromZip(zip: string): string {
  if (!zip || zip.length < 2) {
    return '555'; // Default fallback
  }

  const prefix = zip.substring(0, 2);
  const areaCode = ZIP_TO_AREA_CODE_MAP[prefix];

  if (areaCode) {
    return areaCode;
  }

  // Fallback to nearest major metro based on ZIP prefix
  const fallbackMap: Record<string, string> = {
    '0': '617', // Northeast
    '1': '212', // NY metro
    '2': '202', // Mid-Atlantic
    '3': '404', // Southeast
    '4': '615', // Mid-South
    '5': '612', // North Central
    '6': '312', // Central
    '7': '214', // South Central
    '8': '303', // Mountain
    '9': '415', // Pacific
  };

  return fallbackMap[prefix[0]] || '555';
}

/**
 * Get state code from ZIP (for recording law compliance)
 */
export function getStateFromZip(zip: string): string | null {
  if (!zip || zip.length < 2) return null;

  const stateMap: Record<string, string> = {
    '90': 'CA', '91': 'CA', '92': 'CA', '93': 'CA', '94': 'CA', '95': 'CA', '96': 'CA',
    '10': 'NY', '11': 'NY', '12': 'NY', '13': 'NY', '14': 'NY',
    '75': 'TX', '76': 'TX', '77': 'TX', '78': 'TX', '79': 'TX',
    '32': 'FL', '33': 'FL', '34': 'FL', '35': 'FL',
    '60': 'IL', '61': 'IL', '62': 'IL',
    '15': 'PA', '16': 'PA', '17': 'PA', '18': 'PA', '19': 'PA',
    '43': 'OH', '44': 'OH', '45': 'OH',
    '30': 'GA', '31': 'GA',
    '27': 'NC', '28': 'NC',
    '48': 'MI', '49': 'MI',
    '85': 'AZ', '86': 'AZ',
    '01': 'MA', '02': 'MA',
    '98': 'WA', '99': 'WA',
    '80': 'CO', '81': 'CO',
    '89': 'NV',
    '97': 'OR',
    '37': 'TN', '38': 'TN',
    '63': 'MO', '64': 'MO', '65': 'MO',
    '53': 'WI',
    '55': 'MN',
    '70': 'LA',
    '73': 'OK', '74': 'OK',
    '06': 'CT',
    '84': 'UT',
    '04': 'ME',
    '03': 'NH',
  };

  const prefix = zip.substring(0, 2);
  return stateMap[prefix] || null;
}
