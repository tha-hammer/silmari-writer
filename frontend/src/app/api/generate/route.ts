import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    // TODO: Integrate with BAML + Claude from planning_pipeline
    // For now, return mock response
    const mockResponse = `You said: "${message}". This is a placeholder response. In production, this will use the BAML + Claude pipeline from planning_pipeline/claude_runner.py.`;

    return NextResponse.json({
      content: mockResponse,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
