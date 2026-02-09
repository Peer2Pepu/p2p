import { NextRequest, NextResponse } from 'next/server';

// URL of your Python NSFW moderation service
const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Forward the file to the moderation service
    const moderationFormData = new FormData();
    moderationFormData.append('file', file);
    moderationFormData.append('return_blur', '0'); // Don't return blurred image, just check

    const response = await fetch(`${MODERATION_SERVICE_URL}/moderate`, {
      method: 'POST',
      body: moderationFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Moderation service error:', errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: `Moderation service error: ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const moderationResult = await response.json();

    // Check the decision
    if (moderationResult.decision?.action === 'block') {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          reason: 'Image contains inappropriate content',
          score: moderationResult.probabilities?.nsfw || 0,
          decision: moderationResult.decision,
        },
        { status: 403 }
      );
    }

    // Image passed moderation
    return NextResponse.json({
      success: true,
      blocked: false,
      decision: moderationResult.decision,
      probabilities: moderationResult.probabilities,
      hash: moderationResult.hash,
    });

  } catch (error: any) {
    console.error('Error in moderation API:', error);
    
    // If moderation service is unavailable, you can choose to:
    // 1. Block all images (strict)
    // 2. Allow all images (permissive)
    // 3. Return error (current behavior)
    
    const failOpen = process.env.MODERATION_FAIL_OPEN === 'true';
    
    if (failOpen) {
      // Fail open: allow image if moderation service is down
      console.warn('Moderation service unavailable, allowing image (fail-open mode)');
      return NextResponse.json({
        success: true,
        blocked: false,
        warning: 'Moderation service unavailable, image allowed',
      });
    }
    
    // Fail closed: block image if moderation service is down
    return NextResponse.json(
      {
        success: false,
        error: 'Moderation service unavailable. Please try again later.',
      },
      { status: 503 }
    );
  }
}
