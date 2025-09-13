import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const { contractAddress, abi, functionName, args = [] } = await request.json();

    if (!contractAddress || !abi || !functionName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, abi, provider);

    // Call the function
    const result = await contract[functionName](...args);

    // Convert BigInt to string for JSON serialization
    const serializedData = JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({
      success: true,
      data: serializedData
    });

  } catch (error: any) {
    console.error('Contract read error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to read contract' 
      },
      { status: 500 }
    );
  }
}
