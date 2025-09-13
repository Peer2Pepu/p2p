import { NextRequest, NextResponse } from 'next/server';
import lighthouse from '@lighthouse-web3/sdk';

export async function POST(request: NextRequest) {
  try {
    const { title, description, categories, outcomeType, multipleOptions } = await request.json();

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Prepare market data for IPFS
    const marketData = {
      title,
      description,
      categories: categories || [],
      outcomeType,
      options: outcomeType === 'multiple' ? multipleOptions : ['Yes', 'No'],
      createdAt: new Date().toISOString(),
      version: '1.0'
    };

    // Upload to IPFS using Lighthouse
    const apiKey = process.env.LIGHTHOUSE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Lighthouse API key not configured' },
        { status: 500 }
      );
    }

    const uploadResponse = await lighthouse.uploadText(
      JSON.stringify(marketData),
      apiKey
    );

    if (!uploadResponse.data || !uploadResponse.data.Hash) {
      return NextResponse.json(
        { error: 'Failed to upload to IPFS' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ipfsHash: uploadResponse.data.Hash,
      gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${uploadResponse.data.Hash}`
    });

  } catch (error) {
    console.error('IPFS upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}