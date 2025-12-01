// A simple zip code to area code lookup.
// This is not an exhaustive list, but it covers the most common cases.
const zipToAreaCode: { [key: string]: string } = {
    '902': '310', // Beverly Hills
    '921': '619', // San Diego
    '941': '415', // San Francisco
    '802': '303', // Denver
    '331': '305', // Miami
    '606': '312', // Chicago
    '100': '212', // New York
    '770': '404', // Atlanta
  };

  export function getAreaCodeFromZip(zipCode: string): string | undefined {
    const prefix = zipCode.substring(0, 3);
    return zipToAreaCode[prefix];
  }

  // Simple state lookup from zip code prefix
  const zipToState: { [key: string]: string } = {
    '902': 'CA', // Beverly Hills
    '921': 'CA', // San Diego
    '941': 'CA', // San Francisco
    '802': 'CO', // Denver
    '331': 'FL', // Miami
    '606': 'IL', // Chicago
    '100': 'NY', // New York
    '770': 'GA', // Atlanta
  };

  export function getStateFromZip(zipCode: string): string | undefined {
    const prefix = zipCode.substring(0, 3);
    return zipToState[prefix];
  }
