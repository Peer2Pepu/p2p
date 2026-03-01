/**
 * Fetches IPFS data with fallback gateways and timeout
 * @param ipfsHash - The IPFS hash to fetch
 * @param timeout - Timeout in milliseconds (default: 8000)
 * @returns Promise with the fetched JSON data or null if all gateways fail
 */
export async function fetchIPFSData(ipfsHash: string | null | undefined, timeout: number = 8000): Promise<any | null> {
  if (!ipfsHash) return null;
  
  // List of IPFS gateways to try (in order)
  const gateways = [
    `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`,
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`
  ];
  
  // Try each gateway with timeout
  for (let i = 0; i < gateways.length; i++) {
    const gatewayUrl = gateways[i];
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(gatewayUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      // If this is the last gateway, return null
      if (i === gateways.length - 1) {
        console.error(`Failed to fetch IPFS data for ${ipfsHash} from all gateways`);
        return null;
      }
      // Otherwise, continue to next gateway
    }
  }
  
  return null;
}
